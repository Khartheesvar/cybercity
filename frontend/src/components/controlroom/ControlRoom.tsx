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

interface ControlRoomProps {
  state: ProcessState;
  sendCommand: (command: string, value?: number | boolean) => void;
}

interface TrendPoint {
  time: number;
  water_level: number;
  chlorine: number;
  ph: number;
  pressure: number;
}

export function ControlRoom({ state, sendCommand }: ControlRoomProps) {
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [gateInput, setGateInput] = useState("40");
  const [chlorineInput, setChlorineInput] = useState("2.5");
  const tickRef = useRef(0);

  // Detect system reset (tick goes backwards) and reset UI inputs + trend data
  const prevTickRef = useRef(state.tick);
  useEffect(() => {
    if (state.tick < prevTickRef.current) {
      setGateInput("40");
      setChlorineInput("2.5");
      setTrendData([]);
    }
    prevTickRef.current = state.tick;
  }, [state.tick]);

  // Accumulate trend data
  useEffect(() => {
    tickRef.current += 1;
    const point: TrendPoint = {
      time: tickRef.current,
      water_level: state.dam.water_level,
      chlorine: state.plant.chlorine_level,
      ph: state.plant.ph_level,
      pressure: state.plant.distribution_pressure,
    };
    setTrendData((prev) => [...prev.slice(-60), point]); // Keep last 60 points (~30s)
  }, [state.tick]);

  const dam = state.dam;
  const plant = state.plant;

  const hasAlarm =
    dam.high_level_alarm ||
    dam.low_level_alarm ||
    dam.overflow ||
    plant.chemical_alarm ||
    plant.pressure_alarm ||
    plant.turbidity_alarm;

  return (
    <div className="bg-gray-950 text-white p-4 h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-gray-200">
            CONTROL ROOM — HMI DASHBOARD
          </h1>
          <p className="text-sm font-mono text-gray-500">
            Tick: {state.tick} | Uptime: {state.uptime}s
          </p>
        </div>
        <div
          className={`px-4 py-2 rounded font-mono text-sm font-bold ${
            hasAlarm
              ? "bg-red-900 text-red-300 animate-pulse"
              : "bg-green-900 text-green-300"
          }`}
        >
          {hasAlarm ? "ALARM ACTIVE" : "SYSTEM NORMAL"}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-4">
        {/* Dam values */}
        <ValueDisplay
          label="Water Level"
          value={dam.water_level}
          unit="m"
          danger={dam.high_level_alarm || dam.low_level_alarm}
          warning={dam.water_level > 70 || dam.water_level < 30}
        />
        <ValueDisplay
          label="Gate Position"
          value={dam.gate_position}
          unit="%"
          danger={dam.gate_position > 90 || dam.gate_position < 5}
          warning={dam.gate_position > 75 || dam.gate_position < 15}
        />
        <ValueDisplay
          label="Inflow"
          value={dam.inflow_rate}
          unit="m³/s"
        />
        <ValueDisplay
          label="Outflow"
          value={dam.outflow_rate}
          unit="m³/s"
          danger={dam.outflow_rate > 250 || dam.outflow_rate < 10}
          warning={dam.outflow_rate > 200 || dam.outflow_rate < 30}
        />
        <ValueDisplay
          label="Net Flow"
          value={dam.inflow_rate - dam.outflow_rate}
          unit="m³/s"
          danger={Math.abs(dam.inflow_rate - dam.outflow_rate) > 80}
          warning={Math.abs(dam.inflow_rate - dam.outflow_rate) > 50}
        />

        {/* Treatment plant values */}
        <ValueDisplay
          label="Chlorine"
          value={plant.chlorine_level}
          unit="ppm"
          danger={plant.chlorine_level > 8}
          warning={plant.chlorine_level > 4}
        />
        <ValueDisplay
          label="pH Level"
          value={plant.ph_level}
          unit="pH"
          danger={plant.ph_level < 6.5 || plant.ph_level > 8.5}
        />
        <ValueDisplay
          label="Turbidity"
          value={plant.turbidity}
          unit="NTU"
          danger={plant.turbidity > 5}
        />
        <ValueDisplay
          label="Tank Level"
          value={plant.tank_level}
          unit="%"
          warning={plant.tank_level > 90 || plant.tank_level < 10}
        />
        <ValueDisplay
          label="Pressure"
          value={plant.distribution_pressure}
          unit="PSI"
          danger={plant.distribution_pressure < 40 || plant.distribution_pressure > 80}
        />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <h3 className="text-xs text-gray-400 font-mono mb-2">
            WATER LEVEL & PRESSURE TREND
          </h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={10} />
              <Line
                type="monotone"
                dataKey="water_level"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Water Level"
              />
              <Line
                type="monotone"
                dataKey="pressure"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name="Pressure"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <h3 className="text-xs text-gray-400 font-mono mb-2">
            CHEMICAL LEVELS TREND
          </h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" hide />
              <YAxis
                yAxisId="ph"
                domain={[0, 14]}
                stroke="#a855f7"
                fontSize={10}
                label={{ value: "pH", position: "insideTopLeft", fill: "#a855f7", fontSize: 9 }}
              />
              <YAxis
                yAxisId="chlorine"
                orientation="right"
                domain={[0, 25]}
                stroke="#f59e0b"
                fontSize={10}
                label={{ value: "ppm", position: "insideTopRight", fill: "#f59e0b", fontSize: 9 }}
              />
              <Line
                type="monotone"
                dataKey="chlorine"
                yAxisId="chlorine"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                name="Chlorine (ppm)"
              />
              <Line
                type="monotone"
                dataKey="ph"
                yAxisId="ph"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                name="pH"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alarm Panel + Manual Controls */}
      <div className="grid grid-cols-3 gap-3">
        {/* Alarm Panel */}
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <h3 className="text-xs text-gray-400 font-mono mb-3">
            ALARM PANEL
          </h3>
          <div className="space-y-2">
            {[
              { label: "Dam High Level", active: dam.high_level_alarm },
              { label: "Dam Overflow", active: dam.overflow },
              { label: "Dam Low Level", active: dam.low_level_alarm },
              { label: "Chemical Level", active: plant.chemical_alarm },
              { label: "Low Pressure", active: plant.pressure_alarm },
              { label: "High Turbidity", active: plant.turbidity_alarm },
              { label: "Spillway Active", active: dam.spillway_active },
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

        {/* Manual Controls */}
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <h3 className="text-xs text-gray-400 font-mono mb-3">
            MANUAL CONTROLS
          </h3>
          <div className="space-y-3">
            {/* Gate control */}
            <div>
              <label className="text-xs text-gray-500 font-mono">
                Sluice Gate (%)
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  value={gateInput}
                  onChange={(e) => setGateInput(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm font-mono text-white w-20"
                  min={0}
                  max={100}
                />
                <button
                  onClick={() =>
                    sendCommand("set_gate", parseFloat(gateInput))
                  }
                  className="bg-blue-800 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-mono"
                >
                  SET
                </button>
              </div>
            </div>

            {/* Chlorine dosing */}
            <div>
              <label className="text-xs text-gray-500 font-mono">
                Chlorine Dosing (ppm)
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  value={chlorineInput}
                  onChange={(e) => setChlorineInput(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm font-mono text-white w-20"
                  min={0}
                  max={10}
                  step={0.5}
                />
                <button
                  onClick={() =>
                    sendCommand(
                      "set_chlorine_dosing",
                      parseFloat(chlorineInput)
                    )
                  }
                  className="bg-blue-800 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-mono"
                >
                  SET
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pump Status */}
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <h3 className="text-xs text-gray-400 font-mono mb-3">
            PUMP CONTROLS
          </h3>
          <div className="space-y-2">
            {[
              {
                label: "Intake Pump",
                active: plant.intake_pump,
                command: "toggle_intake_pump",
              },
              {
                label: "Chemical Pump",
                active: plant.chemical_pump,
                command: "toggle_chemical_pump",
              },
              {
                label: "Distribution Pump",
                active: plant.distribution_pump,
                command: "toggle_distribution_pump",
              },
            ].map(({ label, active, command }) => (
              <button
                key={command}
                onClick={() => sendCommand(command)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded font-mono text-xs ${
                  active
                    ? "bg-green-900/50 text-green-300 border border-green-800"
                    : "bg-gray-800 text-gray-500 border border-gray-700"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    active
                      ? "bg-green-800 text-green-200"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {active ? "ON" : "OFF"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
