#!/usr/bin/env bash
#
# start.sh — one-command launcher for the TMS backend + frontend.
#
#   ./start.sh
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
RUN_DIR="$SCRIPT_DIR/.run"
BACKEND_PID="$RUN_DIR/backend.pid"
FRONTEND_PID="$RUN_DIR/frontend.pid"
BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"
DB_PASSWORD="123456"
DB_NAME="tms_db"
BACKEND_PORT=8080
FRONTEND_PORT=5173

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

info() { printf "${CYAN}[TMS]${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}[TMS]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[TMS]${NC} %s\n" "$*"; }
err()  { printf "${RED}[TMS]${NC} %s\n" "$*"; }

mkdir -p "$RUN_DIR"
cd "$SCRIPT_DIR"

is_running() { [ -n "$1" ] && [ -d "/proc/$1" ] 2>/dev/null; }

# ---------------------------------------------------------------------------
# 0. Make sure we are not already running.
# ---------------------------------------------------------------------------
for f in "$BACKEND_PID" "$FRONTEND_PID"; do
  if [ -f "$f" ]; then
    pid="$(cat "$f" 2>/dev/null || true)"
    if is_running "$pid"; then
      err "A TMS process (PID $pid) is already running. Stop it first:  ./stop.sh"
      exit 1
    fi
    rm -f "$f"
  fi
done

# ---------------------------------------------------------------------------
# 1. Prerequisite checks.
# ---------------------------------------------------------------------------
command -v java >/dev/null 2>&1 || { err "Java not found. Install OpenJDK 17+:  sudo apt install openjdk-17-jdk"; exit 1; }
command -v node >/dev/null 2>&1 || { err "Node.js not found. Install Node 18+."; exit 1; }
command -v mysql >/dev/null 2>&1 || { err "MySQL/MariaDB client not found. Install it:  sudo apt install mariadb-server"; exit 1; }
command -v curl >/dev/null 2>&1 || { err "curl is required."; exit 1; }

info "Java : $(java -version 2>&1 | head -1)"
info "Node : $(command node -v)  npm $(command npm -v)"

# ---------------------------------------------------------------------------
# 2. Database service.
# ---------------------------------------------------------------------------
if  ( systemctl is-active --quiet mysql 2>/dev/null || systemctl is-active --quiet mariadb 2>/dev/null ); then
  ok "Database service is running."
else
  warn "Database service is not running — attempting to start it (may require sudo)."
  sudo systemctl start mysql 2>/dev/null \
    || sudo systemctl start mariadb 2>/dev/null \
    || { err "Could not start the database. Run manually:  sudo systemctl start mysql"; exit 1; }
  sleep 2
  ok "Database service started."
fi

# ---------------------------------------------------------------------------
# 3. Ensure root password + tms_db exist (idempotent).
# ---------------------------------------------------------------------------
if ! mysql -u root -p"$DB_PASSWORD" -h 127.0.0.1 -e "SELECT 1" >/dev/null 2>&1; then
  warn "Setting MySQL root password to '$DB_PASSWORD' (used by the backend)."
  echo "$DB_PASSWORD" | sudo -S mysql -u root \
    -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$DB_PASSWORD'; FLUSH PRIVILEGES;" 2>/dev/null \
    || { err "Could not set the MySQL root password. Fix it manually or edit DB_PASSWORD in start.sh."; exit 1; }
fi

if ! mysql -u root -p"$DB_PASSWORD" -h 127.0.0.1 -e "USE $DB_NAME" >/dev/null 2>&1; then
  echo "$DB_PASSWORD" | sudo -S mysql -u root \
    -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
fi
mysql -u root -p"$DB_PASSWORD" -h 127.0.0.1 -e "USE $DB_NAME" >/dev/null 2>&1 \
  && ok "Database '$DB_NAME' is ready." \
  || { err "Database '$DB_NAME' could not be prepared."; exit 1; }

# ---------------------------------------------------------------------------
# 4. Frontend dependencies.
# ---------------------------------------------------------------------------
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  info "Installing frontend dependencies (first run)..."
  ( cd "$FRONTEND_DIR" && npm install ) || { err "npm install failed."; exit 1; }
  ok "Frontend dependencies installed."
fi

# ---------------------------------------------------------------------------
# 5. Build + start the backend.
# ---------------------------------------------------------------------------
info "Building backend jar (this may take a while the first time)..."
( cd "$BACKEND_DIR" && ./mvnw -q -DskipTests package ) || { err "Backend build failed."; exit 1; }

BACKEND_JAR="$(ls -t "$BACKEND_DIR"/target/*.jar 2>/dev/null | grep -v '\.original$' | head -1)"
[ -n "${BACKEND_JAR:-}" ] || { err "No backend jar produced."; exit 1; }
info "Launching backend: $(basename "$BACKEND_JAR")"
( cd "$BACKEND_DIR" && exec java -jar "$BACKEND_JAR" ) > "$BACKEND_LOG" 2>&1 &
echo $! > "$BACKEND_PID"
ok "Backend starting (PID $(cat "$BACKEND_PID")) — logs: .run/backend.log"

# ---------------------------------------------------------------------------
# 6. Wait for the backend, then start the frontend.
# ---------------------------------------------------------------------------
info "Waiting for backend on :$BACKEND_PORT ..."
for _ in $(seq 1 120); do
  if curl -fsS -o /dev/null "http://localhost:$BACKEND_PORT/v3/api-docs"; then
    ok "Backend is up at http://localhost:$BACKEND_PORT"
    break
  fi
  sleep 1
done
if ! curl -fsS -o /dev/null "http://localhost:$BACKEND_PORT/v3/api-docs"; then
  warn "Backend did not become ready within 120s — inspect .run/backend.log"
fi

info "Launching frontend (Vite) on :$FRONTEND_PORT ..."
( cd "$FRONTEND_DIR" && exec node_modules/.bin/vite ) > "$FRONTEND_LOG" 2>&1 &
echo $! > "$FRONTEND_PID"
ok "Frontend starting (PID $(cat "$FRONTEND_PID")) — logs: .run/frontend.log"

for _ in $(seq 1 45); do
  if curl -fsS -o /dev/null "http://localhost:$FRONTEND_PORT"; then
    ok "Frontend is up at http://localhost:$FRONTEND_PORT"
    break
  fi
  sleep 1
done

# ---------------------------------------------------------------------------
# 7. Summary.
# ---------------------------------------------------------------------------
cat <<EOF

${GREEN}============================================================${NC}
${GREEN}  TMS is running${NC}
${GREEN}============================================================${NC}
  Frontend : ${CYAN}http://localhost:$FRONTEND_PORT${NC}
  Backend  : ${CYAN}http://localhost:$BACKEND_PORT/api${NC}
  Swagger  : ${CYAN}http://localhost:$BACKEND_PORT/swagger-ui.html${NC}
  Backend log  : .run/backend.log
  Frontend log : .run/frontend.log
  Stop         : ${YELLOW}./stop.sh${NC}
${GREEN}============================================================${NC}

${YELLOW}Demo accounts (password for ALL: 123456)${NC}
  admin@gmail.com     (ADMIN)
  tailor@gmail.com    (TAILOR)
  cashier@gmail.com   (CASHIER)
  delivery@gmail.com  (DELIVERY)
  customer@gmail.com  (CUSTOMER)
EOF