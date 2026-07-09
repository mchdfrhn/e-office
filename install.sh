#!/bin/bash

# Script to install all dependencies (frontend + backend)
# Usage: ./install.sh

set -e

echo "Installing all dependencies..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR/frontend"
npm install

cd "$SCRIPT_DIR/backend"
npm install

echo "All dependencies installed!"
