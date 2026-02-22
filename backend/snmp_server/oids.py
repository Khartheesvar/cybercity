"""
SNMP OID definitions for the Traffic Light Controller.
Simplified NTCIP 1202-inspired OID tree for educational purposes.

Base OID: 1.3.6.1.4.1.99999.1 (custom enterprise)

INTENTIONALLY VULNERABLE:
- Default community strings: "public" (read), "private" (read-write)
- No SNMPv3 (no encryption, no real auth)
- This mirrors real-world traffic controller deployments
"""

# Base OID for our traffic controller (enterprise OID)
BASE_OID = (1, 3, 6, 1, 4, 1, 99999, 1)

# Helper to build full OID tuples
def _oid(*suffix):
    return BASE_OID + suffix


# ─── OID Registry ──────────────────────────────────────────────
# Each entry: (oid_tuple, name, writable, default_value, description)

OID_REGISTRY = {
    # Phase Control (read-only sensor values)
    _oid(1, 1, 0): {
        "name": "current_phase",
        "writable": False,
        "default": 1,
        "description": "Current phase (1=NS_GREEN, 2=NS_YELLOW, 3=ALL_RED, 4=EW_GREEN, 5=EW_YELLOW, 6=ALL_RED)",
    },
    _oid(1, 2, 0): {
        "name": "ns_light",
        "writable": False,
        "default": 3,
        "description": "N-S light state (1=red, 2=yellow, 3=green)",
    },
    _oid(1, 3, 0): {
        "name": "ew_light",
        "writable": False,
        "default": 1,
        "description": "E-W light state (1=red, 2=yellow, 3=green)",
    },
    _oid(1, 4, 0): {
        "name": "phase_timer",
        "writable": False,
        "default": 30,
        "description": "Seconds remaining in current phase",
    },

    # Vehicle Data (read-only)
    _oid(2, 1, 0): {
        "name": "ns_queue",
        "writable": False,
        "default": 0,
        "description": "N-S vehicle queue length",
    },
    _oid(2, 2, 0): {
        "name": "ew_queue",
        "writable": False,
        "default": 0,
        "description": "E-W vehicle queue length",
    },
    _oid(2, 3, 0): {
        "name": "ns_avg_wait",
        "writable": False,
        "default": 0,
        "description": "N-S average wait time (seconds)",
    },
    _oid(2, 4, 0): {
        "name": "ew_avg_wait",
        "writable": False,
        "default": 0,
        "description": "E-W average wait time (seconds)",
    },

    # Pedestrian (read-only)
    _oid(3, 1, 0): {
        "name": "ns_pedestrian",
        "writable": False,
        "default": 1,
        "description": "N-S pedestrian signal (1=walk, 2=stop)",
    },
    _oid(3, 2, 0): {
        "name": "ew_pedestrian",
        "writable": False,
        "default": 2,
        "description": "E-W pedestrian signal (1=walk, 2=stop)",
    },

    # Statistics (read-only)
    _oid(4, 1, 0): {
        "name": "total_vehicles_passed",
        "writable": False,
        "default": 0,
        "description": "Total vehicles through intersection",
    },
    _oid(4, 2, 0): {
        "name": "gridlock_level",
        "writable": False,
        "default": 0,
        "description": "Gridlock level (0-100)",
    },

    # Safety (read-only status)
    _oid(5, 2, 0): {
        "name": "flash_mode",
        "writable": False,
        "default": 0,
        "description": "Flash mode active (0=normal, 1=flashing)",
    },
    _oid(5, 3, 0): {
        "name": "conflict_detected",
        "writable": False,
        "default": 0,
        "description": "Conflict detected (0=no, 1=yes — DANGER)",
    },

    # ─── Writable OIDs (attackable with 'private' community) ───

    _oid(6, 1, 0): {
        "name": "ns_green_time",
        "writable": True,
        "default": 30,
        "description": "N-S green duration in seconds (default 30)",
    },
    _oid(6, 2, 0): {
        "name": "ew_green_time",
        "writable": True,
        "default": 30,
        "description": "E-W green duration in seconds (default 30)",
    },
    _oid(7, 1, 0): {
        "name": "phase_hold",
        "writable": True,
        "default": 0,
        "description": "Hold phase (0=off, 1-6=hold at specific phase)",
    },
    _oid(8, 1, 0): {
        "name": "preemption_active",
        "writable": True,
        "default": 0,
        "description": "Emergency preemption (0=off, 1=NS priority, 2=EW priority)",
    },
    _oid(9, 1, 0): {
        "name": "conflict_monitor_enabled",
        "writable": True,
        "default": 1,
        "description": "Conflict monitor (1=enabled, 0=disabled — DANGEROUS)",
    },
}

# Sorted OID list for GETNEXT/WALK operations
SORTED_OIDS = sorted(OID_REGISTRY.keys())

# Quick lookup: name -> OID tuple
NAME_TO_OID = {v["name"]: k for k, v in OID_REGISTRY.items()}

# Light state encoding
LIGHT_STATE_MAP = {"red": 1, "yellow": 2, "green": 3}
PEDESTRIAN_STATE_MAP = {"walk": 1, "stop": 2}
