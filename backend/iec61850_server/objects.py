"""
IEC 61850 Data Object Definitions for Northgate Substation IED.

Naming follows IEC 61850-7-4 standard:
  LD   = Logical Device   (SubstationLD)
  LN   = Logical Node     (XCBR1, MMXU1, PTRC1 …)
  DO   = Data Object      (Pos, Hz, TotW …)
  DA   = Data Attribute   (stVal, mag.f …)
  FC   = Functional Constraint (ST=status, MX=measurement, CO=control, CF=config)

Object reference format used in this server: {LN}.{DO}.{DA}
Examples:
  XCBR1.Pos.stVal          — CB1 position status (boolean, read-only)
  XCBR1.Pos.Oper.ctlVal    — CB1 position control (boolean, write — CO)
  MMXU1.Hz.mag.f           — Grid frequency (float, MX, read-only)
  PROT1.Beh.stVal          — Master protection enable (boolean, read/write)

Datasets:
  DS_STATUS      — all circuit breaker + transformer states
  DS_MEASUREMENTS — all analog measurements
  DS_PROTECTION  — all protection relay states
  DS_FULL        — everything
"""

# ── Object definitions ─────────────────────────────────────────────────────
#
# Format:  "ref": { "ln": str, "fc": str, "type": str, "writable": bool,
#                   "desc": str, "unit": str }
#
# FC values: ST=status, MX=measurement, CO=control, CF=config

OBJECTS: dict = {
    # ── Logical Node Zero (device info) ──────────────────────────────────
    "LLN0.NamPlt.swRev":    {"ln": "LLN0", "fc": "DC", "type": "string",  "writable": False,
                              "desc": "IED firmware version",        "unit": ""},
    "LLN0.NamPlt.vendor":   {"ln": "LLN0", "fc": "DC", "type": "string",  "writable": False,
                              "desc": "Vendor name",                  "unit": ""},
    "LLN0.NamPlt.model":    {"ln": "LLN0", "fc": "DC", "type": "string",  "writable": False,
                              "desc": "Device model",                 "unit": ""},
    "LLN0.Health.stVal":    {"ln": "LLN0", "fc": "ST", "type": "int",     "writable": False,
                              "desc": "Device health (1=OK,2=WARN,3=ALARM)", "unit": ""},

    # ── Circuit Breakers XCBR1–XCBR7 ─────────────────────────────────────
    **{f"XCBR{i}.Pos.stVal":          {"ln": f"XCBR{i}", "fc": "ST", "type": "bool", "writable": False,
                                        "desc": f"CB{i} position (true=CLOSED)", "unit": ""}
       for i in range(1, 8)},
    **{f"XCBR{i}.Pos.Oper.ctlVal":    {"ln": f"XCBR{i}", "fc": "CO", "type": "bool", "writable": True,
                                        "desc": f"CB{i} control (true=CLOSE, false=OPEN)", "unit": ""}
       for i in range(1, 8)},
    **{f"XCBR{i}.Pos.q":              {"ln": f"XCBR{i}", "fc": "ST", "type": "string", "writable": False,
                                        "desc": f"CB{i} quality flag", "unit": ""}
       for i in range(1, 8)},

    # ── Measurements MMXU1 (grid level) ──────────────────────────────────
    "MMXU1.Hz.mag.f":       {"ln": "MMXU1", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "Grid frequency",               "unit": "Hz"},
    "MMXU1.TotW.mag.f":     {"ln": "MMXU1", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "Total active power delivered", "unit": "MW"},
    "MMXU1.TotVAr.mag.f":   {"ln": "MMXU1", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "Total reactive power",         "unit": "MVAR"},
    "MMXU1.TotPF.mag.f":    {"ln": "MMXU1", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "Power factor",                 "unit": "pu"},

    # ── Bus voltages MMXU2 (HV) / MMXU3 (LV) ────────────────────────────
    "MMXU2.PhV.phsA.mag.f": {"ln": "MMXU2", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "230kV HV bus voltage",         "unit": "kV"},
    "MMXU3.PhV.phsA.mag.f": {"ln": "MMXU3", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "115kV LV bus voltage",         "unit": "kV"},

    # ── Transformer measurements ATCC1 (TX1) / ATCC2 (TX2) ──────────────
    "ATCC1.TrCurr.mag.f":   {"ln": "ATCC1", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "TX1 loading",                  "unit": "%"},
    "ATCC2.TrCurr.mag.f":   {"ln": "ATCC2", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "TX2 loading",                  "unit": "%"},
    "ATCC1.TrTmp.mag.f":    {"ln": "ATCC1", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "TX1 winding temperature",      "unit": "°C"},
    "ATCC2.TrTmp.mag.f":    {"ln": "ATCC2", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "TX2 winding temperature",      "unit": "°C"},
    "ATCC1.Beh.stVal":      {"ln": "ATCC1", "fc": "ST", "type": "bool",   "writable": False,
                              "desc": "TX1 in-service status",        "unit": ""},
    "ATCC2.Beh.stVal":      {"ln": "ATCC2", "fc": "ST", "type": "bool",   "writable": False,
                              "desc": "TX2 in-service status",        "unit": ""},

    # ── Protection relay enables (WRITABLE — attack targets) ─────────────
    "PROT1.Beh.stVal":      {"ln": "PROT1", "fc": "ST", "type": "bool",   "writable": True,
                              "desc": "Master protection relay enable", "unit": ""},
    "DFPT1.Beh.stVal":      {"ln": "DFPT1", "fc": "ST", "type": "bool",   "writable": True,
                              "desc": "87T Differential protection enable", "unit": ""},
    "OCPT1.Beh.stVal":      {"ln": "OCPT1", "fc": "ST", "type": "bool",   "writable": True,
                              "desc": "51 Overcurrent protection enable", "unit": ""},
    "UFPT1.Beh.stVal":      {"ln": "UFPT1", "fc": "ST", "type": "bool",   "writable": True,
                              "desc": "81L Under-frequency load shedding enable", "unit": ""},
    "RREC1.Beh.stVal":      {"ln": "RREC1", "fc": "ST", "type": "bool",   "writable": True,
                              "desc": "79 Auto-recloser enable",       "unit": ""},

    # ── Derived / computed status ─────────────────────────────────────────
    "CSWI1.Pos.stVal":      {"ln": "CSWI1", "fc": "ST", "type": "bool",   "writable": False,
                              "desc": "Grid blackout status",         "unit": ""},
    "CSWI1.GridStress.f":   {"ln": "CSWI1", "fc": "MX", "type": "float",  "writable": False,
                              "desc": "Grid stress index",            "unit": "%"},
}

