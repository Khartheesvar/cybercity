/**
 * SubstationView — Animated Single-Line Diagram (SLD)
 * Northgate 230/115kV Regional Substation
 *
 * Layout:
 *   Left 680px: Single-line diagram (buses, CBs, transformers, feeders)
 *   Right 220px: Real-time measurement panel
 */

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Line, Text, Group, Arc } from "react-konva";
import type { GridState } from "../../types/process";

interface Props { grid: GridState }

// ── Color palette ────────────────────────────────────────────────────────
const C = {
  hvBus:     "#f59e0b",   // amber — 230kV bus
  lvBus:     "#60a5fa",   // blue  — 115kV bus
  energized: "#22c55e",   // green — live conductor
  tripped:   "#ef4444",   // red   — de-energized / tripped
  warn:      "#f59e0b",   // amber — warning
  cb_closed: "#22c55e",
  cb_open:   "#ef4444",
  bg:        "#030712",
  panel:     "#111827",
  border:    "#374151",
  textDim:   "#6b7280",
  textBright:"#e5e7eb",
  glow:      "rgba(34,197,94,0.15)",
  glowWarn:  "rgba(245,158,11,0.2)",
  glowRed:   "rgba(239,68,68,0.2)",
  flow:      "#86efac",   // flowing electrons
};

// ── Flow particle animation ──────────────────────────────────────────────
interface Particle { id: number; progress: number; speed: number }

function useFlowParticles(active: boolean, count = 5) {
  const [particles, setParticles] = useState<Particle[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      progress: i / count,
      speed: 0.003 + Math.random() * 0.002,
    }))
  );
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!active) return;
    const animate = () => {
      setParticles(prev =>
        prev.map(p => ({
          ...p,
          progress: (p.progress + p.speed) % 1,
        }))
      );
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active]);

  return particles;
}

// ── CB Symbol ────────────────────────────────────────────────────────────
function CBSymbol({
  x, y, closed, label, vertical = true,
}: {
  x: number; y: number; closed: boolean; label: string; vertical?: boolean;
}) {
  const color = closed ? C.cb_closed : C.cb_open;
  const size  = 14;
  return (
    <Group>
      <Rect
        x={x - size / 2} y={y - size / 2}
        width={size} height={size}
        fill={closed ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)"}
        stroke={color} strokeWidth={1.5} cornerRadius={2}
      />
      {!closed && (
        <>
          <Line points={[x - 4, y - 4, x + 4, y + 4]} stroke={color} strokeWidth={1.5} />
          <Line points={[x + 4, y - 4, x - 4, y + 4]} stroke={color} strokeWidth={1.5} />
        </>
      )}
      {closed && (
        <Line
          points={vertical ? [x, y - 4, x, y + 4] : [x - 4, y, x + 4, y]}
          stroke={color} strokeWidth={2}
        />
      )}
      <Text
        x={x - 18} y={closed ? y + 9 : y + 9}
        text={label} fontSize={9} fontFamily="monospace"
        fill={color} width={36} align="center"
      />
    </Group>
  );
}

