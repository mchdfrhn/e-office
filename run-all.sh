#!/bin/bash

# Script to run both backend and frontend of E-Office application
# Usage: ./run-all.sh {start|start-backend|start-frontend|stop|status|restart|install|install-all}

set -e

echo "Starting E-Office application..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to check if a process is running
check_process_running() {
    local name=$1
    pgrep -f "$name" > /dev/null 2>&1
    return $?
}

# Function to start database
start_database() {
    echo "Starting embedded PostgreSQL database..."
    cd "$SCRIPT_DIR/backend"
    if check_process_running "embedded-postgres"; then
        echo "Database is already running"
    else
        node scripts/start-embedded-postgres.js &
        DB_PID=$!
        echo "Database started with PID: $DB_PID"
        sleep 3  # Give database time to initialize
    fi
}

# Function to start backend
start_backend() {
    echo "Starting backend server..."
    cd "$SCRIPT_DIR/backend"
    if check_process_running "node.*src/server.js"; then
        echo "Backend is already running"
    else
        npm run dev &
        BACKEND_PID=$!
        echo "Backend started with PID: $BACKEND_PID"
    fi
}

# Function to start frontend
start_frontend() {
    echo "Starting frontend server..."
    cd "$SCRIPT_DIR/frontend"
    if check_process_running "next dev"; then
        echo "Frontend is already running"
    else
        npm run dev &
        FRONTEND_PID=$!
        echo "Frontend started with PID: $FRONTEND_PID"
    fi
}

# Function to stop all services
stop_all() {
    echo "Stopping all services..."
    pkill -f "embedded-postgres" || true
    pkill -f "node.*src/server.js" || true
    pkill -f "next dev" || true
    echo "All services stopped"
}

# Function to check services status
check_status() {
    echo "Checking services status..."
    echo "Database:"
    if check_process_running "embedded-postgres"; then
        echo "  - Running"
    else
        echo "  - Not running"
    fi
    echo "Backend:"
    if check_process_running "node.*src/server.js"; then
        echo "  - Running"
    else
        echo "  - Not running"
    fi
    echo "Frontend:"
    if check_process_running "next dev"; then
        echo "  - Running"
    else
        echo "  - Not running"
    fi
}

# Function to install dependencies
install_deps() {
    echo "Installing frontend dependencies..."
    cd "$SCRIPT_DIR/frontend"
    npm install
    echo "Frontend dependencies installed!"
}

# Function to install all dependencies (frontend + backend)
install_all() {
    echo "Installing all dependencies..."
    cd "$SCRIPT_DIR/frontend"
    npm install
    cd "$SCRIPT_DIR/backend"
    npm install
    echo "All dependencies installed!"
}

# Function to run both backend and frontend
run_all() {
    start_database
    start_backend
    start_frontend
    echo ""
    echo "E-Office application is running!"
    echo "  - Database: localhost:5432 (embedded PostgreSQL)"
    echo "  - Backend: http://localhost:8000"
    echo "  - Frontend: http://localhost:3000"
    echo ""
    echo "Press Ctrl+C to stop all services"
}

# Main script
case "${1:-start}" in
    start)
        run_all
        ;;
    start-backend)
        start_backend
        echo "Backend started"
        ;;
    start-frontend)
        start_frontend
        echo "Frontend started"
        ;;
    stop)
        stop_all
        ;;
    status)
        check_status
        ;;
    restart)
        stop_all
        sleep 2
        run_all
        ;;
    install)
        install_deps
        ;;
    install-all)
        install_all
        ;;
    *)
        echo "Usage: $0 {start|start-backend|start-frontend|stop|status|restart|install|install-all}"
        exit 1
        ;;
esac
