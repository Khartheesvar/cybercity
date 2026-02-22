import { Stage, Layer, Rect, Line, Text, Group, Circle } from "react-konva";
import { useState, useEffect, useRef } from "react";
import type { TrafficState } from "../../types/process";

interface IntersectionViewProps {
  traffic: TrafficState;
}

const LIGHT_COLORS = {
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
};

const LIGHT_DIM = {
  red: "#3b1111",
  yellow: "#3b3511",
  green: "#113b19",
};

/** Single traffic light (3 circles stacked vertically) */
function TrafficLight({
  x,
  y,
  state,
  flash,
  label,
}: {
  x: number;
  y: number;
  state: "red" | "yellow" | "green";
  flash: boolean;
  label: string;
}) {
  const [flashOn, setFlashOn] = useState(true);

  useEffect(() => {
    if (!flash) {
      setFlashOn(true);
      return;
    }
    const interval = setInterval(() => setFlashOn((p) => !p), 500);
    return () => clearInterval(interval);
  }, [flash]);

  const activeState = flash ? (flashOn ? "red" : "red") : state;
  const showRed = flash ? flashOn : activeState === "red";

  return (
    <Group x={x} y={y}>
      {/* Housing */}
      <Rect
        x={-12}
        y={-5}
        width={24}
        height={62}
        fill="#1e293b"
        stroke="#475569"
        strokeWidth={1}
        cornerRadius={4}
      />
      {/* Red */}
      <Circle
        x={0}
        y={8}
        radius={8}
        fill={
          flash
            ? flashOn
              ? LIGHT_COLORS.red
              : LIGHT_DIM.red
            : activeState === "red"
            ? LIGHT_COLORS.red
            : LIGHT_DIM.red
        }
        shadowColor={showRed ? LIGHT_COLORS.red : undefined}
        shadowBlur={showRed ? 12 : 0}
      />
      {/* Yellow */}
      <Circle
        x={0}
        y={26}
        radius={8}
        fill={
          !flash && activeState === "yellow"
            ? LIGHT_COLORS.yellow
            : LIGHT_DIM.yellow
        }
        shadowColor={!flash && activeState === "yellow" ? LIGHT_COLORS.yellow : undefined}
        shadowBlur={!flash && activeState === "yellow" ? 12 : 0}
      />
      {/* Green */}
      <Circle
        x={0}
        y={44}
        radius={8}
        fill={
          !flash && activeState === "green"
            ? LIGHT_COLORS.green
            : LIGHT_DIM.green
        }
        shadowColor={!flash && activeState === "green" ? LIGHT_COLORS.green : undefined}
        shadowBlur={!flash && activeState === "green" ? 12 : 0}
      />
      {/* Label */}
      <Text
        text={label}
        x={-20}
        y={62}
        width={40}
        align="center"
        fontSize={10}
        fill="#94a3b8"
        fontFamily="monospace"
      />
    </Group>
  );
}

/** Car queue visualization (rectangles lined up) */
function CarQueue({
  x,
  y,
  count,
  direction,
}: {
  x: number;
  y: number;
  count: number;
  direction: "up" | "down" | "left" | "right";
}) {
  const maxShow = 12;
  const shown = Math.min(count, maxShow);
  const carW = direction === "up" || direction === "down" ? 10 : 16;
  const carH = direction === "up" || direction === "down" ? 16 : 10;
  const gap = 3;

  return (
    <Group x={x} y={y}>
      {Array.from({ length: shown }, (_, i) => {
        let cx = 0,
          cy = 0;
        if (direction === "up") {
          cy = (i + 1) * (carH + gap);
        } else if (direction === "down") {
          cy = -(i + 1) * (carH + gap);
        } else if (direction === "left") {
          cx = (i + 1) * (carW + gap);
        } else {
          cx = -(i + 1) * (carW + gap);
        }
        return (
          <Rect
            key={i}
            x={cx - carW / 2}
            y={cy - carH / 2}
            width={carW}
            height={carH}
            fill={i < 3 ? "#60a5fa" : i < 7 ? "#a78bfa" : "#f87171"}
            cornerRadius={2}
            opacity={0.8}
          />
        );
      })}
      {count > maxShow && (
        <Text
          text={`+${count - maxShow}`}
          x={
            direction === "left"
              ? (maxShow + 1) * (carW + gap)
              : direction === "right"
              ? -(maxShow + 1) * (carW + gap)
              : -15
          }
          y={
            direction === "up"
              ? (maxShow + 1) * (carH + gap)
              : direction === "down"
              ? -(maxShow + 1) * (carH + gap)
              : -5
          }
          fontSize={10}
          fill="#f87171"
          fontFamily="monospace"
        />
      )}
    </Group>
  );
}

