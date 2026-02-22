# CyberCity ICS/OT

Industrial Control Systems / Operational Technology (ICS/OT) Cybersecurity Training Platform.

A scenario-based training lab where students learn to assess and exploit real-world industrial control systems. Each scenario simulates a different critical infrastructure facility with live physics, real ICS/OT protocols, and visual feedback.

## Scenarios

| # | Facility | Protocol | Port | Status |
|---|----------|----------|------|--------|
| 1 | **HydraGuard** — Dam & Water Treatment Plant | Modbus/TCP | 5020 | Active |
| 2 | **Traffic Controller** — 4-Way Intersection | SNMP (NTCIP) | 5021 | Active |
| 3 | Power Grid Substation | IEC 61850 MMS | 5022 | Active |

### Scenario 1: HydraGuard (Dam & Water Treatment)

Students exploit an unprotected Modbus/TCP server controlling a dam's sluice gates and a water treatment plant's chemical dosing — inspired by real incidents (Bowman Avenue Dam 2013, Oldsmar FL 2021).

**Attack phases:**
1. **Reconnaissance** — Scan Modbus registers to map the system
2. **Eavesdropping** — Capture cleartext Modbus traffic
3. **Register Manipulation** — Write to PLC registers to open gates, spike chemicals, disable pumps

### Scenario 2: Traffic Controller (4-Way Intersection)

Students exploit a traffic signal controller via SNMP with default community strings — inspired by the 2014 University of Michigan research that found ~100 real traffic controllers with default credentials.

**Attack phases:**
1. **Discovery & Enumeration** — Find SNMP service, guess community strings, walk OID tree
2. **Timing Manipulation** — Change green durations to cause gridlock
3. **Emergency Preemption Abuse** — Trigger EVP override to lock one direction green
4. **Conflict Monitor Bypass** — Disable safety system, force opposing greens (parallels TRISIS/Triton 2017)

## Quick Start

### Prerequisites

- **Node.js** 20+ (`brew install node`)
- **Python** 3.11+ (`brew install python@3.11`)
- **SNMP tools** for Scenario 2 (`brew install net-snmp`)

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
    | WebSocket (Socket.IO)
    v
FastAPI + Socket.IO (localhost:8000)
    |
    +---> Modbus TCP Server (localhost:5020)  <-- Scenario 1 attacks
    |         Dam & Treatment Plant simulation
    |
    +---> SNMP Agent (localhost:5021/udp)     <-- Scenario 2 attacks
    |         Traffic Intersection simulation
    |
    +---> IEC 61850 MMS Server (localhost:5022) <-- Scenario 3 attacks
              Power Grid Substation simulation
```

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Konva.js, Recharts, Tailwind CSS
- **Backend:** Python, FastAPI, pymodbus, pysnmp, python-socketio
- **Protocols:** Modbus/TCP, SNMP v2c, IEC 61850 MMS (intentionally insecure for training)

## Ports

| Port | Protocol | Service |
|------|----------|---------|
| 3000 | TCP | Frontend (Vite dev server) |
| 8000 | TCP | Backend API + WebSocket |
| 5020 | TCP | Modbus/TCP (Scenario 1) |
| 5021 | UDP | SNMP (Scenario 2) |
| 5022 | TCP | IEC 61850 MMS (Scenario 3) |
