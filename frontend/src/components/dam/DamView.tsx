import { Stage, Layer, Rect, Line, Text, Group, Circle } from "react-konva";
import { useState, useEffect, useRef } from "react";
import { Gauge } from "../shared/Gauge";
import { StatusLight } from "../shared/StatusLight";
import type { DamState } from "../../types/process";

interface DamViewProps {
  dam: DamState;
}

/** Animated water particles for flow effect */
function WaterParticles({
  x,
  y,
  width,
  count,
  speed,
  active,
}: {
  x: number;
  y: number;
  width: number;
  count: number;
  speed: number;
  active: boolean;
}) {
  const [particles, setParticles] = useState<{ px: number; py: number }[]>([]);
  const frameRef = useRef(0);

  useEffect(() => {
    const initial = Array.from({ length: count }, () => ({
      px: Math.random() * width,
      py: Math.random() * 20 - 10,
    }));
    setParticles(initial);
  }, [count, width]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      frameRef.current += 1;
      setParticles((prev) =>
        prev.map((p) => ({
          px: (p.px + speed) % width,
          py: p.py + Math.sin(frameRef.current * 0.1 + p.px) * 0.5,
        }))
      );
    }, 50);
    return () => clearInterval(interval);
  }, [active, speed, width]);

  if (!active) return null;

  return (
    <Group x={x} y={y}>
      {particles.map((p, i) => (
        <Circle
          key={i}
          x={p.px}
          y={p.py}
          radius={2}
          fill="#60a5fa"
          opacity={0.6}
        />
      ))}
    </Group>
  );
}

