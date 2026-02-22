import { useState, useEffect } from "react";
import { socket } from "../socket";
import type { ProcessState, ProcessUpdate } from "../types/process";

const DEFAULT_DAM: ProcessState["dam"] = {
  water_level: 50,
  inflow_rate: 120,
  outflow_rate: 120,
  gate_position: 40,
  gate_target: 40,
  spillway_active: false,
  high_level_alarm: false,
  low_level_alarm: false,
  overflow: false,
};

const DEFAULT_PLANT: ProcessState["plant"] = {
  chlorine_level: 2.5,
  ph_level: 7.2,
  turbidity: 1.5,
  tank_level: 60,
  distribution_pressure: 55,
  intake_rate: 120,
  intake_pump: true,
  chemical_pump: true,
  distribution_pump: true,
  chlorine_dosing_rate: 2.5,
  chemical_alarm: false,
  pressure_alarm: false,
  turbidity_alarm: false,
  stages: {
    intake: 1,
    coagulation: 1,
    sedimentation: 1,
    filtration: 1,
    chlorination: 1,
    distribution: 1,
  },
};

const DEFAULT_TRAFFIC: ProcessState["traffic"] = {
  current_phase: 1,
  phase_timer: 30,
  ns_green_time: 30,
  ew_green_time: 30,
  ns_light: "green",
  ew_light: "red",
  ns_pedestrian: "walk",
  ew_pedestrian: "stop",
  ns_queue: 0,
  ew_queue: 0,
  ns_wait_time: 0,
  ew_wait_time: 0,
  phase_hold: 0,
  preemption_active: 0,
  conflict_monitor_enabled: true,
  flash_mode: false,
  conflict_detected: false,
  gridlock_level: 0,
  total_vehicles_passed: 0,
  cycle_count: 0,
};

const DEFAULT_STATE: ProcessState = {
  dam: DEFAULT_DAM,
  plant: DEFAULT_PLANT,
  traffic: DEFAULT_TRAFFIC,
  tick: 0,
  uptime: 0,
};

export function useProcessData() {
  const [displayed, setDisplayed] = useState<ProcessState>(DEFAULT_STATE);
  const [actual, setActual] = useState<ProcessState>(DEFAULT_STATE);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onProcessUpdate(data: ProcessUpdate) {
      setDisplayed({
        ...DEFAULT_STATE,
        ...data.displayed,
        traffic: { ...DEFAULT_TRAFFIC, ...data.displayed?.traffic },
      });
      setActual({
        ...DEFAULT_STATE,
        ...data.actual,
        traffic: { ...DEFAULT_TRAFFIC, ...data.actual?.traffic },
      });
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("process_update", onProcessUpdate);

    // Check if already connected
    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("process_update", onProcessUpdate);
    };
  }, []);

  const sendCommand = (command: string, value?: number | boolean) => {
    socket.emit("manual_control", { command, value });
  };

  return { displayed, actual, connected, sendCommand };
}
