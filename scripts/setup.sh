#!/bin/bash
# CyberCity ICS — Quick Setup Script for macOS
set -e

echo "============================================"
echo "  CyberCity ICS — Setup"
echo "  ICS/OT Cybersecurity Training Platform"
echo "============================================"
echo ""

# Check prerequisites
echo "[1/5] Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "  Node.js not found. Install with: brew install node"
    exit 1
fi
echo "  Node.js: $(node --version)"

if ! command -v python3 &> /dev/null; then
    echo "  Python3 not found. Install with: brew install python@3.11"
    exit 1
fi
echo "  Python: $(python3 --version)"

echo ""

# Install frontend dependencies
echo "[2/5] Installing frontend dependencies..."
cd "$(dirname "$0")/../frontend"
npm install
echo "  Frontend dependencies installed."
echo ""

# Set up Python virtual environment
echo "[3/5] Setting up Python backend..."
cd "$(dirname "$0")/../backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
echo "  Backend dependencies installed."
echo ""

echo "[4/5] Setup complete!"
echo ""
echo "============================================"
echo "  To start the lab, run these in separate terminals:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend"
echo "    source venv/bin/activate"
echo "    python main.py"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo "  Then open: http://localhost:3000"
echo "============================================"
echo ""
echo "[5/5] Or use Docker Compose (from project root):"
echo "    docker-compose up --build"
echo "    Then open: http://localhost:3000"
echo "============================================"