// ── Transformer symbol ───────────────────────────────────────────────────
function TransformerSymbol({
  x, y, loadPct, temp, tripped, label,
}: {
  x: number; y: number; loadPct: number; temp: number; tripped: boolean; label: string;
}) {
  const r = 18;
  const tempColor = temp > 95 ? C.tripped : temp > 75 ? C.warn : C.energized;
  const loadColor = loadPct > 85 ? C.tripped : loadPct > 65 ? C.warn : C.energized;
  const baseColor = tripped ? C.tripped : loadColor;

  return (
    <Group>
      {/* Glow */}
      {!tripped && (
        <Circle x={x} y={y} radius={r + 8}
          fill={loadPct > 85 ? C.glowRed : C.glow} />
      )}
      {/* Top coil (HV side) */}
      <Circle x={x} y={y - r / 2 - 1}
        radius={r / 2}
        stroke={baseColor} strokeWidth={2}
        fill={tripped ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.06)"}
      />
      {/* Bottom coil (LV side) */}
      <Circle x={x} y={y + r / 2 + 1}
        radius={r / 2}
        stroke={baseColor} strokeWidth={2}
        fill={tripped ? "rgba(239,68,68,0.08)" : "rgba(96,165,250,0.06)"}
      />
      {/* Name */}
      <Text x={x - 22} y={y - 7} text={label} fontSize={10}
        fontFamily="monospace" fontStyle="bold" fill={baseColor} width={44} align="center" />
      {/* Loading % */}
      <Text x={x - 22} y={y + 5} text={`${loadPct.toFixed(0)}%`} fontSize={9}
        fontFamily="monospace" fill={loadColor} width={44} align="center" />
      {/* Temperature */}
      <Text x={x - 22} y={y + 15} text={`${temp.toFixed(0)}°C`} fontSize={8}
        fontFamily="monospace" fill={tempColor} width={44} align="center" />
      {/* Trip indicator */}
      {tripped && (
        <Text x={x - 20} y={y + 25} text="TRIPPED" fontSize={8}
          fontFamily="monospace" fontStyle="bold" fill={C.tripped} width={40} align="center" />
      )}
    </Group>
  );
}

// ── Load icon ────────────────────────────────────────────────────────────
function LoadIcon({ x, y, live, label, mw }: {
  x: number; y: number; live: boolean; label: string; mw: number;
}) {
  const color = live ? C.energized : C.tripped;
  return (
    <Group>
      <Rect x={x - 22} y={y} width={44} height={28}
        fill={live ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)"}
        stroke={color} strokeWidth={1} cornerRadius={3} />
      <Text x={x - 20} y={y + 4} text={label} fontSize={9}
        fontFamily="monospace" fontStyle="bold" fill={color} width={40} align="center" />
      <Text x={x - 20} y={y + 14} text={`${mw} MW`} fontSize={8}
        fontFamily="monospace" fill={live ? C.textBright : C.textDim} width={40} align="center" />
    </Group>
  );
}

// ── Flow dot along a line ────────────────────────────────────────────────
function FlowDot({ x1, y1, x2, y2, progress, color }: {
  x1: number; y1: number; x2: number; y2: number; progress: number; color: string;
}) {
  const x = x1 + (x2 - x1) * progress;
  const y = y1 + (y2 - y1) * progress;
  return <Circle x={x} y={y} radius={2.5} fill={color} opacity={0.8} />;
}

// ── Measurement panel item ────────────────────────────────────────────────
function MeasRow({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 border-b border-gray-800">
      <span className="text-gray-500 text-xs font-mono">{label}</span>
      <span className="font-mono text-xs font-bold" style={{ color }}>
        {value} <span className="text-gray-600 font-normal">{unit}</span>
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────
export function SubstationView({ grid }: Props) {
  const W = 900, H = 560;

  // Layout constants (SLD occupies x: 30–680)
  const HV_BUS_Y  = 130;
  const LV_BUS_Y  = 310;
  const BUS_X1    = 70;
  const BUS_X2    = 650;

  // Column X positions
  const SRC1_X  = 160;   // Source 1 / CB1
  const TX1_X   = 295;   // TX1 / CB3
  const TX2_X   = 505;   // TX2 / CB4
  const SRC2_X  = 570;   // Source 2 / CB2 (near TX2 column)
  const FDR_A_X = 170;   // Feeder A / CB5
  const FDR_B_X = 360;   // Feeder B / CB6
  const FDR_C_X = 550;   // Feeder C / CB7

  // CB positions
  const CB1_Y = 85;   // source CBs
  const CB2_Y = 85;
  const CB3_Y = 175;  // TX HV CBs
  const CB4_Y = 175;
  const CB5_Y = 355;  // feeder CBs
  const CB6_Y = 355;
  const CB7_Y = 355;

  const TX1_Y = 228;
  const TX2_Y = 228;

  const cb = grid.cb_states || new Array(7).fill(true);

  // Path connectivity
  const hvLive      = grid.source1_connected || grid.source2_connected;
  const tx1Live     = hvLive && cb[2] && !grid.tx1_tripped;
  const tx2Live     = hvLive && cb[3] && !grid.tx2_tripped;
  const lvLive      = tx1Live || tx2Live;
  const src1Color   = cb[0] ? C.energized : C.tripped;
  const src2Color   = cb[1] ? C.energized : C.tripped;
  const hvColor     = hvLive ? C.hvBus : "#4b5563";
  const lvColor     = lvLive ? C.lvBus : "#4b5563";
  const tx1Color    = tx1Live ? C.energized : C.tripped;
  const tx2Color    = tx2Live ? C.energized : C.tripped;

  // Particles
  const src1Particles = useFlowParticles(cb[0], 4);
  const src2Particles = useFlowParticles(cb[1], 4);
  const tx1Particles  = useFlowParticles(tx1Live, 5);
  const tx2Particles  = useFlowParticles(tx2Live, 5);
  const fdrAParticles = useFlowParticles(grid.feeder_a_live, 4);
  const fdrBParticles = useFlowParticles(grid.feeder_b_live, 4);
  const fdrCParticles = useFlowParticles(grid.feeder_c_live, 4);

  // Blackout overlay opacity
  const [blackoutOpacity, setBlackoutOpacity] = useState(0);
  useEffect(() => {
    if (grid.blackout) {
      let v = 0;
      const iv = setInterval(() => {
        v = Math.min(0.88, v + 0.04);
        setBlackoutOpacity(v);
        if (v >= 0.88) clearInterval(iv);
      }, 30);
    } else {
      setBlackoutOpacity(0);
    }
  }, [grid.blackout]);

  // Frequency color
  const freqColor = grid.frequency < 58.5 ? C.tripped :
                    grid.frequency < 59.5 ? C.warn : C.energized;

  return (
    <div className="flex gap-2 bg-gray-950 rounded-lg overflow-hidden">
      {/* ── Konva SLD ─────────────────────────────────────────────── */}
      <div className="flex-1">
        <Stage width={W - 220} height={H}>
          <Layer>
            {/* Background */}
            <Rect x={0} y={0} width={W - 220} height={H} fill={C.bg} />

            {/* Title */}
            <Text x={0} y={8} width={W - 220} text="NORTHGATE REGIONAL SUBSTATION  —  230/115kV"
              fontSize={11} fontFamily="monospace" fontStyle="bold"
              fill={C.textDim} align="center" />

            {/* ── Source 1 ──────────────────────────────────── */}
            <Text x={SRC1_X - 35} y={24} text="SOURCE 1" fontSize={8}
              fontFamily="monospace" fill={src1Color} width={70} align="center" />
            <Text x={SRC1_X - 35} y={34} text="GEN · 165MW" fontSize={7}
              fontFamily="monospace" fill={C.textDim} width={70} align="center" />
            {/* Incoming line */}
            <Line points={[SRC1_X, 44, SRC1_X, CB1_Y - 7]} stroke={src1Color} strokeWidth={2} />
            <CBSymbol x={SRC1_X} y={CB1_Y} closed={cb[0]} label="CB1" />
            <Line points={[SRC1_X, CB1_Y + 7, SRC1_X, HV_BUS_Y]}
              stroke={src1Color} strokeWidth={2} />

            {/* ── Source 2 ──────────────────────────────────── */}
            <Text x={SRC2_X - 35} y={24} text="SOURCE 2" fontSize={8}
              fontFamily="monospace" fill={src2Color} width={70} align="center" />
            <Text x={SRC2_X - 35} y={34} text="GRID · 135MW" fontSize={7}
              fontFamily="monospace" fill={C.textDim} width={70} align="center" />
            <Line points={[SRC2_X, 44, SRC2_X, CB2_Y - 7]} stroke={src2Color} strokeWidth={2} />
            <CBSymbol x={SRC2_X} y={CB2_Y} closed={cb[1]} label="CB2" />
            <Line points={[SRC2_X, CB2_Y + 7, SRC2_X, HV_BUS_Y]}
              stroke={src2Color} strokeWidth={2} />

            {/* ── 230kV HV Bus ──────────────────────────────── */}
            <Rect x={BUS_X1} y={HV_BUS_Y - 3} width={BUS_X2 - BUS_X1} height={6}
              fill={hvColor} cornerRadius={2} />
            <Text x={BUS_X1 - 60} y={HV_BUS_Y - 6} text="230kV" fontSize={9}
              fontFamily="monospace" fontStyle="bold" fill={hvColor} />

            {/* ── TX1 branch ────────────────────────────────── */}
            <Line points={[TX1_X, HV_BUS_Y + 3, TX1_X, CB3_Y - 7]}
              stroke={tx1Color} strokeWidth={2} />
            <CBSymbol x={TX1_X} y={CB3_Y} closed={cb[2]} label="CB3" />
            <Line points={[TX1_X, CB3_Y + 7, TX1_X, TX1_Y - 22]}
              stroke={tx1Color} strokeWidth={2} />
            <TransformerSymbol
              x={TX1_X} y={TX1_Y}
              loadPct={grid.tx1_load_pct} temp={grid.tx1_temp}
              tripped={grid.tx1_tripped} label="TX1"
            />
            <Line points={[TX1_X, TX1_Y + 22, TX1_X, LV_BUS_Y - 3]}
              stroke={tx1Color} strokeWidth={2} />

            {/* ── TX2 branch ────────────────────────────────── */}
            <Line points={[TX2_X, HV_BUS_Y + 3, TX2_X, CB4_Y - 7]}
              stroke={tx2Color} strokeWidth={2} />
            <CBSymbol x={TX2_X} y={CB4_Y} closed={cb[3]} label="CB4" />
            <Line points={[TX2_X, CB4_Y + 7, TX2_X, TX2_Y - 22]}
              stroke={tx2Color} strokeWidth={2} />
            <TransformerSymbol
              x={TX2_X} y={TX2_Y}
              loadPct={grid.tx2_load_pct} temp={grid.tx2_temp}
              tripped={grid.tx2_tripped} label="TX2"
            />
            <Line points={[TX2_X, TX2_Y + 22, TX2_X, LV_BUS_Y - 3]}
              stroke={tx2Color} strokeWidth={2} />

            {/* ── 115kV LV Bus ──────────────────────────────── */}
            <Rect x={BUS_X1} y={LV_BUS_Y - 2} width={BUS_X2 - BUS_X1} height={4}
              fill={lvColor} cornerRadius={1} />
            <Text x={BUS_X1 - 60} y={LV_BUS_Y - 5} text="115kV" fontSize={9}
              fontFamily="monospace" fontStyle="bold" fill={lvColor} />

            {/* ── Feeder A ──────────────────────────────────── */}
            <Line points={[FDR_A_X, LV_BUS_Y + 2, FDR_A_X, CB5_Y - 7]}
              stroke={grid.feeder_a_live ? lvColor : C.tripped} strokeWidth={1.5} />
            <CBSymbol x={FDR_A_X} y={CB5_Y} closed={cb[4]} label="CB5" />
            <Line points={[FDR_A_X, CB5_Y + 7, FDR_A_X, 398]}
              stroke={grid.feeder_a_live ? C.energized : C.tripped} strokeWidth={1.5} />
            <LoadIcon x={FDR_A_X} y={398} live={grid.feeder_a_live}
              label="Industrial" mw={80} />

            {/* ── Feeder B ──────────────────────────────────── */}
            <Line points={[FDR_B_X, LV_BUS_Y + 2, FDR_B_X, CB6_Y - 7]}
              stroke={grid.feeder_b_live ? lvColor : C.tripped} strokeWidth={1.5} />
            <CBSymbol x={FDR_B_X} y={CB6_Y} closed={cb[5]} label="CB6" />
            <Line points={[FDR_B_X, CB6_Y + 7, FDR_B_X, 398]}
              stroke={grid.feeder_b_live ? C.energized : C.tripped} strokeWidth={1.5} />
            <LoadIcon x={FDR_B_X} y={398} live={grid.feeder_b_live}
              label="Residential" mw={65} />

            {/* ── Feeder C ──────────────────────────────────── */}
            <Line points={[FDR_C_X, LV_BUS_Y + 2, FDR_C_X, CB7_Y - 7]}
              stroke={grid.feeder_c_live ? lvColor : C.tripped} strokeWidth={1.5} />
            <CBSymbol x={FDR_C_X} y={CB7_Y} closed={cb[6]} label="CB7" />
            <Line points={[FDR_C_X, CB7_Y + 7, FDR_C_X, 398]}
              stroke={grid.feeder_c_live ? C.energized : C.tripped} strokeWidth={1.5} />
            <LoadIcon x={FDR_C_X} y={398} live={grid.feeder_c_live}
              label="Critical" mw={45} />

            {/* ── Flow particles ────────────────────────────── */}
            {src1Particles.map(p => (
              <FlowDot key={p.id} x1={SRC1_X} y1={44} x2={SRC1_X} y2={HV_BUS_Y}
                progress={p.progress} color={C.flow} />
            ))}
            {src2Particles.map(p => (
              <FlowDot key={p.id} x1={SRC2_X} y1={44} x2={SRC2_X} y2={HV_BUS_Y}
                progress={p.progress} color={C.flow} />
            ))}
            {tx1Particles.map(p => (
              <FlowDot key={p.id} x1={TX1_X} y1={HV_BUS_Y} x2={TX1_X} y2={LV_BUS_Y}
                progress={p.progress} color={C.flow} />
            ))}
            {tx2Particles.map(p => (
              <FlowDot key={p.id} x1={TX2_X} y1={HV_BUS_Y} x2={TX2_X} y2={LV_BUS_Y}
                progress={p.progress} color={C.flow} />
            ))}
            {fdrAParticles.map(p => (
              <FlowDot key={p.id} x1={FDR_A_X} y1={LV_BUS_Y} x2={FDR_A_X} y2={430}
                progress={p.progress} color={C.flow} />
            ))}
            {fdrBParticles.map(p => (
              <FlowDot key={p.id} x1={FDR_B_X} y1={LV_BUS_Y} x2={FDR_B_X} y2={430}
                progress={p.progress} color={C.flow} />
            ))}
            {fdrCParticles.map(p => (
              <FlowDot key={p.id} x1={FDR_C_X} y1={LV_BUS_Y} x2={FDR_C_X} y2={430}
                progress={p.progress} color={C.flow} />
            ))}

            {/* ── Frequency arc gauge ───────────────────────── */}
            <Text x={270} y={468} text="FREQUENCY" fontSize={9} fontFamily="monospace"
              fill={C.textDim} width={140} align="center" />
            <Text x={270} y={495} text={`${grid.frequency.toFixed(3)} Hz`}
              fontSize={20} fontFamily="monospace" fontStyle="bold"
              fill={freqColor} width={140} align="center" />
            <Text x={270} y={520} text="NOMINAL: 60.000 Hz" fontSize={8}
              fontFamily="monospace" fill={C.textDim} width={140} align="center" />

            {/* Grid stress bar */}
            <Text x={30} y={470} text="GRID STRESS" fontSize={8}
              fontFamily="monospace" fill={C.textDim} />
            <Rect x={30} y={482} width={220} height={8} fill="#1f2937" cornerRadius={4} />
            <Rect x={30} y={482}
              width={Math.max(0, (grid.grid_stress / 100) * 220)} height={8}
              fill={grid.grid_stress > 75 ? C.tripped : grid.grid_stress > 45 ? C.warn : C.energized}
              cornerRadius={4} />
            <Text x={256} y={480} text={`${grid.grid_stress.toFixed(0)}%`}
              fontSize={9} fontFamily="monospace" fill={C.textBright} />

            {/* Event log strip */}
            <Rect x={30} y={500} width={620} height={50} fill="#0f172a"
              stroke="#1e3a5f" strokeWidth={1} cornerRadius={4} />
            <Text x={36} y={504} text="SCADA EVENT LOG" fontSize={7}
              fontFamily="monospace" fontStyle="bold" fill="#3b82f6" />
            {(grid.events || []).slice(-3).map((evt, i) => (
              <Text key={i} x={36} y={514 + i * 11} text={evt}
                fontSize={7.5} fontFamily="monospace"
                fill={evt.includes("BLACKOUT") || evt.includes("TRIP") ? C.tripped :
                      evt.includes("RECOVERY") ? C.energized : C.textDim} />
            ))}

            {/* ── Blackout overlay ──────────────────────────── */}
            {blackoutOpacity > 0 && (
              <>
                <Rect x={0} y={0} width={W - 220} height={H}
                  fill={`rgba(0,0,0,${blackoutOpacity})`} />
                {blackoutOpacity > 0.5 && (
                  <>
                    <Text x={0} y={200} width={W - 220}
                      text="BLACKOUT" fontSize={64} fontFamily="monospace"
                      fontStyle="bold" fill="rgba(239,68,68,0.9)" align="center" />
                    <Text x={0} y={275} width={W - 220}
                      text="TOTAL LOSS OF SUPPLY" fontSize={16} fontFamily="monospace"
                      fill="rgba(239,68,68,0.7)" align="center" />
                    <Text x={0} y={310} width={W - 220}
                      text="190 MW — ALL FEEDER ZONES DARK"
                      fontSize={12} fontFamily="monospace"
                      fill="rgba(239,68,68,0.5)" align="center" />
                  </>
                )}
              </>
            )}
          </Layer>
        </Stage>
      </div>

      {/* ── Right measurement panel ──────────────────────────────────── */}
      <div className="w-[210px] bg-gray-900 border-l border-gray-800 p-3 flex flex-col gap-3 text-xs font-mono">
        {/* Header */}
        <div className="text-center border-b border-gray-700 pb-2">
          <div className="text-gray-400 text-[10px] uppercase tracking-widest">Northgate IED1</div>
          <div className={`text-lg font-bold mt-1 ${
            grid.blackout ? "text-red-500 animate-pulse" :
            grid.grid_stress > 60 ? "text-amber-400" : "text-green-400"
          }`}>
            {grid.blackout ? "BLACKOUT" : grid.grid_stress > 60 ? "HIGH STRESS" : "NORMAL"}
          </div>
        </div>

        {/* Frequency — large and prominent */}
        <div className={`rounded p-2 text-center border ${
          grid.frequency < 58.5 ? "border-red-700 bg-red-900/20" :
          grid.frequency < 59.5 ? "border-amber-700 bg-amber-900/10" :
          "border-green-800 bg-green-900/10"
        }`}>
          <div className="text-gray-500 text-[9px] uppercase tracking-widest">Frequency</div>
          <div className={`text-2xl font-bold tabular-nums ${
            grid.frequency < 58.5 ? "text-red-400" :
            grid.frequency < 59.5 ? "text-amber-400" : "text-green-400"
          }`}>
            {grid.frequency > 0 ? grid.frequency.toFixed(2) : "---"}
          </div>
          <div className="text-gray-600 text-[9px]">Hz · Nominal 60.000</div>
        </div>

        {/* Bus voltages */}
        <div className="space-y-0.5">
          <div className="text-gray-600 text-[9px] uppercase tracking-widest mb-1">Bus Voltages</div>
          <MeasRow label="230kV Bus"
            value={grid.hv_voltage > 0 ? grid.hv_voltage.toFixed(0) : "---"}
            unit="kV"
            color={grid.hv_voltage > 200 ? "#f59e0b" : grid.hv_voltage > 0 ? "#60a5fa" : "#4b5563"} />
          <MeasRow label="115kV Bus"
            value={grid.lv_voltage > 0 ? grid.lv_voltage.toFixed(0) : "---"}
            unit="kV"
            color={grid.lv_voltage > 100 ? "#60a5fa" : grid.lv_voltage > 0 ? "#f59e0b" : "#4b5563"} />
        </div>

        {/* Transformer loading */}
        <div className="space-y-1.5">
          <div className="text-gray-600 text-[9px] uppercase tracking-widest mb-1">Transformers</div>
          {[
            { label: "TX1 300MVA", load: grid.tx1_load_pct, temp: grid.tx1_temp, tripped: grid.tx1_tripped },
            { label: "TX2 200MVA", load: grid.tx2_load_pct, temp: grid.tx2_temp, tripped: grid.tx2_tripped },
          ].map(tx => (
            <div key={tx.label}
              className={`rounded p-1.5 border ${
                tx.tripped ? "border-red-800 bg-red-900/20" :
                tx.load > 85 ? "border-amber-800 bg-amber-900/10" :
                "border-gray-800 bg-gray-800/30"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className={tx.tripped ? "text-red-400" : "text-gray-300"}>{tx.label}</span>
                <span className={
                  tx.tripped ? "text-red-400 text-[9px]" :
                  tx.load > 85 ? "text-amber-400 text-[9px]" : "text-green-400 text-[9px]"
                }>
                  {tx.tripped ? "TRIPPED" : `${tx.load.toFixed(0)}%`}
                </span>
              </div>
              {!tx.tripped && (
                <div className="mt-1">
                  <div className="flex justify-between text-[8px] text-gray-600 mb-0.5">
                    <span>Load</span><span>{tx.load.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, tx.load)}%`,
                        backgroundColor: tx.load > 85 ? "#ef4444" : tx.load > 65 ? "#f59e0b" : "#22c55e",
                      }} />
                  </div>
                  <div className="text-[8px] text-gray-500 mt-0.5">
                    {tx.temp.toFixed(0)}°C
                    <span className={tx.temp > 85 ? " text-amber-400" : tx.temp > 95 ? " text-red-400" : ""}>
                      {tx.temp > 95 ? " ⚠ HOT" : tx.temp > 75 ? " WARM" : ""}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Power */}
        <div className="space-y-0.5">
          <div className="text-gray-600 text-[9px] uppercase tracking-widest mb-1">Power Flow</div>
          <MeasRow label="Active" value={grid.active_power.toFixed(0)} unit="MW"
            color={grid.active_power > 0 ? "#e5e7eb" : "#4b5563"} />
          <MeasRow label="Reactive" value={grid.reactive_power.toFixed(0)} unit="MVAR"
            color="#9ca3af" />
          <MeasRow label="Power Factor" value={grid.power_factor.toFixed(3)} unit=""
            color="#9ca3af" />
        </div>

        {/* Protection relay status */}
        <div className="space-y-0.5">
          <div className="text-gray-600 text-[9px] uppercase tracking-widest mb-1">Protection</div>
          {[
            { label: "Master Prot", active: grid.protection_enabled },
            { label: "Differential", active: grid.diff_prot_enabled },
            { label: "Overcurrent", active: grid.overcurrent_enabled },
            { label: "Under-Freq", active: grid.underfreq_enabled },
            { label: "Auto-Recloser", active: grid.autorecloser_enabled },
          ].map(p => (
            <div key={p.label} className="flex items-center justify-between">
              <span className="text-gray-500 text-[9px]">{p.label}</span>
              <span className={`text-[9px] font-bold ${p.active ? "text-green-500" : "text-red-400"}`}>
                {p.active ? "ON" : "OFF"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
