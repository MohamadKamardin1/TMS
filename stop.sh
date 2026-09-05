#!/usr/bin/env bash
#
# stop.sh — stops the TMS backend and frontend launched by start.sh,
# and frees ports 8080 / 5173 from any stray processes.
#
#   ./stop.sh
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$SCRIPT_DIR/.run"
BACKEND_PID="$RUN_DIR/backend.pid"
FRONTEND_PID="$RUN_DIR/frontend.pid"
BACKEND_PORT=8080
FRONTEND_PORT=5173

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

ok()   { printf "${GREEN}[TMS]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[TMS]${NC} %s\n" "$*"; }
err()  { printf "${RED}[TMS]${NC} %s\n" "$*"; }

# Kill a PID recorded in a pidfile, remove the pidfile afterwards.
stop_from_file() {
  local pid_file="$1" label="$2" pid=""
  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    rm -f "$pid_file"
    if [ -n "$pid" ] && [ -d "/proc/$pid" ] 2>/dev/null; then
      ok "Stopping $label (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      for _ in $(seq 1 20); do
        [ -d "/proc/$pid" ] 2>/dev/null || { ok "$label stopped."; return 0; }
        sleep 0.5
      done
      warn "Force-killing $label..."
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
}

# Kill any process still bound to a port (fallback), e.g. orphaned children.
free_port() {
  local port="$1" label="$2" pids pid
  pids="$(ss -ltnp 2>/dev/null | grep ":$port " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)"
  for pid in $pids; do
    [ -n "$pid" ] || continue
    warn "Stopping stray $label process (PID $pid) on port $port..."
    kill "$pid" 2>/dev/null || true
    sleep 1
    [ -d "/proc/$pid" ] 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  done
}

stop_from_file "$BACKEND_PID" "backend"
stop_from_file "$FRONTEND_PID" "frontend"

free_port "$BACKEND_PORT" "backend"
free_port "$FRONTEND_PORT" "frontend"

ok "All TMS processes stopped. Ports $BACKEND_PORT and $FRONTEND_PORT are free."