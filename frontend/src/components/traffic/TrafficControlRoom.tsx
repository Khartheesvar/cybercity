import { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { ValueDisplay } from "../shared/ValueDisplay";
import type { ProcessState } from "../../types/process";

interface TrafficControlRoomProps {
  state: ProcessState;
  sendCommand: (command: string, value?: number | boolean) => void;
}

interface TrendPoint {
  time: number;
  ns_queue: number;
  ew_queue: number;
  ns_wait: number;
  ew_wait: number;
  gridlock: number;
}

export function TrafficControlRoom({
  state,
  sendCommand,
}: TrafficControlRoomProps) {
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [nsGreenInput, setNsGreenInput] = useState("30");
  const [ewGreenInput, setEwGreenInput] = useState("30");
  const tickRef = useRef(0);

  const traffic = state.traffic;

  // Detect system reset
  const prevTickRef = useRef(state.tick);
  useEffect(() => {
    if (state.tick < prevTickRef.current) {
      setNsGreenInput("30");
      setEwGreenInput("30");
      setTrendData([]);
    }
    prevTickRef.current = state.tick;
  }, [state.tick]);

  // Accumulate trend data
  useEffect(() => {
    tickRef.current += 1;
    const point: TrendPoint = {
      time: tickRef.current,
      ns_queue: traffic.ns_queue,
      ew_queue: traffic.ew_queue,
      ns_wait: traffic.ns_wait_time,
      ew_wait: traffic.ew_wait_time,
      gridlock: traffic.gridlock_level,
    };
    setTrendData((prev) => [...prev.slice(-60), point]);
  }, [state.tick]);

  const hasAlarm =
    traffic.flash_mode ||
    traffic.conflict_detected ||
    traffic.gridlock_level > 60 ||
    traffic.preemption_active > 0;

  return (
    <div className="bg-gray-950 text-white p-4 h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-gray-200">
            SIGNAL CONTROLLER — HMI DASHBOARD
          </h1>
          <p className="text-sm font-mono text-gray-500">
            Tick: {state.tick} | Cycle: {traffic.cycle_count} | Vehicles:{" "}
            {traffic.total_vehicles_passed}
          </p>
        </div>
        <div
          className={`px-4 py-2 rounded font-mono text-sm font-bold ${
            hasAlarm
              ? "bg-red-900 text-red-300 animate-pulse"
              : "bg-green-900 text-green-300"
          }`}
        >
          {traffic.conflict_detected
            ? "CONFLICT DETECTED"
            : traffic.flash_mode
            ? "FLASH MODE"
            : hasAlarm
            ? "ALARM ACTIVE"
            : "SYSTEM NORMAL"}
        </div>
      </div>

      {/* Value displays */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <ValueDisplay
          label="N-S Queue"
          value={traffic.ns_queue}
          unit="cars"
          danger={traffic.ns_queue > 35}
          warning={traffic.ns_queue > 20}
        />
        <ValueDisplay
          label="E-W Queue"
          value={traffic.ew_queue}
          unit="cars"
          danger={traffic.ew_queue > 35}
          warning={traffic.ew_queue > 20}
        />
        <ValueDisplay
          label="N-S Wait"
          value={traffic.ns_wait_time}
          unit="s"
          danger={traffic.ns_wait_time > 60}
          warning={traffic.ns_wait_time > 30}
        />
        <ValueDisplay
          label="E-W Wait"
          value={traffic.ew_wait_time}
          unit="s"
          danger={traffic.ew_wait_time > 60}
          warning={traffic.ew_wait_time > 30}
        />
        <ValueDisplay
          label="Gridlock"
          value={traffic.gridlock_level}
          unit="%"
          danger={traffic.gridlock_level > 70}
          warning={traffic.gridlock_level > 40}
        />
        <ValueDisplay
          label="Phase Timer"
          value={traffic.phase_timer}
          unit="s"
        />
        <ValueDisplay
          label="N-S Green"
          value={traffic.ns_green_time}
          unit="s"
          danger={traffic.ns_green_time < 10 || traffic.ns_green_time > 90}
          warning={traffic.ns_green_time < 15 || traffic.ns_green_time > 60}
        />
        <ValueDisplay
          label="E-W Green"
          value={traffic.ew_green_time}
          unit="s"
          danger={traffic.ew_green_time < 10 || traffic.ew_green_time > 90}
          warning={traffic.ew_green_time < 15 || traffic.ew_green_time > 60}
        />
        <ValueDisplay
          label="N-S Light"
          value={traffic.ns_light.toUpperCase()}
          unit=""
        />
        <ValueDisplay
          label="E-W Light"
          value={traffic.ew_light.toUpperCase()}
          unit=""
        />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <h3 className="text-xs text-gray-400 font-mono mb-2">
            QUEUE LENGTH TREND
          </h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 50]} stroke="#6b7280" fontSize={10} />
              <Line
                type="monotone"
                dataKey="ns_queue"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
                name="N-S Queue"
              />
              <Line
                type="monotone"
                dataKey="ew_queue"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
                name="E-W Queue"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <h3 className="text-xs text-gray-400 font-mono mb-2">
            GRIDLOCK & WAIT TIME TREND
          </h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={10} />
              <Line
                type="monotone"
                dataKey="gridlock"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Gridlock %"
              />
              <Line
                type="monotone"
                dataKey="ns_wait"
                stroke="#60a5fa"
                strokeWidth={1}
                dot={false}
                name="N-S Wait"
                strokeDasharray="4 2"
              />
              <Line
                type="monotone"
                dataKey="ew_wait"
                stroke="#a78bfa"
                strokeWidth={1}
                dot={false}
                name="E-W Wait"
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Controls + Status */}
      <div className="grid grid-cols-3 gap-3">
        {/* Alarm Panel */}
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <h3 className="text-xs text-gray-400 font-mono mb-3">
            ALARM PANEL
          </h3>
          <div className="space-y-2">
            {[
              { label: "Conflict Detected", active: traffic.conflict_detected },
              { label: "Flash Mode", active: traffic.flash_mode },
              { label: "Preemption Active", active: traffic.preemption_active > 0 },
              { label: "High Gridlock", active: traffic.gridlock_level > 40 },
              { label: "N-S Queue Full", active: traffic.ns_queue > 40 },
              { label: "E-W Queue Full", active: traffic.ew_queue > 40 },
              { label: "Abnormal Timing", active: traffic.ns_green_time < 10 || traffic.ns_green_time > 90 || traffic.ew_green_time < 10 || traffic.ew_green_time > 90 },
            ].map(({ label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2 text-xs font-mono px-2 py-1 rounded ${
                  active
                    ? "bg-red-900/50 text-red-300"
                    : "text-gray-600"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    active ? "bg-red-500 animate-pulse" : "bg-gray-700"
                  }`}
                />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Timing Controls */}
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <h3 className="text-xs text-gray-400 font-mono mb-3">
            TIMING CONTROLS
          </h3>
          <div className="space-y-3">
            {/* N-S Green Time */}
            <div>
              <label className="text-xs text-gray-500 font-mono">
                N-S Green Time (seconds)
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  value={nsGreenInput}
                  onChange={(e) => setNsGreenInput(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm font-mono text-white w-20"
                  min={5}
                  max={120}
                />
                <button
                  onClick={() =>
                    sendCommand("set_ns_green", parseFloat(nsGreenInput))
                  }
                  className="bg-blue-800 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-mono"
                >
                  SET
                </button>
              </div>
            </div>

            {/* E-W Green Time */}
            <div>
              <label className="text-xs text-gray-500 font-mono">
                E-W Green Time (seconds)
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  value={ewGreenInput}
                  onChange={(e) => setEwGreenInput(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm font-mono text-white w-20"
                  min={5}
                  max={120}
                />
                <button
                  onClick={() =>
                    sendCommand("set_ew_green", parseFloat(ewGreenInput))
                  }
                  className="bg-blue-800 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-mono"
                >
                  SET
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Controls */}
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <h3 className="text-xs text-gray-400 font-mono mb-3">
            MODE CONTROLS
          </h3>
          <div className="space-y-2">
            {/* Phase Hold */}
            <div>
              <label className="text-xs text-gray-500 font-mono">
                Phase Hold
              </label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {[
                  { label: "OFF", value: 0 },
                  { label: "P1", value: 1 },
                  { label: "P2", value: 2 },
                  { label: "P3", value: 3 },
                  { label: "P4", value: 4 },
                  { label: "P5", value: 5 },
                  { label: "P6", value: 6 },
                ].map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => sendCommand("set_phase_hold", value)}
                    className={`px-2 py-1 rounded text-xs font-mono ${
                      traffic.phase_hold === value
                        ? "bg-amber-800 text-amber-200 border border-amber-600"
                        : "bg-gray-800 text-gray-500 border border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preemption */}
            <div className="mt-2">
              <label className="text-xs text-gray-500 font-mono">
                Emergency Preemption
              </label>
              <div className="flex gap-1 mt-1">
                {[
                  { label: "OFF", value: 0 },
                  { label: "N-S", value: 1 },
                  { label: "E-W", value: 2 },
                ].map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => sendCommand("set_preemption", value)}
                    className={`px-3 py-1 rounded text-xs font-mono ${
                      traffic.preemption_active === value
                        ? "bg-orange-800 text-orange-200 border border-orange-600"
                        : "bg-gray-800 text-gray-500 border border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conflict Monitor */}
            <div className="mt-2">
              <button
                onClick={() => sendCommand("toggle_conflict_monitor")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded font-mono text-xs ${
                  traffic.conflict_monitor_enabled
                    ? "bg-green-900/50 text-green-300 border border-green-800"
                    : "bg-red-900/50 text-red-300 border border-red-800"
                }`}
              >
                <span>Conflict Monitor</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    traffic.conflict_monitor_enabled
                      ? "bg-green-800 text-green-200"
                      : "bg-red-800 text-red-200"
                  }`}
                >
                  {traffic.conflict_monitor_enabled ? "ENABLED" : "DISABLED"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
