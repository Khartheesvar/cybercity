"""
Modbus register map definition.
Maps physical process parameters to Modbus register addresses.

INTENTIONALLY INSECURE: No authentication, no encryption.
This is realistic for many real-world ICS installations.
"""

# Holding Registers (read/write, 16-bit values)
# We scale float values to integers: multiply by 100 for 2 decimal places
HOLDING_REGISTERS = {
    0: {"name": "dam_water_level", "unit": "meters", "scale": 100, "range": (0, 100)},
    1: {"name": "dam_inflow_rate", "unit": "m³/s", "scale": 100, "range": (0, 500)},
    2: {"name": "dam_outflow_rate", "unit": "m³/s", "scale": 100, "range": (0, 500)},
    3: {"name": "dam_gate_position", "unit": "%", "scale": 100, "range": (0, 100)},
    4: {"name": "chlorine_dosing_rate", "unit": "ppm", "scale": 100, "range": (0, 50)},
    5: {"name": "ph_level", "unit": "pH", "scale": 100, "range": (0, 14)},
    6: {"name": "turbidity", "unit": "NTU", "scale": 100, "range": (0, 100)},
    7: {"name": "treatment_tank_level", "unit": "%", "scale": 100, "range": (0, 100)},
    8: {"name": "distribution_pressure", "unit": "PSI", "scale": 100, "range": (0, 100)},
}

# Coils (read/write, boolean values)
COILS = {
    0: {"name": "sluice_gate_command", "description": "Open/close sluice gate"},
    1: {"name": "intake_pump", "description": "Intake pump on/off"},
    2: {"name": "chemical_pump", "description": "Chemical dosing pump on/off"},
    3: {"name": "distribution_pump", "description": "Distribution pump on/off"},
    4: {"name": "high_level_alarm", "description": "Dam high water level alarm"},
    5: {"name": "chemical_alarm", "description": "Chemical level alarm"},
}

NUM_HOLDING_REGISTERS = 20  # Reserve 20 registers
NUM_COILS = 10              # Reserve 10 coils


def float_to_register(value: float, scale: int = 100) -> int:
    """Convert a float to a scaled integer for Modbus register."""
    return int(round(value * scale))


def register_to_float(value: int, scale: int = 100) -> float:
    """Convert a scaled Modbus register value back to float."""
    return value / scale