# ── Datasets ───────────────────────────────────────────────────────────────
DATASETS: dict = {
    "DS_STATUS": [
        f"XCBR{i}.Pos.stVal" for i in range(1, 8)
    ] + [
        "ATCC1.Beh.stVal", "ATCC2.Beh.stVal",
        "CSWI1.Pos.stVal",
    ],
    "DS_MEASUREMENTS": [
        "MMXU1.Hz.mag.f", "MMXU1.TotW.mag.f", "MMXU1.TotVAr.mag.f", "MMXU1.TotPF.mag.f",
        "MMXU2.PhV.phsA.mag.f", "MMXU3.PhV.phsA.mag.f",
        "ATCC1.TrCurr.mag.f", "ATCC2.TrCurr.mag.f",
        "ATCC1.TrTmp.mag.f",  "ATCC2.TrTmp.mag.f",
        "CSWI1.GridStress.f",
    ],
    "DS_PROTECTION": [
        "PROT1.Beh.stVal", "DFPT1.Beh.stVal", "OCPT1.Beh.stVal",
        "UFPT1.Beh.stVal", "RREC1.Beh.stVal",
    ],
    "DS_FULL": list(OBJECTS.keys()),
}

# ── Static nameplate values ────────────────────────────────────────────────
NAMEPLATE = {
    "LLN0.NamPlt.swRev":  "v2.3.1",
    "LLN0.NamPlt.vendor": "GridTech Systems",
    "LLN0.NamPlt.model":  "GT-IED-2100",
}