export function DamView({ dam }: DamViewProps) {
  const WIDTH = 900;
  const HEIGHT = 550;

  // Dam structure dimensions
  const damX = 350;
  const damWidth = 30;
  const damTop = 80;
  const damBottom = 400;
  const damHeight = damBottom - damTop;

  // Water level calculation (0-100 maps to damBottom-damTop)
  const waterFraction = dam.water_level / 100;
  const waterHeight = waterFraction * damHeight;
  const waterTop = damBottom - waterHeight;

  // Gate position (0-100% open maps to visual gate height)
  const gateMaxHeight = 60;
  const gateHeight = (dam.gate_position / 100) * gateMaxHeight;

  // Colors based on state
  const waterColor =
    dam.overflow ? "#dc2626" : dam.high_level_alarm ? "#f59e0b" : "#3b82f6";
  const bgColor = dam.overflow ? "#1a0505" : "#0f172a";

  return (
    <div className="relative">
      <Stage width={WIDTH} height={HEIGHT}>
        <Layer>
          {/* Background */}
          <Rect width={WIDTH} height={HEIGHT} fill={bgColor} />

          {/* Title */}
          <Text
            text="DAM OVERVIEW"
            x={20}
            y={15}
            fontSize={18}
            fill="#e2e8f0"
            fontFamily="monospace"
            fontStyle="bold"
          />
          <Text
            text={dam.overflow ? "!! OVERFLOW !!" : dam.high_level_alarm ? "! HIGH LEVEL !" : "NORMAL OPERATION"}
            x={20}
            y={38}
            fontSize={13}
            fill={dam.overflow ? "#ef4444" : dam.high_level_alarm ? "#fbbf24" : "#22c55e"}
            fontFamily="monospace"
          />

          {/* ── Reservoir (left side of dam) ── */}
          {/* Reservoir basin shape */}
          <Line
            points={[50, damTop, 50, damBottom + 20, damX, damBottom + 20, damX, damTop]}
            stroke="#475569"
            strokeWidth={3}
            closed={false}
          />

          {/* Water fill */}
          <Rect
            x={52}
            y={waterTop}
            width={damX - 54}
            height={waterHeight + 20}
            fill={waterColor}
            opacity={0.7}
          />

          {/* Water surface waves */}
          <Line
            points={Array.from({ length: 30 }, (_, i) => {
              const px = 52 + (i / 29) * (damX - 54);
              const py = waterTop + Math.sin(Date.now() * 0.003 + i * 0.5) * 2;
              return [px, py];
            }).flat()}
            stroke="#93c5fd"
            strokeWidth={2}
            opacity={0.8}
          />

          {/* ── Dam wall ── */}
          <Rect
            x={damX}
            y={damTop}
            width={damWidth}
            height={damHeight + 20}
            fill="#64748b"
            stroke="#94a3b8"
            strokeWidth={2}
          />
          {/* Dam texture lines */}
          {Array.from({ length: 8 }, (_, i) => (
            <Line
              key={`dtex-${i}`}
              points={[damX, damTop + i * 40 + 20, damX + damWidth, damTop + i * 40 + 20]}
              stroke="#475569"
              strokeWidth={1}
            />
          ))}

          {/* ── Sluice Gate ── */}
          <Group x={damX} y={damBottom - gateMaxHeight}>
            {/* Gate housing */}
            <Rect
              x={-5}
              y={-10}
              width={damWidth + 10}
              height={gateMaxHeight + 15}
              fill="#1e293b"
              stroke="#475569"
              strokeWidth={1}
            />
            {/* Gate (moves up when opening) */}
            <Rect
              x={2}
              y={gateMaxHeight - gateHeight}
              width={damWidth - 4}
              height={gateHeight}
              fill="#334155"
              stroke="#94a3b8"
              strokeWidth={2}
            />
            {/* Gate opening (water flows through) */}
            {dam.gate_position > 2 && (
              <Rect
                x={2}
                y={0}
                width={damWidth - 4}
                height={gateMaxHeight - gateHeight}
                fill={waterColor}
                opacity={0.5}
              />
            )}
          </Group>

          {/* ── Outflow channel (right side of dam) ── */}
          <Line
            points={[
              damX + damWidth, damBottom + 20,
              damX + damWidth + 200, damBottom + 20,
              damX + damWidth + 200, damBottom - 20,
            ]}
            stroke="#475569"
            strokeWidth={2}
          />

          {/* Outflow water */}
          {dam.gate_position > 2 && (
            <Rect
              x={damX + damWidth}
              y={damBottom}
              width={200}
              height={20}
              fill="#2563eb"
              opacity={0.5}
            />
          )}

          {/* Flow particles */}
          <WaterParticles
            x={damX + damWidth + 5}
            y={damBottom + 10}
            width={190}
            count={15}
            speed={dam.gate_position / 20}
            active={dam.gate_position > 2}
          />

          {/* Inflow particles (top-left) */}
          <WaterParticles
            x={50}
            y={waterTop + 5}
            width={100}
            count={10}
            speed={2}
            active={dam.inflow_rate > 10}
          />

          {/* Inflow arrow label */}
          <Text
            text={`INFLOW: ${dam.inflow_rate.toFixed(0)} m³/s →`}
            x={55}
            y={waterTop - 20}
            fontSize={11}
            fill="#60a5fa"
            fontFamily="monospace"
          />

          {/* Outflow label */}
          <Text
            text={`→ OUTFLOW: ${dam.outflow_rate.toFixed(0)} m³/s`}
            x={damX + damWidth + 10}
            y={damBottom - 35}
            fontSize={11}
            fill="#60a5fa"
            fontFamily="monospace"
          />

          {/* "To Treatment Plant →" label */}
          <Text
            text="→ To Treatment Plant"
            x={damX + damWidth + 100}
            y={damBottom + 5}
            fontSize={10}
            fill="#94a3b8"
            fontFamily="monospace"
          />

          {/* ── Water Level Gauge Bar ── */}
          <Group x={20} y={damTop}>
            <Rect
              x={0}
              y={0}
              width={20}
              height={damHeight}
              fill="#1e293b"
              stroke="#475569"
              strokeWidth={1}
            />
            {/* Danger zone (top) */}
            <Rect
              x={0}
              y={0}
              width={20}
              height={damHeight * 0.15}
              fill="#dc2626"
              opacity={0.3}
            />
            {/* Warning zone */}
            <Rect
              x={0}
              y={damHeight * 0.15}
              width={20}
              height={damHeight * 0.1}
              fill="#f59e0b"
              opacity={0.3}
            />
            {/* Current level indicator */}
            <Rect
              x={0}
              y={damHeight - waterHeight}
              width={20}
              height={waterHeight}
              fill={waterColor}
              opacity={0.8}
            />
            {/* Scale markers */}
            {[0, 20, 40, 60, 80, 100].map((val) => (
              <Text
                key={`scale-${val}`}
                text={`${val}`}
                x={24}
                y={damHeight - (val / 100) * damHeight - 5}
                fontSize={9}
                fill="#9ca3af"
                fontFamily="monospace"
              />
            ))}
          </Group>

          {/* ── Gauges ── */}
          <Gauge
            x={650}
            y={100}
            radius={55}
            value={dam.water_level}
            min={0}
            max={100}
            label="Water Level"
            unit="m"
            dangerHigh={85}
            dangerLow={20}
          />

          <Gauge
            x={800}
            y={100}
            radius={55}
            value={dam.gate_position}
            min={0}
            max={100}
            label="Gate Position"
            unit="%"
          />

          <Gauge
            x={650}
            y={260}
            radius={55}
            value={dam.inflow_rate}
            min={0}
            max={300}
            label="Inflow Rate"
            unit="m³/s"
          />

          <Gauge
            x={800}
            y={260}
            radius={55}
            value={dam.outflow_rate}
            min={0}
            max={300}
            label="Outflow Rate"
            unit="m³/s"
          />

          {/* ── Alarm indicators ── */}
          <StatusLight
            x={640}
            y={380}
            active={dam.high_level_alarm}
            label="HIGH LEVEL"
            color="#ef4444"
          />
          <StatusLight
            x={640}
            y={410}
            active={dam.low_level_alarm}
            label="LOW LEVEL"
            color="#f59e0b"
          />
          <StatusLight
            x={640}
            y={440}
            active={dam.spillway_active}
            label="SPILLWAY"
            color="#f97316"
          />
          <StatusLight
            x={640}
            y={470}
            active={dam.overflow}
            label="OVERFLOW"
            color="#dc2626"
          />

          {/* ── Spillway indicator ── */}
          {dam.spillway_active && (
            <Group>
              <Text
                text="⚠ SPILLWAY ACTIVE"
                x={150}
                y={damTop - 15}
                fontSize={14}
                fill="#f97316"
                fontFamily="monospace"
                fontStyle="bold"
              />
            </Group>
          )}

          {/* Ground/terrain */}
          <Line
            points={[0, damBottom + 22, WIDTH, damBottom + 22]}
            stroke="#334155"
            strokeWidth={2}
          />
          <Rect
            x={0}
            y={damBottom + 22}
            width={WIDTH}
            height={HEIGHT - damBottom - 22}
            fill="#1e293b"
          />

          {/* Bottom info bar */}
          <Rect
            x={0}
            y={HEIGHT - 40}
            width={WIDTH}
            height={40}
            fill="#0f172a"
          />
          <Text
            text={`Gate Target: ${dam.gate_target.toFixed(0)}%  |  Level: ${dam.water_level.toFixed(1)}m  |  Net Flow: ${(dam.inflow_rate - dam.outflow_rate).toFixed(1)} m³/s`}
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