const PHASE_NAMES: Record<number, string> = {
  1: "NS GREEN",
  2: "NS YELLOW",
  3: "ALL RED",
  4: "EW GREEN",
  5: "EW YELLOW",
  6: "ALL RED",
};

export function IntersectionView({ traffic }: IntersectionViewProps) {
  const WIDTH = 900;
  const HEIGHT = 550;
  const CX = 350; // intersection center X
  const CY = 260; // intersection center Y
  const ROAD_W = 80; // road width

  const isFlash = traffic.flash_mode;
  const isConflict = traffic.conflict_detected;
  const isPreemption = traffic.preemption_active > 0;

  // Status text
  let statusText = "NORMAL OPERATION";
  let statusColor = "#22c55e";
  if (isConflict) {
    statusText = "!! CONFLICT — OPPOSING GREENS !!";
    statusColor = "#ef4444";
  } else if (isFlash) {
    statusText = "FLASH MODE — CONFLICT MONITOR TRIGGERED";
    statusColor = "#f59e0b";
  } else if (isPreemption) {
    statusText = `PREEMPTION ACTIVE — ${traffic.preemption_active === 1 ? "N-S" : "E-W"} PRIORITY`;
    statusColor = "#f97316";
  } else if (traffic.gridlock_level > 60) {
    statusText = "WARNING — HIGH CONGESTION";
    statusColor = "#f59e0b";
  }

  return (
    <div className="relative">
      <Stage width={WIDTH} height={HEIGHT}>
        <Layer>
          {/* Background */}
          <Rect
            width={WIDTH}
            height={HEIGHT}
            fill={isConflict ? "#1a0505" : "#0f172a"}
          />

          {/* Title */}
          <Text
            text="INTERSECTION OVERVIEW"
            x={20}
            y={15}
            fontSize={18}
            fill="#e2e8f0"
            fontFamily="monospace"
            fontStyle="bold"
          />
          <Text
            text={statusText}
            x={20}
            y={38}
            fontSize={13}
            fill={statusColor}
            fontFamily="monospace"
          />

          {/* ── Roads ── */}
          {/* N-S road */}
          <Rect
            x={CX - ROAD_W / 2}
            y={0}
            width={ROAD_W}
            height={HEIGHT}
            fill="#334155"
          />
          {/* E-W road */}
          <Rect
            x={0}
            y={CY - ROAD_W / 2}
            width={600}
            height={ROAD_W}
            fill="#334155"
          />

          {/* Road edges */}
          <Line points={[CX - ROAD_W / 2, 0, CX - ROAD_W / 2, CY - ROAD_W / 2]} stroke="#64748b" strokeWidth={2} />
          <Line points={[CX + ROAD_W / 2, 0, CX + ROAD_W / 2, CY - ROAD_W / 2]} stroke="#64748b" strokeWidth={2} />
          <Line points={[CX - ROAD_W / 2, CY + ROAD_W / 2, CX - ROAD_W / 2, HEIGHT]} stroke="#64748b" strokeWidth={2} />
          <Line points={[CX + ROAD_W / 2, CY + ROAD_W / 2, CX + ROAD_W / 2, HEIGHT]} stroke="#64748b" strokeWidth={2} />
          <Line points={[0, CY - ROAD_W / 2, CX - ROAD_W / 2, CY - ROAD_W / 2]} stroke="#64748b" strokeWidth={2} />
          <Line points={[0, CY + ROAD_W / 2, CX - ROAD_W / 2, CY + ROAD_W / 2]} stroke="#64748b" strokeWidth={2} />
          <Line points={[CX + ROAD_W / 2, CY - ROAD_W / 2, 600, CY - ROAD_W / 2]} stroke="#64748b" strokeWidth={2} />
          <Line points={[CX + ROAD_W / 2, CY + ROAD_W / 2, 600, CY + ROAD_W / 2]} stroke="#64748b" strokeWidth={2} />

          {/* Center lane dividers (dashed) */}
          {/* N-S center line (above intersection) */}
          {Array.from({ length: 8 }, (_, i) => (
            <Line
              key={`ns-top-${i}`}
              points={[CX, 20 + i * 25, CX, 30 + i * 25]}
              stroke="#fbbf24"
              strokeWidth={1.5}
            />
          ))}
          {/* N-S center line (below intersection) */}
          {Array.from({ length: 8 }, (_, i) => (
            <Line
              key={`ns-bot-${i}`}
              points={[CX, CY + ROAD_W / 2 + 10 + i * 25, CX, CY + ROAD_W / 2 + 20 + i * 25]}
              stroke="#fbbf24"
              strokeWidth={1.5}
            />
          ))}
          {/* E-W center line (left) */}
          {Array.from({ length: 8 }, (_, i) => (
            <Line
              key={`ew-left-${i}`}
              points={[20 + i * 30, CY, 30 + i * 30, CY]}
              stroke="#fbbf24"
              strokeWidth={1.5}
            />
          ))}
          {/* E-W center line (right) */}
          {Array.from({ length: 5 }, (_, i) => (
            <Line
              key={`ew-right-${i}`}
              points={[CX + ROAD_W / 2 + 10 + i * 30, CY, CX + ROAD_W / 2 + 20 + i * 30, CY]}
              stroke="#fbbf24"
              strokeWidth={1.5}
            />
          ))}

          {/* Crosswalks */}
          {/* North crosswalk */}
          {Array.from({ length: 6 }, (_, i) => (
            <Rect
              key={`cw-n-${i}`}
              x={CX - ROAD_W / 2 + 5 + i * 13}
              y={CY - ROAD_W / 2 - 8}
              width={8}
              height={6}
              fill={traffic.ns_pedestrian === "walk" ? "#e2e8f0" : "#475569"}
              opacity={0.7}
            />
          ))}
          {/* South crosswalk */}
          {Array.from({ length: 6 }, (_, i) => (
            <Rect
              key={`cw-s-${i}`}
              x={CX - ROAD_W / 2 + 5 + i * 13}
              y={CY + ROAD_W / 2 + 2}
              width={8}
              height={6}
              fill={traffic.ns_pedestrian === "walk" ? "#e2e8f0" : "#475569"}
              opacity={0.7}
            />
          ))}
          {/* West crosswalk */}
          {Array.from({ length: 6 }, (_, i) => (
            <Rect
              key={`cw-w-${i}`}
              x={CX - ROAD_W / 2 - 8}
              y={CY - ROAD_W / 2 + 5 + i * 13}
              width={6}
              height={8}
              fill={traffic.ew_pedestrian === "walk" ? "#e2e8f0" : "#475569"}
              opacity={0.7}
            />
          ))}
          {/* East crosswalk */}
          {Array.from({ length: 6 }, (_, i) => (
            <Rect
              key={`cw-e-${i}`}
              x={CX + ROAD_W / 2 + 2}
              y={CY - ROAD_W / 2 + 5 + i * 13}
              width={6}
              height={8}
              fill={traffic.ew_pedestrian === "walk" ? "#e2e8f0" : "#475569"}
              opacity={0.7}
            />
          ))}

          {/* ── Traffic Lights ── */}
          {/* North light (for southbound traffic = NS) */}
          <TrafficLight
            x={CX - ROAD_W / 2 - 25}
            y={CY - ROAD_W / 2 - 80}
            state={traffic.ns_light}
            flash={isFlash}
            label="N"
          />
          {/* South light (for northbound traffic = NS) */}
          <TrafficLight
            x={CX + ROAD_W / 2 + 25}
            y={CY + ROAD_W / 2 + 15}
            state={traffic.ns_light}
            flash={isFlash}
            label="S"
          />
          {/* West light (for eastbound traffic = EW) */}
          <TrafficLight
            x={CX - ROAD_W / 2 - 80}
            y={CY + ROAD_W / 2 + 25}
            state={traffic.ew_light}
            flash={isFlash}
            label="W"
          />
          {/* East light (for westbound traffic = EW) */}
          <TrafficLight
            x={CX + ROAD_W / 2 + 80}
            y={CY - ROAD_W / 2 - 25}
            state={traffic.ew_light}
            flash={isFlash}
            label="E"
          />

          {/* ── Car Queues ── */}
          {/* Northbound (from south, going up) */}
          <CarQueue
            x={CX + ROAD_W / 4}
            y={CY + ROAD_W / 2 + 10}
            count={traffic.ns_queue}
            direction="up"
          />
          {/* Southbound (from north, going down) */}
          <CarQueue
            x={CX - ROAD_W / 4}
            y={CY - ROAD_W / 2 - 10}
            count={traffic.ns_queue}
            direction="down"
          />
          {/* Eastbound (from west, going right) */}
          <CarQueue
            x={CX - ROAD_W / 2 - 10}
            y={CY + ROAD_W / 4}
            count={traffic.ew_queue}
            direction="right"
          />
          {/* Westbound (from east, going left) */}
          <CarQueue
            x={CX + ROAD_W / 2 + 10}
            y={CY - ROAD_W / 4}
            count={traffic.ew_queue}
            direction="left"
          />

          {/* ── Direction Labels ── */}
          <Text text="N" x={CX - 5} y={65} fontSize={16} fill="#94a3b8" fontFamily="monospace" fontStyle="bold" />
          <Text text="S" x={CX - 5} y={HEIGHT - 80} fontSize={16} fill="#94a3b8" fontFamily="monospace" fontStyle="bold" />
          <Text text="W" x={30} y={CY - 8} fontSize={16} fill="#94a3b8" fontFamily="monospace" fontStyle="bold" />
          <Text text="E" x={570} y={CY - 8} fontSize={16} fill="#94a3b8" fontFamily="monospace" fontStyle="bold" />

          {/* ── Right Panel: Info ── */}
          {/* Phase info */}
          <Group x={640} y={80}>
            <Text text="PHASE" x={0} y={0} fontSize={12} fill="#94a3b8" fontFamily="monospace" />
            <Text
              text={PHASE_NAMES[traffic.current_phase] || `PHASE ${traffic.current_phase}`}
              x={0}
              y={18}
              fontSize={16}
              fill={
                traffic.ns_light === "green"
                  ? "#22c55e"
                  : traffic.ew_light === "green"
                  ? "#22c55e"
                  : traffic.ns_light === "yellow" || traffic.ew_light === "yellow"
                  ? "#eab308"
                  : "#ef4444"
              }
              fontFamily="monospace"
              fontStyle="bold"
            />
            <Text
              text={`${traffic.phase_timer.toFixed(0)}s remaining`}
              x={0}
              y={40}
              fontSize={12}
              fill="#64748b"
              fontFamily="monospace"
            />
          </Group>

          {/* Queue stats */}
          <Group x={640} y={160}>
            <Text text="QUEUES" x={0} y={0} fontSize={12} fill="#94a3b8" fontFamily="monospace" />
            <Text text={`N-S: ${traffic.ns_queue} cars`} x={0} y={20} fontSize={13} fill="#60a5fa" fontFamily="monospace" />
            <Text text={`E-W: ${traffic.ew_queue} cars`} x={0} y={38} fontSize={13} fill="#a78bfa" fontFamily="monospace" />
          </Group>

          {/* Wait times */}
          <Group x={640} y={230}>
            <Text text="AVG WAIT" x={0} y={0} fontSize={12} fill="#94a3b8" fontFamily="monospace" />
            <Text text={`N-S: ${traffic.ns_wait_time.toFixed(0)}s`} x={0} y={20} fontSize={13} fill="#60a5fa" fontFamily="monospace" />
            <Text text={`E-W: ${traffic.ew_wait_time.toFixed(0)}s`} x={0} y={38} fontSize={13} fill="#a78bfa" fontFamily="monospace" />
          </Group>

          {/* Gridlock meter */}
          <Group x={640} y={310}>
            <Text text="GRIDLOCK" x={0} y={0} fontSize={12} fill="#94a3b8" fontFamily="monospace" />
            <Rect x={0} y={18} width={200} height={14} fill="#1e293b" stroke="#475569" strokeWidth={1} cornerRadius={3} />
            <Rect
              x={1}
              y={19}
              width={Math.max(0, (traffic.gridlock_level / 100) * 198)}
              height={12}
              fill={
                traffic.gridlock_level > 70
                  ? "#ef4444"
                  : traffic.gridlock_level > 40
                  ? "#f59e0b"
                  : "#22c55e"
              }
              cornerRadius={2}
            />
            <Text
              text={`${traffic.gridlock_level.toFixed(0)}%`}
              x={210}
              y={18}
              fontSize={12}
              fill={traffic.gridlock_level > 70 ? "#ef4444" : "#94a3b8"}
              fontFamily="monospace"
            />
          </Group>

          {/* Status indicators */}
          <Group x={640} y={370}>
            <Text text="STATUS" x={0} y={0} fontSize={12} fill="#94a3b8" fontFamily="monospace" />

            {/* Conflict monitor */}
            <Circle x={8} y={22} radius={5} fill={traffic.conflict_monitor_enabled ? "#22c55e" : "#ef4444"} />
            <Text
              text={traffic.conflict_monitor_enabled ? "Conflict Monitor: ON" : "Conflict Monitor: OFF"}
              x={18}
              y={16}
              fontSize={11}
              fill={traffic.conflict_monitor_enabled ? "#86efac" : "#fca5a5"}
              fontFamily="monospace"
            />

            {/* Preemption */}
            <Circle x={8} y={42} radius={5} fill={isPreemption ? "#f97316" : "#475569"} />
            <Text
              text={isPreemption ? `Preemption: ${traffic.preemption_active === 1 ? "N-S" : "E-W"}` : "Preemption: OFF"}
              x={18}
              y={36}
              fontSize={11}
              fill={isPreemption ? "#fdba74" : "#64748b"}
              fontFamily="monospace"
            />

            {/* Flash mode */}
            <Circle x={8} y={62} radius={5} fill={isFlash ? "#eab308" : "#475569"} />
            <Text
              text={isFlash ? "Flash Mode: ACTIVE" : "Flash Mode: OFF"}
              x={18}
              y={56}
              fontSize={11}
              fill={isFlash ? "#fde047" : "#64748b"}
              fontFamily="monospace"
            />

            {/* Conflict */}
            <Circle x={8} y={82} radius={5} fill={isConflict ? "#ef4444" : "#475569"} />
            <Text
              text={isConflict ? "CONFLICT DETECTED!" : "No Conflict"}
              x={18}
              y={76}
              fontSize={11}
              fill={isConflict ? "#fca5a5" : "#64748b"}
              fontFamily="monospace"
            />
          </Group>

          {/* Conflict overlay */}
          {isConflict && (
            <Group>
              <Rect
                x={CX - 80}
                y={CY - 20}
                width={160}
                height={40}
                fill="#ef4444"
                opacity={0.3}
                cornerRadius={4}
              />
              <Text
                text="COLLISION RISK"
                x={CX - 60}
                y={CY - 8}
                fontSize={16}
                fill="#ef4444"
                fontFamily="monospace"
                fontStyle="bold"
              />
            </Group>
          )}

          {/* Bottom info bar */}
          <Rect x={0} y={HEIGHT - 40} width={WIDTH} height={40} fill="#0f172a" />
          <Text
            text={`Cycle: ${traffic.cycle_count}  |  Vehicles: ${traffic.total_vehicles_passed}  |  Phase Hold: ${traffic.phase_hold > 0 ? `Phase ${traffic.phase_hold}` : "OFF"}  |  Timing: NS=${traffic.ns_green_time.toFixed(0)}s  EW=${traffic.ew_green_time.toFixed(0)}s`}
            x={20}
            y={HEIGHT - 28}
            fontSize={12}
            fill="#94a3b8"
            fontFamily="monospace"
          />
        </Layer>
      </Stage>
    </div>
  );
}
