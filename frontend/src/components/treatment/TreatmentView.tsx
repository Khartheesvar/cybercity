import { Stage, Layer, Rect, Line, Text, Group, Circle } from "react-konva";
import { Gauge } from "../shared/Gauge";
import { StatusLight } from "../shared/StatusLight";
import type { PlantState, StageStatus } from "../../types/process";

interface TreatmentViewProps {
  plant: PlantState;
}

const STAGE_COLORS: Record<StageStatus, string> = {
  0: "#6b7280", // offline - gray
  1: "#22c55e", // normal - green
  2: "#eab308", // warning - yellow
  3: "#ef4444", // critical - red
};

const STAGE_LABELS: Record<StageStatus, string> = {
  0: "OFFLINE",
  1: "NORMAL",
  2: "WARNING",
  3: "CRITICAL",
};

function TreatmentStage({
  x,
  y,
  width,
  height,
  name,
  status,
  fillLevel,
  fillColor,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  status: StageStatus;
  fillLevel?: number;
  fillColor?: string;
}) {
  const stageColor = STAGE_COLORS[status];
  const fill = fillLevel !== undefined ? fillLevel / 100 : 0;

  return (
    <Group x={x} y={y}>
      {/* Tank body */}
      <Rect
        width={width}
        height={height}
        fill="#1e293b"
        stroke={stageColor}
        strokeWidth={2}
        cornerRadius={4}
      />
      {/* Fill level */}
      {fillLevel !== undefined && (
        <Rect
          x={2}
          y={height - fill * (height - 4)}
          width={width - 4}
          height={fill * (height - 4)}
          fill={fillColor || "#3b82f6"}
          opacity={0.6}
          cornerRadius={2}
        />
      )}
      {/* Stage name */}
      <Text
        text={name}
        x={0}
        y={-20}
        width={width}
        fontSize={10}
        fill="#d1d5db"
        fontFamily="monospace"
        align="center"
      />
      {/* Status badge */}
      <Group x={width / 2} y={height + 8}>
        <Circle radius={4} fill={stageColor} />
        <Text
          text={STAGE_LABELS[status]}
          x={8}
          y={-5}
          fontSize={8}
          fill={stageColor}
          fontFamily="monospace"
        />
      </Group>
    </Group>
  );
}

function PipeConnection({
  x1,
  y1,
  x2,
  y2,
  active,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
}) {
  return (
    <Group>
      <Line
        points={[x1, y1, x2, y2]}
        stroke={active ? "#3b82f6" : "#374151"}
        strokeWidth={4}
      />
      {/* Flow direction arrow */}
      {active && (
        <Group x={(x1 + x2) / 2} y={(y1 + y2) / 2}>
          <Text
            text="▶"
            fontSize={10}
            fill="#60a5fa"
            x={-5}
            y={-6}
          />
        </Group>
      )}
    </Group>
  );
}

function PumpIndicator({
  x,
  y,
  name,
  active,
}: {
  x: number;
  y: number;
  name: string;
  active: boolean;
}) {
  return (
    <Group x={x} y={y}>
      <Circle
        radius={12}
        fill={active ? "#1e3a5f" : "#1e293b"}
        stroke={active ? "#3b82f6" : "#6b7280"}
        strokeWidth={2}
      />
      <Text
        text={active ? "▶" : "■"}
        fontSize={10}
        fill={active ? "#60a5fa" : "#6b7280"}
        x={-4}
        y={-5}
      />
      <Text
        text={name}
        fontSize={9}
        fill={active ? "#93c5fd" : "#6b7280"}
        fontFamily="monospace"
        x={-20}
        y={18}
        width={40}
        align="center"
      />
    </Group>
  );
}

