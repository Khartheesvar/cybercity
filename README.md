# CyberCity ICS

Industrial Control Systems (ICS/OT) Cybersecurity Training Platform.

A scenario-based training lab where students learn to assess and exploit real-world industrial control systems. Each scenario simulates a different critical infrastructure facility with live physics, real ICS protocols, and visual feedback.

## Scenarios

| # | Facility | Protocol | Status |
|---|----------|----------|--------|
| 1 | **HydraGuard** — Dam & Water Treatment Plant | Modbus/TCP | Active |
| 2 | Traffic Light Control System | NTCIP | Coming Soon |
| 3 | Power Grid Substation | IEC 61850 | Coming Soon |

### Scenario 1: HydraGuard (Dam & Water Treatment)

Students exploit an unprotected Modbus/TCP server controlling a dam's sluice gates and a water treatment plant's chemical dosing — inspired by real incidents (Bowman Avenue Dam 2013, Oldsmar FL 2021).

**Attack phases:**
1. **Reconnaissance** — Scan Modbus registers to map the system
2. **Eavesdropping** — Capture cleartext Modbus traffic
3. **Register Manipulation** — Write to PLC registers to open gates, spike chemicals, disable pumps

## Quick Start

### Prerequisites

- **Node.js** 20+ (`brew install node`)
- **Python** 3.11+ (`brew install python@3.11`)

### Setup

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Run (two terminals)

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
python main.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

### Run with Docker (alternative)

```bash
docker-compose up --build
```

Open **http://localhost:3000**.

## Architecture

```
Browser (localhost:3000)
    │ WebSocket (Socket.IO)
    ▼
FastAPI + Socket.IO (localhost:8000)
    │ Internal
    ▼
Modbus TCP Server (localhost:5020)  ◄── Student attacks here
    │ Internal
    ▼
Physics Simulation Engine
    ├── Dam: water level, gates, inflow/outflow
    └── Treatment Plant: chlorine, pH, tanks, pumps
```

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Konva.js, Recharts, Tailwind CSS
- **Backend:** Python, FastAPI, pymodbus, python-socketio
- **Protocol:** Modbus/TCP (intentionally insecure for training)
