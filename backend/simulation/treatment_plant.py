"""
Water Treatment Plant simulation.
Models multi-stage treatment: Intake -> Coagulation -> Sedimentation ->
Filtration -> Chlorination -> Distribution.

Based on simplified water treatment chemistry for educational purposes.
"""

import random


class TreatmentPlantSimulation:
    # Safe operating ranges
    CHLORINE_MIN = 1.0    # ppm
    CHLORINE_MAX = 4.0    # ppm
    CHLORINE_DANGER = 8.0 # ppm (toxic level)
    PH_MIN = 6.5
    PH_MAX = 8.5
    TURBIDITY_MAX = 5.0   # NTU
    TANK_MAX = 100.0      # %
    PRESSURE_MIN = 40.0   # PSI
    PRESSURE_MAX = 80.0   # PSI

    def __init__(self):
        self.reset()

    def reset(self):
        """Reset treatment plant to safe operating conditions."""
        # Chemical levels
        self.chlorine_level = 2.5         # ppm (safe mid-range)
        self.ph_level = 7.2               # pH (neutral-ish)
        self.turbidity = 1.5              # NTU (low = good)

        # Tank and flow
        self.tank_level = 60.0            # % full
        self.distribution_pressure = 55.0 # PSI
        self.intake_rate = 120.0          # m³/s (from dam outflow)

        # Pump states
        self.intake_pump = True           # on
        self.chemical_pump = True         # on
        self.distribution_pump = True     # on

        # Dosing rate (controls how much chlorine is added)
        self.chlorine_dosing_rate = 2.5   # ppm target

        # Alarms
        self.chemical_alarm = False
        self.pressure_alarm = False
        self.turbidity_alarm = False

        # Treatment stage status (0=offline, 1=normal, 2=warning, 3=critical)
        self.stages = {
            "intake": 1,
            "coagulation": 1,
            "sedimentation": 1,
            "filtration": 1,
            "chlorination": 1,
            "distribution": 1,
        }

    def set_intake_from_dam(self, dam_outflow: float):
        """Update intake rate based on dam outflow."""
        if self.intake_pump:
            self.intake_rate = dam_outflow
        else:
            self.intake_rate = 0.0

    def tick(self, dt: float = 0.5):
        """Advance treatment plant simulation by dt seconds."""
        # --- Intake stage ---
        if self.intake_pump and self.intake_rate > 0:
            # Tank fills based on intake minus distribution
            # Distribution output scales with tank level (head pressure)
            # Equilibrium at ~60% tank with normal intake (~120 m³/s)
            distribution_flow = (self.tank_level / 60.0) * 120.0 if self.distribution_pump else 0.0
            tank_change = (self.intake_rate - distribution_flow) * 0.02 * dt
            self.tank_level += tank_change
            self.tank_level = max(0.0, min(self.TANK_MAX, self.tank_level))
            self.stages["intake"] = 1
        else:
            self.stages["intake"] = 0

        # --- Chlorination ---
        if self.chemical_pump:
            # Chlorine level moves toward dosing rate
            diff = self.chlorine_dosing_rate - self.chlorine_level
            self.chlorine_level += diff * 0.1 * dt + random.gauss(0, 0.05)
            self.chlorine_level = max(0.0, self.chlorine_level)
            self.stages["chlorination"] = 1
        else:
            # Chlorine decays without pump
            self.chlorine_level *= (1 - 0.02 * dt)
            self.stages["chlorination"] = 0

        # --- pH adjustment ---
        # pH is affected by chlorine level (more chlorine = lower pH)
        target_ph = 7.4 - (self.chlorine_level - 2.5) * 0.15
        diff = target_ph - self.ph_level
        self.ph_level += diff * 0.05 * dt + random.gauss(0, 0.02)
        self.ph_level = max(0.0, min(14.0, self.ph_level))

        # --- Turbidity ---
        # Filtration reduces turbidity; without it, turbidity rises
        if self.intake_pump:
            raw_turbidity = 3.0 + random.gauss(0, 0.3)
            # Filtration effectiveness
            self.turbidity = self.turbidity * 0.95 + raw_turbidity * 0.05
            self.turbidity += random.gauss(0, 0.1)
            self.turbidity = max(0.1, self.turbidity)
            self.stages["filtration"] = 1
            self.stages["coagulation"] = 1
            self.stages["sedimentation"] = 1
        else:
            self.stages["filtration"] = 0
            self.stages["coagulation"] = 0
            self.stages["sedimentation"] = 0

        # --- Distribution pressure ---
        if self.distribution_pump and self.tank_level > 5:
            target_pressure = 55.0 + (self.tank_level - 50) * 0.3
            diff = target_pressure - self.distribution_pressure
            self.distribution_pressure += diff * 0.1 * dt + random.gauss(0, 0.5)
            self.distribution_pressure = max(0.0, min(100.0, self.distribution_pressure))
            self.stages["distribution"] = 1
        else:
            self.distribution_pressure *= (1 - 0.05 * dt)
            self.stages["distribution"] = 0

        # --- Alarm evaluation ---
        self.chemical_alarm = (
            self.chlorine_level > self.CHLORINE_DANGER
            or self.chlorine_level < self.CHLORINE_MIN * 0.5
            or self.ph_level < self.PH_MIN
            or self.ph_level > self.PH_MAX
        )

        self.pressure_alarm = (
            self.distribution_pressure < self.PRESSURE_MIN
            or self.distribution_pressure > self.PRESSURE_MAX
        )

        self.turbidity_alarm = self.turbidity > self.TURBIDITY_MAX

        # Update stage statuses based on alarm conditions
        if self.chlorine_level > self.CHLORINE_DANGER:
            self.stages["chlorination"] = 3  # critical
        elif self.chlorine_level > self.CHLORINE_MAX:
            self.stages["chlorination"] = 2  # warning

        if self.turbidity > self.TURBIDITY_MAX:
            self.stages["filtration"] = 3

    def get_state(self) -> dict:
        """Return current treatment plant state."""
        return {
            "chlorine_level": round(self.chlorine_level, 2),
            "ph_level": round(self.ph_level, 2),
            "turbidity": round(self.turbidity, 2),
            "tank_level": round(self.tank_level, 2),
            "distribution_pressure": round(self.distribution_pressure, 2),
            "intake_rate": round(self.intake_rate, 2),
            "intake_pump": self.intake_pump,
            "chemical_pump": self.chemical_pump,
            "distribution_pump": self.distribution_pump,
            "chlorine_dosing_rate": round(self.chlorine_dosing_rate, 2),
            "chemical_alarm": self.chemical_alarm,
            "pressure_alarm": self.pressure_alarm,
            "turbidity_alarm": self.turbidity_alarm,
            "stages": self.stages.copy(),
        }
