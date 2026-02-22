"""
Main process engine that orchestrates all scenario simulations.
Runs the simulation loop and provides a unified state interface.
"""

import asyncio
import time

from simulation.dam import DamSimulation
from simulation.treatment_plant import TreatmentPlantSimulation
from simulation.traffic_intersection import TrafficIntersectionSimulation
from simulation.power_grid import PowerGridSimulation


class ProcessEngine:
    TICK_INTERVAL = 0.5  # seconds between simulation ticks

    def __init__(self):
        self.dam = DamSimulation()
        self.plant = TreatmentPlantSimulation()
        self.traffic = TrafficIntersectionSimulation()
        self.grid = PowerGridSimulation()
        self.running = False
        self.tick_count = 0
        self.start_time = None

    def reset(self):
        """Reset entire simulation to safe defaults."""
        self.dam.reset()
        self.plant.reset()
        self.traffic.reset()
        self.grid.reset()
        self.tick_count = 0
        self.start_time = time.time()

    def tick(self):
        """Advance one simulation step."""
        dt = self.TICK_INTERVAL

        # Dam simulation step
        self.dam.tick(dt)

        # Feed dam outflow into treatment plant intake
        self.plant.set_intake_from_dam(self.dam.outflow_rate)

        # Treatment plant simulation step
        self.plant.tick(dt)

        # Traffic intersection simulation step
        self.traffic.tick(dt)

        # Power grid simulation step
        self.grid.tick(dt)

        self.tick_count += 1

    def get_actual_state(self) -> dict:
        """Get the real (ground truth) system state."""
        return {
            "dam": self.dam.get_state(),
            "plant": self.plant.get_state(),
            "traffic": self.traffic.get_state(),
            "grid": self.grid.get_state(),
            "tick": self.tick_count,
            "uptime": round(time.time() - self.start_time, 1) if self.start_time else 0,
        }

    def get_displayed_state(self) -> dict:
        """Get the state as displayed to the operator (same as actual)."""
        state = self.get_actual_state()
        state["spoofing_active"] = False
        return state

    async def run_loop(self, on_pre_tick=None, on_tick=None):
        """
        Main simulation loop.
        - on_pre_tick: called BEFORE each tick (reads Modbus attacker writes)
        - on_tick: called AFTER each tick (syncs state to Modbus + WebSocket)
        """
        self.running = True
        self.start_time = time.time()

        while self.running:
            # Read attacker inputs from Modbus before simulation step
            if on_pre_tick:
                await on_pre_tick()

            self.tick()

            if on_tick:
                await on_tick(self.get_displayed_state(), self.get_actual_state())

            await asyncio.sleep(self.TICK_INTERVAL)

    def stop(self):
        """Stop the simulation loop."""
        self.running = False
