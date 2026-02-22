"""
SNMP Traffic Controller Agent.
Exposes traffic signal OIDs via SNMP v2c on UDP port 5021.

INTENTIONALLY VULNERABLE:
- Default community strings ("public" / "private")
- No SNMPv3 (no encryption, no real authentication)
- This mirrors real-world traffic controller deployments

Uses a lightweight custom SNMP responder built on pysnmp's low-level
message processing to keep things simple and async-compatible.
"""

import asyncio
import logging

from snmp_server.oids import (
    BASE_OID,
    OID_REGISTRY,
    SORTED_OIDS,
    NAME_TO_OID,
)

logger = logging.getLogger(__name__)


class SNMPTrafficController:
    """
    Lightweight SNMP agent for the traffic intersection controller.
    Handles GET, GETNEXT (WALK), and SET requests with community string auth.
    """

    READ_COMMUNITY = "public"
    WRITE_COMMUNITY = "private"

    def __init__(self, host: str = "0.0.0.0", port: int = 5021):
        self.host = host
        self.port = port

        # In-memory OID value store (OID tuple -> int value)
        self._values: dict[tuple, int] = {}
        self._set_initial_values()

        # UDP transport
        self._transport = None
        self._protocol = None

    def _oid_by_name(self, name: str) -> tuple:
        """Look up OID tuple by name."""
        return NAME_TO_OID[name]

    def _set_initial_values(self):
        """Set all OID values to their defaults."""
        for oid, meta in OID_REGISTRY.items():
            self._values[oid] = meta["default"]

    def reset(self):
        """Reset all OID values to defaults."""
        self._set_initial_values()
        logger.info("SNMP agent: OID values reset to defaults")

    def read_attacker_writes(self) -> dict:
        """
        Read current values of writable OIDs (called before each tick).
        Returns dict mapping OID names to current values.
        """
        result = {}
        for oid, meta in OID_REGISTRY.items():
            if meta["writable"]:
                result[meta["name"]] = self._values[oid]
        return result

    def update_from_simulation(self, traffic_state: dict):
        """
        Update read-only OID values from simulation state (called after each tick).
        Only updates non-writable OIDs to preserve attacker writes.
        """
        from snmp_server.oids import LIGHT_STATE_MAP, PEDESTRIAN_STATE_MAP

        # Map simulation state keys to OID values
        updates = {
            "current_phase": traffic_state["current_phase"],
            "ns_light": LIGHT_STATE_MAP.get(traffic_state["ns_light"], 1),
            "ew_light": LIGHT_STATE_MAP.get(traffic_state["ew_light"], 1),
            "phase_timer": int(traffic_state["phase_timer"]),
            "ns_queue": traffic_state["ns_queue"],
            "ew_queue": traffic_state["ew_queue"],
            "ns_avg_wait": int(traffic_state["ns_wait_time"]),
            "ew_avg_wait": int(traffic_state["ew_wait_time"]),
            "ns_pedestrian": PEDESTRIAN_STATE_MAP.get(traffic_state["ns_pedestrian"], 2),
            "ew_pedestrian": PEDESTRIAN_STATE_MAP.get(traffic_state["ew_pedestrian"], 2),
            "total_vehicles_passed": traffic_state["total_vehicles_passed"],
            "gridlock_level": int(traffic_state["gridlock_level"]),
            "flash_mode": 1 if traffic_state["flash_mode"] else 0,
            "conflict_detected": 1 if traffic_state["conflict_detected"] else 0,
        }

        for name, value in updates.items():
            oid = NAME_TO_OID.get(name)
            if oid and not OID_REGISTRY[oid]["writable"]:
                self._values[oid] = value

    # ─── SNMP Protocol Handling ─────────────────────────────────

    def _handle_get(self, oid_tuple: tuple) -> int | None:
        """Handle SNMP GET request. Returns value or None if OID not found."""
        return self._values.get(oid_tuple)

    def _handle_getnext(self, oid_tuple: tuple) -> tuple[tuple, int] | None:
        """Handle SNMP GETNEXT request. Returns (next_oid, value) or None."""
        for sorted_oid in SORTED_OIDS:
            if sorted_oid > oid_tuple:
                return (sorted_oid, self._values[sorted_oid])
        return None

    def _handle_set(self, oid_tuple: tuple, value: int, community: str) -> bool:
        """Handle SNMP SET request. Returns True if successful."""
        if community != self.WRITE_COMMUNITY:
            logger.warning(f"SNMP SET denied: wrong community '{community}' for OID {oid_tuple}")
            return False

        if oid_tuple not in OID_REGISTRY:
            logger.warning(f"SNMP SET denied: unknown OID {oid_tuple}")
            return False

        if not OID_REGISTRY[oid_tuple]["writable"]:
            logger.warning(f"SNMP SET denied: OID {oid_tuple} is read-only")
            return False

        old_val = self._values[oid_tuple]
        self._values[oid_tuple] = value
        name = OID_REGISTRY[oid_tuple]["name"]
        logger.info(f"SNMP SET: {name} ({'.'.join(str(x) for x in oid_tuple)}) = {value} (was {old_val})")
        return True

    # ─── UDP SNMP Server ────────────────────────────────────────

    async def start(self):
        """Start the SNMP agent as an async UDP server."""
        logger.info(f"Starting SNMP agent on {self.host}:{self.port} (UDP)")

        loop = asyncio.get_event_loop()
        self._transport, self._protocol = await loop.create_datagram_endpoint(
            lambda: SNMPProtocol(self),
            local_addr=(self.host, self.port),
        )

        logger.info(f"SNMP agent listening on UDP {self.host}:{self.port}")
        logger.info(f"  Community strings: '{self.READ_COMMUNITY}' (read), '{self.WRITE_COMMUNITY}' (read-write)")


