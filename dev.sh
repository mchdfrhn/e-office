#!/bin/bash

# Script to start both backend and frontend development servers
# Usage: ./dev.sh

set -e

echo "Starting development servers..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start backend in background
echo "Starting backend..."
cd "$SCRIPT_DIR/backend"
npm run dev &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Start frontend in background
echo "Starting frontend..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for both processes
wait
