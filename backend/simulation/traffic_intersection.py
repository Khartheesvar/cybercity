"""
Traffic Intersection simulation.
Models a 4-way intersection with phase cycling, vehicle queues,
pedestrian signals, emergency preemption, and conflict monitoring.

Based on NTCIP 1202 signal controller concepts for educational purposes.
"""

import random


class TrafficIntersectionSimulation:
    # Phase constants
    PHASE_NS_GREEN = 1
    PHASE_NS_YELLOW = 2
    PHASE_ALL_RED_1 = 3
    PHASE_EW_GREEN = 4
    PHASE_EW_YELLOW = 5
    PHASE_ALL_RED_2 = 6

    YELLOW_TIME = 5.0    # seconds (fixed)
    ALL_RED_TIME = 2.0   # seconds (fixed)
    MAX_QUEUE = 50       # max cars per direction

    def __init__(self):
        self.reset()

    def reset(self):
        """Reset intersection to safe defaults."""
        # Phase cycling
        self.current_phase = self.PHASE_NS_GREEN
        self.phase_timer = 30.0          # countdown for current phase

        # Timing parameters (attackable via SNMP)
        self.ns_green_time = 30.0        # seconds
        self.ew_green_time = 30.0        # seconds

        # Light states
        self.ns_light = "green"          # red, yellow, green
        self.ew_light = "red"

        # Pedestrian signals
        self.ns_pedestrian = "walk"      # walk, stop
        self.ew_pedestrian = "stop"

        # Vehicle queues
        self.ns_queue = 0
        self.ew_queue = 0
        self.ns_wait_time = 0.0          # average wait seconds
        self.ew_wait_time = 0.0

        # Attack-controllable
        self.phase_hold = 0              # 0=off, 1-6=hold at phase N
        self.preemption_active = 0       # 0=off, 1=NS priority, 2=EW priority
        self.conflict_monitor_enabled = True

        # Safety states
        self.flash_mode = False
        self.conflict_detected = False

        # Statistics
        self.gridlock_level = 0.0        # 0-100
        self.total_vehicles_passed = 0
        self.cycle_count = 0

        # How long each direction has been continuously red
        self._ns_red_elapsed = 0.0
        self._ew_red_elapsed = 0.0

    def _get_phase_duration(self, phase: int) -> float:
        """Get duration for a given phase."""
        if phase == self.PHASE_NS_GREEN:
            return self.ns_green_time
        elif phase == self.PHASE_EW_GREEN:
            return self.ew_green_time
        elif phase in (self.PHASE_NS_YELLOW, self.PHASE_EW_YELLOW):
            return self.YELLOW_TIME
        else:  # ALL_RED phases
            return self.ALL_RED_TIME

    def _update_lights(self):
        """Set light and pedestrian states based on current phase."""
        if self.flash_mode:
            # Flash mode: all lights flash red (simulated as all red)
            self.ns_light = "red"
            self.ew_light = "red"
            self.ns_pedestrian = "stop"
            self.ew_pedestrian = "stop"
            return

        # Check for conflicting demands: phase hold wants one direction,
        # preemption wants the opposite → both get green (dangerous!)
        if self.preemption_active > 0 and self.phase_hold > 0:
            hold_wants_ns = self.phase_hold in (self.PHASE_NS_GREEN, self.PHASE_NS_YELLOW)
            hold_wants_ew = self.phase_hold in (self.PHASE_EW_GREEN, self.PHASE_EW_YELLOW)
            preempt_wants_ew = self.preemption_active == 2
            preempt_wants_ns = self.preemption_active == 1
            if (hold_wants_ns and preempt_wants_ew) or (hold_wants_ew and preempt_wants_ns):
                # Conflicting commands → both directions get green
                self.ns_light = "green"
                self.ew_light = "green"
                self.ns_pedestrian = "walk"
                self.ew_pedestrian = "walk"
                return

        if self.preemption_active == 1:
            self.ns_light = "green"
            self.ew_light = "red"
            self.ns_pedestrian = "walk"
            self.ew_pedestrian = "stop"
            return
        elif self.preemption_active == 2:
            self.ns_light = "red"
            self.ew_light = "green"
            self.ns_pedestrian = "stop"
            self.ew_pedestrian = "walk"
            return

        phase = self.current_phase
        if phase == self.PHASE_NS_GREEN:
            self.ns_light = "green"
            self.ew_light = "red"
            self.ns_pedestrian = "walk"
            self.ew_pedestrian = "stop"
        elif phase == self.PHASE_NS_YELLOW:
            self.ns_light = "yellow"
            self.ew_light = "red"
            self.ns_pedestrian = "stop"
            self.ew_pedestrian = "stop"
        elif phase == self.PHASE_ALL_RED_1:
            self.ns_light = "red"
            self.ew_light = "red"
            self.ns_pedestrian = "stop"
            self.ew_pedestrian = "stop"
        elif phase == self.PHASE_EW_GREEN:
            self.ns_light = "red"
            self.ew_light = "green"
            self.ns_pedestrian = "stop"
            self.ew_pedestrian = "walk"
        elif phase == self.PHASE_EW_YELLOW:
            self.ns_light = "red"
            self.ew_light = "yellow"
            self.ns_pedestrian = "stop"
            self.ew_pedestrian = "stop"
        elif phase == self.PHASE_ALL_RED_2:
            self.ns_light = "red"
            self.ew_light = "red"
            self.ns_pedestrian = "stop"
            self.ew_pedestrian = "stop"

    def tick(self, dt: float = 0.5):
        """Advance intersection simulation by dt seconds."""
        # --- Conflict detection ---
        # Check if attacker forced both directions green
        if self.ns_light == "green" and self.ew_light == "green":
            if self.conflict_monitor_enabled:
                self.flash_mode = True
                self.conflict_detected = False
            else:
                self.conflict_detected = True
                self.flash_mode = False
        else:
            self.conflict_detected = False
            # Only clear flash mode if conflict monitor caught it
            # Flash mode persists until conflict condition is removed
            if self.flash_mode and not (self.ns_light == "green" and self.ew_light == "green"):
                self.flash_mode = False

        # --- Phase cycling ---
        if not self.flash_mode and self.preemption_active == 0:
            if self.phase_hold > 0 and self.phase_hold == self.current_phase:
                # Phase held — don't advance timer
                pass
            else:
                self.phase_timer -= dt
                if self.phase_timer <= 0:
                    # Advance to next phase
                    self.current_phase = (self.current_phase % 6) + 1
                    self.phase_timer = self._get_phase_duration(self.current_phase)

                    # Count completed cycles
                    if self.current_phase == self.PHASE_NS_GREEN:
                        self.cycle_count += 1

        # Update light states based on current phase/preemption/flash
        self._update_lights()

        # --- Vehicle arrival ---
        # Cars arrive randomly (~1.5 per second per direction)
        ns_arrivals = max(0, int(random.gauss(1.5 * dt, 0.5 * dt)))
        ew_arrivals = max(0, int(random.gauss(1.5 * dt, 0.5 * dt)))
        self.ns_queue = min(self.MAX_QUEUE, self.ns_queue + ns_arrivals)
        self.ew_queue = min(self.MAX_QUEUE, self.ew_queue + ew_arrivals)

        # --- Vehicle clearing ---
        # During green, ~2 cars per second clear the intersection
        if self.ns_light == "green" and self.ns_queue > 0:
            cleared = min(self.ns_queue, max(1, int(2.0 * dt + random.gauss(0, 0.3))))
            self.ns_queue -= cleared
            self.total_vehicles_passed += cleared

        if self.ew_light == "green" and self.ew_queue > 0:
            cleared = min(self.ew_queue, max(1, int(2.0 * dt + random.gauss(0, 0.3))))
            self.ew_queue -= cleared
            self.total_vehicles_passed += cleared

        # --- Wait time tracking ---
        # Track how long each direction has been continuously red
        if self.ns_light != "green":
            self._ns_red_elapsed += dt
        else:
            self._ns_red_elapsed = max(0, self._ns_red_elapsed - dt * 2)

        if self.ew_light != "green":
            self._ew_red_elapsed += dt
        else:
            self._ew_red_elapsed = max(0, self._ew_red_elapsed - dt * 2)

        # Average wait ≈ half the red duration (cars arrive throughout)
        self.ns_wait_time = round(self._ns_red_elapsed / 2, 1) if self.ns_queue > 0 else 0.0
        self.ew_wait_time = round(self._ew_red_elapsed / 2, 1) if self.ew_queue > 0 else 0.0

        # --- Gridlock level ---
        # 0-100 based on total queue relative to capacity
        total_queue = self.ns_queue + self.ew_queue
        self.gridlock_level = min(100.0, (total_queue / (self.MAX_QUEUE * 2)) * 100)

    def get_state(self) -> dict:
        """Return current intersection state."""
        return {
            "current_phase": self.current_phase,
            "phase_timer": round(self.phase_timer, 1),
            "ns_green_time": round(self.ns_green_time, 1),
            "ew_green_time": round(self.ew_green_time, 1),
            "ns_light": self.ns_light,
            "ew_light": self.ew_light,
            "ns_pedestrian": self.ns_pedestrian,
            "ew_pedestrian": self.ew_pedestrian,
            "ns_queue": self.ns_queue,
            "ew_queue": self.ew_queue,
            "ns_wait_time": round(self.ns_wait_time, 1),
            "ew_wait_time": round(self.ew_wait_time, 1),
            "phase_hold": self.phase_hold,
            "preemption_active": self.preemption_active,
            "conflict_monitor_enabled": self.conflict_monitor_enabled,
            "flash_mode": self.flash_mode,
            "conflict_detected": self.conflict_detected,
            "gridlock_level": round(self.gridlock_level, 1),
            "total_vehicles_passed": self.total_vehicles_passed,
            "cycle_count": self.cycle_count,
        }