export function TreatmentView({ plant }: TreatmentViewProps) {
  const WIDTH = 900;
  const HEIGHT = 550;

  const stageY = 180;
  const stageW = 90;
  const stageH = 120;
  const stageGap = 30;
  const startX = 40;

  const stageNames = [
    "INTAKE",
    "COAGULATION",
    "SEDIMENTATION",
    "FILTRATION",
    "CHLORINATION",
    "DISTRIBUTION",
  ];
  const stageKeys = [
    "intake",
    "coagulation",
    "sedimentation",
    "filtration",
    "chlorination",
    "distribution",
  ];

  // Chlorine color: more chlorine = more yellow-green
  const chlorineIntensity = Math.min(1, plant.chlorine_level / 10);
  const chlorineColor = `rgb(${Math.round(34 + chlorineIntensity * 200)}, ${Math.round(197 - chlorineIntensity * 100)}, ${Math.round(94 - chlorineIntensity * 60)})`;

  const anyAlarm = plant.chemical_alarm || plant.pressure_alarm || plant.turbidity_alarm;

  return (
    <div className="relative">
      <Stage width={WIDTH} height={HEIGHT}>
        <Layer>
          {/* Background */}
          <Rect
            width={WIDTH}
            height={HEIGHT}
            fill={anyAlarm ? "#1a0a05" : "#0f172a"}
          />

          {/* Title */}
          <Text
            text="WATER TREATMENT PLANT"
            x={20}
            y={15}
            fontSize={18}
            fill="#e2e8f0"
            fontFamily="monospace"
            fontStyle="bold"
          />
          <Text
            text={anyAlarm ? "! ALARM ACTIVE !" : "NORMAL OPERATION"}
            x={20}
            y={38}
            fontSize={13}
            fill={anyAlarm ? "#ef4444" : "#22c55e"}
            fontFamily="monospace"
          />

          {/* ← From Dam label */}
          <Text
            text="← From Dam"
            x={startX}
            y={stageY - 40}
            fontSize={11}
            fill="#60a5fa"
            fontFamily="monospace"
          />

          {/* Treatment stages */}
          {stageNames.map((name, i) => {
            const x = startX + i * (stageW + stageGap);
            const status = (plant.stages[stageKeys[i]] || 1) as StageStatus;
            let fillLevel: number | undefined;
            let fillColor: string | undefined;

            if (i === 0) {
              fillLevel = Math.min(100, plant.intake_rate / 2);
              fillColor = "#3b82f6";
            } else if (i === 4) {
              fillLevel = 70;
              fillColor = chlorineColor;
            } else if (i === 5) {
              fillLevel = plant.tank_level;
              fillColor = "#3b82f6";
            } else {
              fillLevel = 50 + Math.random() * 10;
              fillColor = "#3b82f6";
            }

            return (
              <TreatmentStage
                key={name}
                x={x}
                y={stageY}
                width={stageW}
                height={stageH}
                name={name}
                status={status}
                fillLevel={fillLevel}
                fillColor={fillColor}
              />
            );
          })}

          {/* Pipe connections between stages */}
          {stageNames.slice(0, -1).map((_, i) => {
            const x1 = startX + i * (stageW + stageGap) + stageW;
            const x2 = startX + (i + 1) * (stageW + stageGap);
            return (
              <PipeConnection
                key={`pipe-${i}`}
                x1={x1}
                y1={stageY + stageH / 2}
                x2={x2}
                y2={stageY + stageH / 2}
                active={(plant.stages[stageKeys[i]] as StageStatus) >= 1}
              />
            );
          })}

          {/* → To City label */}
          <Text
            text="To City →"
            x={startX + 5 * (stageW + stageGap) + stageW + 10}
            y={stageY + stageH / 2 - 6}
            fontSize={11}
            fill="#22c55e"
            fontFamily="monospace"
          />

          {/* Pump indicators */}
          <PumpIndicator
            x={startX + stageW / 2}
            y={stageY + stageH + 45}
            name="INTAKE"
            active={plant.intake_pump}
          />
          <PumpIndicator
            x={startX + 4 * (stageW + stageGap) + stageW / 2}
            y={stageY + stageH + 45}
            name="CHEM"
            active={plant.chemical_pump}
          />
          <PumpIndicator
            x={startX + 5 * (stageW + stageGap) + stageW / 2}
            y={stageY + stageH + 45}
            name="DIST"
            active={plant.distribution_pump}
          />

          {/* ── Gauges ── */}
          <Gauge
            x={100}
            y={440}
            radius={45}
            value={plant.chlorine_level}
            min={0}
            max={15}
            label="Chlorine"
            unit="ppm"
            dangerHigh={8}
            dangerLow={0.5}
          />
          <Gauge
            x={230}
            y={440}
            radius={45}
            value={plant.ph_level}
            min={0}
            max={14}
            label="pH Level"
            unit="pH"
            dangerHigh={8.5}
            dangerLow={6.5}
          />
          <Gauge
            x={360}
            y={440}
            radius={45}
            value={plant.turbidity}
            min={0}
            max={10}
            label="Turbidity"
            unit="NTU"
            dangerHigh={5}
          />
          <Gauge
            x={490}
            y={440}
            radius={45}
            value={plant.tank_level}
            min={0}
            max={100}
            label="Tank Level"
            unit="%"
            dangerHigh={90}
            dangerLow={10}
          />
          <Gauge
            x={620}
            y={440}
            radius={45}
            value={plant.distribution_pressure}
            min={0}
            max={100}
            label="Pressure"
            unit="PSI"
            dangerHigh={80}
            dangerLow={40}
          />

          {/* ── Alarms ── */}
          <Group x={740} y={370}>
            <Text
              text="ALARMS"
              fontSize={12}
              fill="#9ca3af"
              fontFamily="monospace"
              fontStyle="bold"
            />
            <StatusLight
              x={0}
              y={25}
              active={plant.chemical_alarm}
              label="CHEMICAL"
              color="#ef4444"
            />
            <StatusLight
              x={0}
              y={50}
              active={plant.pressure_alarm}
              label="PRESSURE"
              color="#f59e0b"
            />
            <StatusLight
              x={0}
              y={75}
              active={plant.turbidity_alarm}
              label="TURBIDITY"
              color="#f97316"
            />
          </Group>

          {/* Chemical dosing info */}
          <Text
            text={`Dosing Rate: ${plant.chlorine_dosing_rate.toFixed(1)} ppm`}
            x={startX + 4 * (stageW + stageGap)}
            y={stageY - 40}
            fontSize={11}
            fill={plant.chlorine_level > 8 ? "#ef4444" : "#93c5fd"}
            fontFamily="monospace"
          />
        </Layer>
      </Stage>
    </div>
  );
}
