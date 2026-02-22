"""
CyberCity ICS — Main Application
FastAPI server with Socket.IO for real-time communication.
Orchestrates all scenario simulations, Modbus server, and SNMP agent.
"""

import asyncio
import logging

import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from simulation.process_engine import ProcessEngine
from modbus_server.server import ModbusPLCServer
from snmp_server.agent import SNMPTrafficController

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("cybercity")

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",  # Allow React dev server
)

# FastAPI app
api = FastAPI(
    title="CyberCity ICS",
    description="ICS/OT Cybersecurity Training Platform",
    version="2.0.0",
)

api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wrap FastAPI with Socket.IO — this is the ASGI entry point
app = socketio.ASGIApp(sio, other_asgi_app=api)

# Global simulation engine and protocol servers
engine = ProcessEngine()
modbus_server = ModbusPLCServer(host="0.0.0.0", port=5020)
snmp_server = SNMPTrafficController(host="0.0.0.0", port=5021)


# ─── Socket.IO Events ───────────────────────────────────────────

@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    # Send current state immediately on connect
    state = engine.get_displayed_state()
    actual = engine.get_actual_state()
    await sio.emit("process_update", {
        "displayed": state,
        "actual": actual,
    }, room=sid)


@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")


@sio.event
async def manual_control(sid, data):
    """Handle manual control commands from the HMI.
    Must also write to Modbus registers so pre_tick_sync doesn't overwrite."""
    logger.info(f"Manual control from {sid}: {data}")
    command = data.get("command")
    value = data.get("value")
    slave = modbus_server.context[0]

    if command == "set_gate":
        gate_val = float(value)
        engine.dam.set_gate_target(gate_val)
        slave.setValues(3, 3, [int(round(gate_val * 100))])
    elif command == "toggle_intake_pump":
        engine.plant.intake_pump = not engine.plant.intake_pump
        slave.setValues(1, 1, [engine.plant.intake_pump])
    elif command == "toggle_chemical_pump":
        engine.plant.chemical_pump = not engine.plant.chemical_pump
        slave.setValues(1, 2, [engine.plant.chemical_pump])
    elif command == "toggle_distribution_pump":
        engine.plant.distribution_pump = not engine.plant.distribution_pump
        slave.setValues(1, 3, [engine.plant.distribution_pump])
    elif command == "set_chlorine_dosing":
        chlorine_val = float(value)
        engine.plant.chlorine_dosing_rate = chlorine_val
        slave.setValues(3, 4, [int(round(chlorine_val * 100))])

    # ─── Traffic scenario commands ───
    elif command == "set_ns_green":
        engine.traffic.ns_green_time = float(value)
        snmp_server._values[snmp_server._oid_by_name("ns_green_time")] = int(value)
    elif command == "set_ew_green":
        engine.traffic.ew_green_time = float(value)
        snmp_server._values[snmp_server._oid_by_name("ew_green_time")] = int(value)
    elif command == "set_phase_hold":
        engine.traffic.phase_hold = int(value)
        snmp_server._values[snmp_server._oid_by_name("phase_hold")] = int(value)
    elif command == "set_preemption":
        engine.traffic.preemption_active = int(value)
        snmp_server._values[snmp_server._oid_by_name("preemption_active")] = int(value)
    elif command == "toggle_conflict_monitor":
        engine.traffic.conflict_monitor_enabled = not engine.traffic.conflict_monitor_enabled
        val = 1 if engine.traffic.conflict_monitor_enabled else 0
        snmp_server._values[snmp_server._oid_by_name("conflict_monitor_enabled")] = val


# ─── REST API Endpoints ─────────────────────────────────────────

@api.get("/api/status")
async def get_status():
    """Get current system status."""
    return {
        "displayed": engine.get_displayed_state(),
        "actual": engine.get_actual_state(),
        "modbus_port": modbus_server.port,
        "snmp_port": snmp_server.port,
    }


@api.post("/api/reset")
async def reset_simulation():
    """Reset all simulations and protocol servers to safe defaults."""
    engine.reset()
    modbus_server._set_initial_values()
    snmp_server.reset()
    logger.info("Simulation reset to safe defaults (all scenarios)")
    return {"status": "reset", "message": "All systems returned to normal"}


# ─── Simulation Loop ────────────────────────────────────────────

async def pre_tick_sync():
    """
    Called BEFORE each simulation tick.
    Reads protocol servers (Modbus + SNMP) to pick up any writes from
    the student's attack tools.
    """
    # ─── Dam scenario (Modbus) ───
    writes = modbus_server.read_attacker_writes()
    engine.dam.set_gate_target(writes["gate_position_setpoint"])
    engine.plant.chlorine_dosing_rate = writes["chlorine_dosing_rate"]
    if writes["gate_command"]:
        engine.dam.set_gate_target(100.0)
    engine.plant.intake_pump = writes["intake_pump"]
    engine.plant.chemical_pump = writes["chemical_pump"]
    engine.plant.distribution_pump = writes["distribution_pump"]

    # ─── Traffic scenario (SNMP) ───
    traffic_writes = snmp_server.read_attacker_writes()
    engine.traffic.ns_green_time = float(traffic_writes["ns_green_time"])
    engine.traffic.ew_green_time = float(traffic_writes["ew_green_time"])
    engine.traffic.phase_hold = traffic_writes["phase_hold"]
    engine.traffic.preemption_active = traffic_writes["preemption_active"]
    engine.traffic.conflict_monitor_enabled = bool(traffic_writes["conflict_monitor_enabled"])


async def post_tick_sync(displayed_state: dict, actual_state: dict):
    """Called AFTER each simulation tick to push updates."""
    # Sync dam sensor values to Modbus registers
    modbus_server.update_from_simulation(
        actual_state["dam"], actual_state["plant"]
    )

    # Sync traffic sensor values to SNMP OIDs
    snmp_server.update_from_simulation(actual_state["traffic"])

    # Push state to all connected WebSocket clients
    await sio.emit("process_update", {
        "displayed": displayed_state,
        "actual": actual_state,
    })


@api.on_event("startup")
async def startup():
    """Start all simulations and protocol servers on app startup."""
    logger.info("=" * 60)
    logger.info("  CyberCity ICS — Starting Up")
    logger.info("  ICS/OT Cybersecurity Training Platform")
    logger.info("=" * 60)

    # Start Modbus TCP server (Dam scenario, port 5020)
    asyncio.create_task(modbus_server.start())
    logger.info(f"Modbus TCP server starting on port {modbus_server.port}")

    # Start SNMP agent (Traffic scenario, port 5021)
    asyncio.create_task(snmp_server.start())
    logger.info(f"SNMP agent starting on UDP port {snmp_server.port}")

    # Start simulation loop with pre-tick sync for attack detection
    asyncio.create_task(
        engine.run_loop(on_pre_tick=pre_tick_sync, on_tick=post_tick_sync)
    )
    logger.info("Process simulation started (tick interval: 0.5s)")


# ─── Entry Point ─────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )
