import { useState } from "react";
import { useProcessData } from "./hooks/useProcessData";
import { DamView } from "./components/dam/DamView";
import { TreatmentView } from "./components/treatment/TreatmentView";
import { ControlRoom } from "./components/controlroom/ControlRoom";
import { AttackConsole } from "./components/attack/AttackConsole";
import { CityView } from "./components/city/CityView";

type View = "dam" | "treatment" | "controlroom" | "attack";
type Screen = "city" | "dam";

const NAV_ITEMS: { id: View; label: string; color: string }[] = [
  { id: "dam", label: "Dam Overview", color: "text-blue-400" },
  { id: "treatment", label: "Treatment Plant", color: "text-cyan-400" },
  { id: "controlroom", label: "Control Room", color: "text-green-400" },
  { id: "attack", label: "Lab Monitor", color: "text-red-400" },
];

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("city");
  const [activeView, setActiveView] = useState<View>("dam");
  const { displayed, actual, connected, sendCommand } = useProcessData();

  // ─── City Overview ──────────────────────────────────────────
  if (currentScreen === "city") {
    return <CityView onSelectScenario={() => setCurrentScreen("dam")} />;
  }

  // ─── Dam Scenario (existing UI — unchanged) ─────────────────
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation Bar */}
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Back to city */}
          <button
            onClick={() => setCurrentScreen("city")}
            className="text-gray-500 hover:text-gray-300 font-mono text-xs px-2 py-1 rounded hover:bg-gray-800 transition-colors"
            title="Back to City"
          >
            &larr;
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm">
              HG
            </div>
            <span className="font-mono font-bold text-gray-200 text-sm">
              HydraGuard
            </span>
          </div>

          {/* View tabs */}
          <div className="flex gap-1 ml-4">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`px-3 py-1.5 rounded font-mono text-xs transition-colors ${
                  activeView === item.id
                    ? `bg-gray-800 ${item.color} border border-gray-700`
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-green-500" : "bg-red-500 animate-pulse"
              }`}
            />
            <span className={connected ? "text-green-400" : "text-red-400"}>
              {connected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>
          <div className="text-gray-600">
            Tick: {actual.tick}
          </div>
        </div>
      </nav>

      {/* Main Content — all views stay mounted so trend data accumulates */}
      <main className="p-2">
        <div style={{ display: activeView === "dam" ? "block" : "none" }}>
          <DamView dam={displayed.dam} />
        </div>
        <div style={{ display: activeView === "treatment" ? "block" : "none" }}>
          <TreatmentView plant={displayed.plant} />
        </div>
        <div style={{ display: activeView === "controlroom" ? "block" : "none" }}>
          <ControlRoom state={displayed} sendCommand={sendCommand} />
        </div>
        <div style={{ display: activeView === "attack" ? "block" : "none" }}>
          <AttackConsole displayed={displayed} actual={actual} />
        </div>
      </main>
    </div>
  );
}

export default App;
