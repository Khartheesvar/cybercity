"""
IEC 61850 MMS Server — Northgate Substation IED Simulator

Intentionally vulnerable: No authentication, no access control.
This mirrors many real-world legacy IEC 61850 deployments where:
  - Default credentials are never changed
  - RBAC (Role-Based Access Control) is disabled
  - MMS server is exposed directly on the network

Protocol: Newline-delimited JSON over TCP (port 5022)
  (Simplified MMS transport — preserves IEC 61850 naming conventions)

Commands (client → server, each terminated with \n):
  {"cmd": "identify"}
  {"cmd": "get_name_list"}
  {"cmd": "read",         "ref": "<object-ref>"}
  {"cmd": "read_dataset", "ref": "<DS_NAME>"}
  {"cmd": "write",        "ref": "<object-ref>", "value": <value>}

Responses (server → client):
  {"status": "ok",    ...data...}
  {"status": "error", "message": "..."}
"""

import asyncio
import json
import logging
import time
from typing import Optional

from iec61850_server.objects import OBJECTS, DATASETS, NAMEPLATE

log = logging.getLogger("iec61850_server")


class IEC61850Server:
    """
    Lightweight IEC 61850 MMS simulator over TCP.
    Intentionally insecure — no auth, no encryption.
    """

    IED_NAME     = "NORTHGATE_IED1"
    SERVER_INFO  = "IEC 61850 MMS Server — Northgate 230/115kV Substation"
    PORT         = 5022
    HOST         = "0.0.0.0"

    def __init__(self, host: str = "0.0.0.0", port: int = 5022):
        self.host = host
        self.port = port

        # Live values for every object reference
        # Populated by update_from_simulation() each tick
        self._values: dict = {}

        # Attacker writes — queued here, consumed by pre_tick_sync
        self._pending_writes: dict = {}

        self._server: Optional[asyncio.AbstractServer] = None
        self._client_count = 0

        self._init_defaults()

    def _init_defaults(self):
        """Populate default/static values."""
        for ref, meta in OBJECTS.items():
            if ref in NAMEPLATE:
                self._values[ref] = NAMEPLATE[ref]
            elif meta["type"] == "bool":
                self._values[ref] = True
            elif meta["type"] == "float":
                self._values[ref] = 0.0
            elif meta["type"] == "int":
                self._values[ref] = 1
            else:
                self._values[ref] = ""

        # Nameplate overrides
        for ref, val in NAMEPLATE.items():
            self._values[ref] = val

    # ── Simulation sync ───────────────────────────────────────────────
    def update_from_simulation(self, grid_state: dict):
        """Called each tick to push simulation values into the MMS object store."""
        s = grid_state

        # CB positions
        for i, closed in enumerate(s.get("cb_states", [])):
            self._values[f"XCBR{i+1}.Pos.stVal"] = closed
            self._values[f"XCBR{i+1}.Pos.q"] = "good"

        # Measurements
        self._values["MMXU1.Hz.mag.f"]      = s.get("frequency", 60.0)
        self._values["MMXU1.TotW.mag.f"]    = s.get("active_power", 0.0)
        self._values["MMXU1.TotVAr.mag.f"]  = s.get("reactive_power", 0.0)
        self._values["MMXU1.TotPF.mag.f"]   = s.get("power_factor", 0.0)
        self._values["MMXU2.PhV.phsA.mag.f"] = s.get("hv_voltage", 0.0)
        self._values["MMXU3.PhV.phsA.mag.f"] = s.get("lv_voltage", 0.0)

        # Transformer
        self._values["ATCC1.TrCurr.mag.f"]  = s.get("tx1_load_pct", 0.0)
        self._values["ATCC2.TrCurr.mag.f"]  = s.get("tx2_load_pct", 0.0)
        self._values["ATCC1.TrTmp.mag.f"]   = s.get("tx1_temp", 0.0)
        self._values["ATCC2.TrTmp.mag.f"]   = s.get("tx2_temp", 0.0)
        self._values["ATCC1.Beh.stVal"]     = not s.get("tx1_tripped", False)
        self._values["ATCC2.Beh.stVal"]     = not s.get("tx2_tripped", False)

        # Protection enables (sync both ways — write back what simulation has)
        self._values["PROT1.Beh.stVal"]  = s.get("protection_enabled", True)
        self._values["DFPT1.Beh.stVal"]  = s.get("diff_prot_enabled", True)
        self._values["OCPT1.Beh.stVal"]  = s.get("overcurrent_enabled", True)
        self._values["UFPT1.Beh.stVal"]  = s.get("underfreq_enabled", True)
        self._values["RREC1.Beh.stVal"]  = s.get("autorecloser_enabled", True)

        # Derived
        self._values["CSWI1.Pos.stVal"]  = s.get("blackout", False)
        self._values["CSWI1.GridStress.f"] = s.get("grid_stress", 0.0)
        self._values["LLN0.Health.stVal"] = 3 if s.get("blackout") else \
                                            2 if s.get("grid_stress", 0) > 50 else 1

    def read_attacker_writes(self) -> dict:
        """Consume and return pending attacker writes."""
        writes = dict(self._pending_writes)
        self._pending_writes.clear()
        return writes

    def reset(self):
        self._pending_writes.clear()
        self._init_defaults()

    # ── TCP connection handler ────────────────────────────────────────
    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        addr = writer.get_extra_info("peername")
        self._client_count += 1
        log.info(f"[IEC61850] Client connected from {addr}  (total: {self._client_count})")

        # Send banner
        banner = {
            "type": "banner",
            "server": self.SERVER_INFO,
            "ied_name": self.IED_NAME,
            "protocol": "IEC 61850 MMS",
            "auth": "NONE",        # intentionally vulnerable
            "note": "No authentication required — legacy configuration",
        }
        writer.write((json.dumps(banner) + "\n").encode())
        await writer.drain()

        try:
            while True:
                raw = await reader.readline()
                if not raw:
                    break
                raw = raw.strip()
                if not raw:
                    continue

                try:
                    msg = json.loads(raw.decode())
                except json.JSONDecodeError as e:
                    resp = {"status": "error", "message": f"JSON parse error: {e}"}
                    writer.write((json.dumps(resp) + "\n").encode())
                    await writer.drain()
                    continue

                resp = self._dispatch(msg)
                writer.write((json.dumps(resp) + "\n").encode())
                await writer.drain()

        except (asyncio.IncompleteReadError, ConnectionResetError):
            pass
        finally:
            self._client_count -= 1
            log.info(f"[IEC61850] Client {addr} disconnected")
            writer.close()

    def _dispatch(self, msg: dict) -> dict:
        cmd = msg.get("cmd", "").lower()
        ts  = round(time.time(), 3)

        if cmd == "identify":
            return {
                "status": "ok",
                "ied_name":    self.IED_NAME,
                "server":      self.SERVER_INFO,
                "protocol":    "IEC 61850 Edition 2.1",
                "mms_version": "ISO 9506",
                "auth":        "NONE",
                "location":    "Northgate Regional Substation, Bay 3",
                "timestamp":   ts,
            }

        elif cmd == "get_name_list":
            return {
                "status": "ok",
                "logical_device": "SubstationLD",
                "logical_nodes":  sorted({m["ln"] for m in OBJECTS.values()}),
                "objects": [
                    {
                        "ref":      ref,
                        "ln":       m["ln"],
                        "fc":       m["fc"],
                        "type":     m["type"],
                        "writable": m["writable"],
                        "desc":     m["desc"],
                        "unit":     m["unit"],
                    }
                    for ref, m in OBJECTS.items()
                ],
                "datasets": list(DATASETS.keys()),
                "count": len(OBJECTS),
            }

        elif cmd == "read":
            ref = msg.get("ref", "")
            if ref not in OBJECTS:
                return {"status": "error", "message": f"Unknown object: {ref}"}
            meta = OBJECTS[ref]
            return {
                "status": "ok",
                "ref":   ref,
                "value": self._values.get(ref),
                "fc":    meta["fc"],
                "type":  meta["type"],
                "desc":  meta["desc"],
                "unit":  meta["unit"],
                "q":     "good",
                "t":     ts,
            }

        elif cmd == "read_dataset":
            ds_name = msg.get("ref", "")
            if ds_name not in DATASETS:
                return {"status": "error", "message": f"Unknown dataset: {ds_name}. "
                        f"Available: {list(DATASETS.keys())}"}
            refs = DATASETS[ds_name]
            values = {}
            for ref in refs:
                if ref in OBJECTS:
                    meta = OBJECTS[ref]
                    values[ref] = {
                        "value": self._values.get(ref),
                        "fc":    meta["fc"],
                        "type":  meta["type"],
                        "unit":  meta["unit"],
                        "desc":  meta["desc"],
                    }
            return {
                "status":  "ok",
                "dataset": ds_name,
                "count":   len(values),
                "values":  values,
                "t":       ts,
            }

        elif cmd == "write":
            ref   = msg.get("ref", "")
            value = msg.get("value")

            if ref not in OBJECTS:
                return {"status": "error", "message": f"Unknown object: {ref}"}
            meta = OBJECTS[ref]
            if not meta["writable"]:
                return {"status": "error", "message": f"{ref} is read-only (FC={meta['fc']})"}
            if value is None:
                return {"status": "error", "message": "Missing 'value' field"}

            # Type coercion
            try:
                if meta["type"] == "bool":
                    value = bool(value)
                elif meta["type"] == "float":
                    value = float(value)
                elif meta["type"] == "int":
                    value = int(value)
            except (ValueError, TypeError) as e:
                return {"status": "error", "message": f"Type error: {e}"}

            # Queue the write for pre_tick_sync
            self._pending_writes[ref] = value
            self._values[ref] = value

            action = self._describe_write_action(ref, value)
            log.warning(f"[IEC61850] WRITE {ref} = {value}  ({action})")

            return {
                "status":  "ok",
                "ref":     ref,
                "value":   value,
                "action":  action,
                "t":       ts,
            }

        else:
            return {
                "status": "error",
                "message": f"Unknown command '{cmd}'. "
                           f"Supported: identify, get_name_list, read, read_dataset, write",
            }

    def _describe_write_action(self, ref: str, value) -> str:
        """Human-readable description of what a write action does."""
        if "XCBR" in ref and "Oper.ctlVal" in ref:
            cb_num = ref[4]
            names = {
                "1": "Line 1 source breaker",
                "2": "Line 2 source breaker",
                "3": "TX1 primary breaker",
                "4": "TX2 primary breaker",
                "5": "Feeder A (Industrial)",
                "6": "Feeder B (Residential)",
                "7": "Feeder C (Critical)",
            }
            action = "CLOSE" if value else "TRIP"
            return f"{action} CB{cb_num} — {names.get(cb_num, '')}"
        elif ref == "PROT1.Beh.stVal":
            return "ENABLE master protection" if value else "DISABLE master protection — DANGER!"
        elif ref == "DFPT1.Beh.stVal":
            return "ENABLE differential protection" if value else "DISABLE 87T differential protection"
        elif ref == "OCPT1.Beh.stVal":
            return "ENABLE overcurrent protection" if value else "DISABLE 51 overcurrent protection"
        elif ref == "UFPT1.Beh.stVal":
            return "ENABLE under-frequency relay" if value else "DISABLE 81L load shedding relay"
        elif ref == "RREC1.Beh.stVal":
            return "ENABLE auto-recloser" if value else "DISABLE auto-recloser — prevents automatic reconnection"
        return "configuration change"

    # ── Server startup ────────────────────────────────────────────────
    async def start(self):
        self._server = await asyncio.start_server(
            self._handle_client, self.host, self.port
        )
        log.info(f"[IEC61850] MMS server listening on TCP {self.host}:{self.port}")
        log.info(f"[IEC61850]   IED: {self.IED_NAME} | Auth: NONE (intentionally vulnerable)")
        log.info(f"[IEC61850]   Objects: {len(OBJECTS)} | Datasets: {list(DATASETS.keys())}")

        async with self._server:
            await self._server.serve_forever()
