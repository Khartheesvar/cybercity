"""
Dam physics simulation.
Models water level, inflow, outflow, and sluice gate behavior.
Based on simplified hydraulic equations for educational purposes.
"""

import math
import random
import time


class DamSimulation:
    # Physical constants
    MAX_CAPACITY_METERS = 100.0      # Max water level in meters
    SPILLWAY_LEVEL = 95.0            # Spillway activates above this
    DANGER_LEVEL = 85.0              # High-level alarm threshold
    LOW_LEVEL = 20.0                 # Low-level alarm threshold
    MAX_OUTFLOW = 425.0              # Max outflow in m³/s (tuned so 40% gate ≈ 120 m³/s at 50m)
    GATE_RESPONSE_RATE = 5.0         # Gate moves 5% per tick

    def __init__(self):
        self.reset()

    def reset(self):
        """Reset dam to safe operating conditions."""
        self.water_level = 50.0          # meters (safe mid-range)
        self.inflow_rate = 120.0         # m³/s (natural river inflow)
        self.outflow_rate = 120.0        # m³/s (matches inflow at equilibrium)
        self.gate_position = 40.0        # % open (0=closed, 100=fully open)
        self.gate_target = 40.0          # target gate position (for smooth movement)
        self.spillway_active = False
        self.high_level_alarm = False
        self.low_level_alarm = False
        self.overflow = False
        self._base_inflow = 120.0
        self._time_offset = time.time()

    def set_gate_target(self, position: float):
        """Set the target gate position (0-100%)."""
        self.gate_target = max(0.0, min(100.0, position))

    def tick(self, dt: float = 0.5):
        """
        Advance simulation by dt seconds.
        Updates water level based on inflow/outflow balance.
        """
        # Simulate natural inflow variation (rainfall patterns)
        elapsed = time.time() - self._time_offset
        seasonal = math.sin(elapsed * 0.05) * 30  # slow seasonal variation
        noise = random.gauss(0, 5)                 # random noise
        self.inflow_rate = max(20.0, self._base_inflow + seasonal + noise)

        # Smooth gate movement toward target
        if abs(self.gate_position - self.gate_target) > 0.1:
            direction = 1.0 if self.gate_target > self.gate_position else -1.0
            self.gate_position += direction * self.GATE_RESPONSE_RATE * dt
            self.gate_position = max(0.0, min(100.0, self.gate_position))

        # Calculate outflow based on gate position and water head pressure
        head_factor = math.sqrt(self.water_level / self.MAX_CAPACITY_METERS)
        self.outflow_rate = (self.gate_position / 100.0) * self.MAX_OUTFLOW * head_factor

        # Spillway overflow if above spillway level
        self.spillway_active = self.water_level > self.SPILLWAY_LEVEL
        spillway_flow = 0.0
        if self.spillway_active:
            excess = self.water_level - self.SPILLWAY_LEVEL
            spillway_flow = excess * 50.0  # aggressive spillway

        # Update water level (simplified: 1 m³/s ~ 0.005m level change)
        # Scaled for visible impact within ~30 seconds of an attack
        level_change = (self.inflow_rate - self.outflow_rate - spillway_flow) * 0.005 * dt
        self.water_level += level_change
        self.water_level = max(0.0, min(self.MAX_CAPACITY_METERS, self.water_level))

        # Overflow state
        self.overflow = self.water_level >= self.MAX_CAPACITY_METERS

        # Alarm states
        self.high_level_alarm = self.water_level >= self.DANGER_LEVEL
        self.low_level_alarm = self.water_level <= self.LOW_LEVEL

    def get_state(self) -> dict:
        """Return current dam state as a dictionary."""
        return {
            "water_level": round(self.water_level, 2),
            "inflow_rate": round(self.inflow_rate, 2),
            "outflow_rate": round(self.outflow_rate, 2),
            "gate_position": round(self.gate_position, 2),
            "gate_target": round(self.gate_target, 2),
            "spillway_active": self.spillway_active,
            "high_level_alarm": self.high_level_alarm,
            "low_level_alarm": self.low_level_alarm,
            "overflow": self.overflow,
        }
