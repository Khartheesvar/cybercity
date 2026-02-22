/** Dam simulation state */
export interface DamState {
  water_level: number;
  inflow_rate: number;
  outflow_rate: number;
  gate_position: number;
  gate_target: number;
  spillway_active: boolean;
  high_level_alarm: boolean;
  low_level_alarm: boolean;
  overflow: boolean;
}

/** Treatment plant stage status: 0=offline, 1=normal, 2=warning, 3=critical */
export type StageStatus = 0 | 1 | 2 | 3;

/** Treatment plant simulation state */
export interface PlantState {
  chlorine_level: number;
  ph_level: number;
  turbidity: number;
  tank_level: number;
  distribution_pressure: number;
  intake_rate: number;
  intake_pump: boolean;
  chemical_pump: boolean;
  distribution_pump: boolean;
  chlorine_dosing_rate: number;
  chemical_alarm: boolean;
  pressure_alarm: boolean;
  turbidity_alarm: boolean;
  stages: Record<string, StageStatus>;
}

/** Traffic intersection simulation state */
export interface TrafficState {
  current_phase: number;
  phase_timer: number;
  ns_green_time: number;
  ew_green_time: number;
  ns_light: "red" | "yellow" | "green";
  ew_light: "red" | "yellow" | "green";
  ns_pedestrian: "walk" | "stop";
  ew_pedestrian: "walk" | "stop";
  ns_queue: number;
  ew_queue: number;
  ns_wait_time: number;
  ew_wait_time: number;
  phase_hold: number;
  preemption_active: number;
  conflict_monitor_enabled: boolean;
  flash_mode: boolean;
  conflict_detected: boolean;
  gridlock_level: number;
  total_vehicles_passed: number;
  cycle_count: number;
}

/** Full process state from backend */
export interface ProcessState {
  dam: DamState;
  plant: PlantState;
  traffic: TrafficState;
  tick: number;
  uptime: number;
}

/** WebSocket update payload */
export interface ProcessUpdate {
  displayed: ProcessState;
  actual: ProcessState;
}

/** Attack phase */
export type AttackPhase = "idle" | "recon" | "eavesdrop" | "register_write";

/** Recon result */
export interface ReconResult {
  phase: string;
  message: string;
  holding_registers: Record<string, {
    name: string;
    unit: string;
    raw_value: number;
    value: number;
  }>;
  coils: Record<string, {
    name: string;
    description: string;
    value: boolean;
  }>;
}