class SNMPProtocol(asyncio.DatagramProtocol):
    """
    Async UDP protocol handler for SNMP v1/v2c messages.
    Parses raw SNMP PDUs and dispatches to the agent's handlers.
    """

    def __init__(self, agent: SNMPTrafficController):
        self.agent = agent
        self.transport = None

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data: bytes, addr):
        """Parse incoming SNMP message and respond."""
        try:
            response = self._process_message(data)
            if response:
                self.transport.sendto(response, addr)
        except Exception as e:
            logger.error(f"SNMP error processing message from {addr}: {e}")

    def _process_message(self, data: bytes) -> bytes | None:
        """
        Parse and process an SNMP v1/v2c message.
        Returns response bytes or None.
        """
        try:
            from pysnmp.proto.api import decodeMessageVersion, PROTOCOL_MODULES
            from pyasn1.codec.ber import decoder, encoder
            from pyasn1.type import univ

            # Determine SNMP version from raw bytes
            ver = decodeMessageVersion(data)
            proto_mod = PROTOCOL_MODULES[ver]

            # Decode message
            msg, _ = decoder.decode(data, asn1Spec=proto_mod.Message())

            # Extract community string
            community = str(proto_mod.apiMessage.get_community(msg))

            # Check community string for read access
            if community not in (self.agent.READ_COMMUNITY, self.agent.WRITE_COMMUNITY):
                logger.warning(f"SNMP auth failure: community '{community}'")
                resp_msg = proto_mod.apiMessage.get_response(msg)
                resp_pdu = proto_mod.apiMessage.get_pdu(resp_msg)
                proto_mod.apiPDU.set_error_status(resp_pdu, 16)
                return encoder.encode(resp_msg)

            pdu = proto_mod.apiMessage.get_pdu(msg)
            pdu_type = pdu.__class__.__name__

            # Build response varbinds based on PDU type
            if 'GetRequest' in pdu_type and 'Next' not in pdu_type and 'Bulk' not in pdu_type:
                new_varbinds = self._handle_get_request(proto_mod, pdu)
            elif 'GetNextRequest' in pdu_type or 'GetBulkRequest' in pdu_type:
                new_varbinds = self._handle_getnext_request(proto_mod, pdu)
            elif 'SetRequest' in pdu_type:
                new_varbinds = self._handle_set_request(proto_mod, pdu, community)
            else:
                logger.warning(f"Unsupported PDU type: {pdu_type}")
                return None

            # Build response message from request (copies request-id, community)
            resp_msg = proto_mod.apiMessage.get_response(msg)
            resp_pdu = proto_mod.apiPDU.get_response(pdu)

            # Set the response varbinds
            proto_mod.apiPDU.set_varbinds(resp_pdu, new_varbinds)

            # Copy error status/index from request PDU (handlers may have set them)
            proto_mod.apiPDU.set_error_status(resp_pdu, proto_mod.apiPDU.get_error_status(pdu))
            proto_mod.apiPDU.set_error_index(resp_pdu, proto_mod.apiPDU.get_error_index(pdu))

            proto_mod.apiMessage.set_pdu(resp_msg, resp_pdu)
            return encoder.encode(resp_msg)

        except Exception as e:
            logger.error(f"SNMP message processing error: {e}", exc_info=True)
            return None

    def _handle_get_request(self, proto_mod, pdu) -> list:
        """Process GET request — return values for requested OIDs."""
        from pyasn1.type import univ

        var_binds = proto_mod.apiPDU.get_varbinds(pdu)
        new_var_binds = []

        for oid, _ in var_binds:
            oid_tuple = tuple(int(x) for x in oid)
            value = self.agent._handle_get(oid_tuple)

            if value is not None:
                new_var_binds.append((oid, univ.Integer(value)))
            else:
                new_var_binds.append((oid, proto_mod.NoSuchInstance()))

        return new_var_binds

    def _handle_getnext_request(self, proto_mod, pdu) -> list:
        """Process GETNEXT request — return next OID in tree (used by snmpwalk)."""
        from pyasn1.type import univ

        var_binds = proto_mod.apiPDU.get_varbinds(pdu)
        new_var_binds = []

        for oid, _ in var_binds:
            oid_tuple = tuple(int(x) for x in oid)
            result = self.agent._handle_getnext(oid_tuple)

            if result:
                next_oid, value = result
                next_oid_asn1 = univ.ObjectIdentifier(next_oid)
                new_var_binds.append((next_oid_asn1, univ.Integer(value)))
            else:
                # End of MIB
                new_var_binds.append((oid, proto_mod.EndOfMibView()))

        return new_var_binds

    def _handle_set_request(self, proto_mod, pdu, community: str) -> list:
        """Process SET request — write value if community string allows."""
        from pyasn1.type import univ

        var_binds = proto_mod.apiPDU.get_varbinds(pdu)
        new_var_binds = []

        for i, (oid, value) in enumerate(var_binds):
            oid_tuple = tuple(int(x) for x in oid)
            int_value = int(value)

            success = self.agent._handle_set(oid_tuple, int_value, community)
            if success:
                new_var_binds.append((oid, univ.Integer(int_value)))
            else:
                proto_mod.apiPDU.set_error_status(pdu, 17)  # notWritable
                proto_mod.apiPDU.set_error_index(pdu, i + 1)
                new_var_binds.append((oid, univ.Integer(0)))

        return new_var_binds
