import { Group, Arc, Text, Circle } from "react-konva";

interface GaugeProps {
  x: number;
  y: number;
  radius: number;
  value: number;
  min: number;
  max: number;
  label: string;
  unit: string;
  dangerLow?: number;
  dangerHigh?: number;
}

export function Gauge({
  x,
  y,
  radius,
  value,
  min,
  max,
  label,
  unit,
  dangerLow,
  dangerHigh,
}: GaugeProps) {
  const range = max - min;
  const normalized = Math.max(0, Math.min(1, (value - min) / range));
  const angle = normalized * 240 - 120; // -120 to +120 degrees

  // Determine color based on danger zones
  let color = "#22c55e"; // green
  if (dangerHigh !== undefined && value > dangerHigh) {
    color = "#ef4444"; // red
  } else if (dangerLow !== undefined && value < dangerLow) {
    color = "#ef4444"; // red
  } else if (
    (dangerHigh !== undefined && value > dangerHigh * 0.85) ||
    (dangerLow !== undefined && value < dangerLow * 1.15)
  ) {
    color = "#eab308"; // yellow
  }

  const startAngle = -210;
  const sweepAngle = normalized * 240;

  return (
    <Group x={x} y={y}>
      {/* Background arc */}
      <Arc
        angle={240}
        rotation={-210}
        innerRadius={radius - 8}
        outerRadius={radius}
        fill="#374151"
      />
      {/* Value arc */}
      <Arc
        angle={sweepAngle}
        rotation={startAngle}
        innerRadius={radius - 8}
        outerRadius={radius}
        fill={color}
      />
      {/* Center dot */}
      <Circle radius={4} fill={color} />
      {/* Needle */}
      <Group rotation={angle}>
        <Arc
          angle={2}
          rotation={-1}
          innerRadius={0}
          outerRadius={radius - 12}
          fill="white"
          stroke="white"
          strokeWidth={2}
        />
      </Group>
      {/* Value text */}
      <Text
        text={value.toFixed(1)}
        fontSize={radius * 0.35}
        fill="white"
        fontFamily="monospace"
        fontStyle="bold"
        align="center"
        width={radius * 2}
        x={-radius}
        y={radius * 0.15}
      />
      {/* Unit */}
      <Text
        text={unit}
        fontSize={radius * 0.2}
        fill="#9ca3af"
        fontFamily="monospace"
        align="center"
        width={radius * 2}
        x={-radius}
        y={radius * 0.5}
      />
      {/* Label */}
      <Text
        text={label}
        fontSize={radius * 0.2}
        fill="#d1d5db"
        fontFamily="sans-serif"
        align="center"
        width={radius * 2.5}
        x={-radius * 1.25}
        y={radius + 10}
      />
    </Group>
  );
}
