import { Group, Circle, Text } from "react-konva";

interface StatusLightProps {
  x: number;
  y: number;
  active: boolean;
  label: string;
  color?: string;
  size?: number;
}

export function StatusLight({
  x,
  y,
  active,
  label,
  color = "#ef4444",
  size = 10,
}: StatusLightProps) {
  const displayColor = active ? color : "#374151";
  const glowRadius = active ? size + 4 : 0;

  return (
    <Group x={x} y={y}>
      {/* Glow effect when active */}
      {active && (
        <Circle
          radius={glowRadius}
          fill={color}
          opacity={0.3}
        />
      )}
      {/* Main indicator */}
      <Circle
        radius={size}
        fill={displayColor}
        stroke="#6b7280"
        strokeWidth={1}
      />
      {/* Label */}
      <Text
        text={label}
        fontSize={11}
        fill={active ? "#fbbf24" : "#9ca3af"}
        fontFamily="monospace"
        x={size + 8}
        y={-6}
      />
    </Group>
  );
}
