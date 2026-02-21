"""
HydraGuard ICS Lab — Main Application
FastAPI server with Socket.IO for real-time communication.
Orchestrates the process simulation and Modbus server.
"""

import asyncio
import logging

import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from simulation.process_engine import ProcessEngine
from modbus_server.server import ModbusPLCServer

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("hydraguard")

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",  # Allow React dev server
)

# FastAPI app
app = FastAPI(
    title="HydraGuard ICS Lab",
    description="ICS/OT Cybersecurity Training Lab — Dam & Water Treatment Facility",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wrap FastAPI with Socket.IO
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Global simulation engine and Modbus server
engine = ProcessEngine()
modbus_server = ModbusPLCServer(host="0.0.0.0", port=5020)


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


# ─── REST API Endpoints ─────────────────────────────────────────

@app.get("/api/status")
async def get_status():
    """Get current system status."""
    return {
        "displayed": engine.get_displayed_state(),
        "actual": engine.get_actual_state(),
        "modbus_port": modbus_server.port,
    }


@app.post("/api/reset")
async def reset_simulation():
    """Reset simulation AND Modbus registers to safe defaults."""
    engine.reset()
    modbus_server._set_initial_values()
    logger.info("Simulation reset to safe defaults (engine + Modbus registers)")
    return {"status": "reset", "message": "All systems returned to normal"}


# ─── Simulation Loop ────────────────────────────────────────────

async def pre_tick_sync():
    """
    Called BEFORE each simulation tick.
    Reads Modbus registers/coils to pick up any writes from the student's
    attack tools (pymodbus client, custom scripts, Kali tools, etc.).
    This is how external Modbus writes affect the simulation.
    """
    writes = modbus_server.read_attacker_writes()

    # Apply gate setpoint if attacker wrote to register 3
    engine.dam.set_gate_target(writes["gate_position_setpoint"])

    # Apply chlorine dosing if attacker wrote to register 4
    engine.plant.chlorine_dosing_rate = writes["chlorine_dosing_rate"]

    # Apply coil commands
    if writes["gate_command"]:
        engine.dam.set_gate_target(100.0)
    engine.plant.intake_pump = writes["intake_pump"]
    engine.plant.chemical_pump = writes["chemical_pump"]
    engine.plant.distribution_pump = writes["distribution_pump"]


async def post_tick_sync(displayed_state: dict, actual_state: dict):
    """Called AFTER each simulation tick to push updates."""
    # Sync simulation sensor values back to Modbus registers
    modbus_server.update_from_simulation(
        actual_state["dam"], actual_state["plant"]
    )

    # Push state to all connected WebSocket clients
    await sio.emit("process_update", {
        "displayed": displayed_state,
        "actual": actual_state,
    })


@app.on_event("startup")
async def startup():
    """Start simulation and Modbus server on app startup."""
    logger.info("=" * 60)
    logger.info("  HydraGuard ICS Lab — Starting Up")
    logger.info("  Dam & Water Treatment Facility Simulation")
    logger.info("=" * 60)

    # Start Modbus TCP server in background
    asyncio.create_task(modbus_server.start())
    logger.info(f"Modbus TCP server starting on port {modbus_server.port}")

    # Start simulation loop with pre-tick sync for Modbus attack detection
    asyncio.create_task(
        engine.run_loop(on_pre_tick=pre_tick_sync, on_tick=post_tick_sync)
    )
    logger.info("Process simulation started (tick interval: 0.5s)")


# ─── Entry Point ─────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        socket_app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )
