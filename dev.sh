#!/usr/bin/env bash
# Dev task runner for Tollman's (Digital Returns Bridge).
# Server runs in Docker (postgres + WildFly). App = Android debug build.
# Usage: ./dev.sh <task>   (run ./dev.sh help for list)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID="$ROOT/android-driver-app"
COMPOSE=(docker compose -f "$ROOT/infra/docker-compose.yml" --env-file "$ROOT/infra/.env")
API="http://localhost:8080/digital-returns-bridge/api"
PKG="com.drb.driver"
LAUNCH="$PKG/.ui.LoginActivity"

c() { printf "\033[1;36m▶ %s\033[0m\n" "$*"; }   # cyan banner

ensure_env() { [ -f "$ROOT/infra/.env" ] || cp "$ROOT/infra/.env.example" "$ROOT/infra/.env"; }

# ─────────────────────────── docker / server ──────────────────────────
# rebuild: recompile WAR + rebuild server image + recreate container.
docker_rebuild() {
  ensure_env
  c "docker compose build server"
  "${COMPOSE[@]}" build server
  c "docker compose up -d (recreate)"
  "${COMPOSE[@]}" up -d
}

# up/down: start or stop the whole stack (no rebuild).
stack_up()   { ensure_env; c "docker compose up -d"; "${COMPOSE[@]}" up -d; }
stack_down() { c "docker compose down"; "${COMPOSE[@]}" down; }

# restart server only — fast, no rebuild (use when env/data changed, not code).
server_restart() { c "docker compose restart server"; "${COMPOSE[@]}" restart server; }

# nuke: wipe volumes too (fresh DB — re-runs schema.sql + seed.sql).
stack_nuke() { c "docker compose down -v"; "${COMPOSE[@]}" down -v --remove-orphans; }

# ─────────────────────────── android app ──────────────────────────────
require_device() {
  adb get-state >/dev/null 2>&1 || { echo "No device/emulator. Plug in phone or start emulator (adb devices)."; exit 1; }
}
# reinstall: rebuild APK, push to device, launch.
app_reinstall() {
  require_device
  c "gradlew installDebug (rebuild + push)"
  (cd "$ANDROID" && ./gradlew installDebug)
  c "launch $LAUNCH"
  adb shell am start -n "$LAUNCH"
}
app_logcat() { require_device; c "logcat (app only)"; adb logcat --pid="$(adb shell pidof -s "$PKG")"; }

# ─────────────────────────── logs ─────────────────────────────────────
logs_server() { c "docker compose logs -f server"; "${COMPOSE[@]}" logs -f server; }
logs_debug()  { c "GET $API/debug/logs?n=${1:-50}"; curl -s "$API/debug/logs?n=${1:-50}" | python3 -m json.tool 2>/dev/null || curl -s "$API/debug/logs?n=${1:-50}"; }
logs_clear()  { c "DELETE $API/debug/logs"; curl -s -X DELETE "$API/debug/logs" -w "HTTP %{http_code}\n"; }

help() {
  cat <<EOF
Tollman's — dev tasks

  Server (Docker):
    docker:rebuild    recompile WAR + rebuild image + recreate container
    server:restart    restart server container only (fast, no rebuild)
    up                start full stack (postgres + server)
    down              stop stack
    nuke              stop + wipe volumes (fresh DB from schema+seed)

  App (Android):
    app:reinstall     rebuild APK + install to device + launch
    app:logcat        stream device logcat for $PKG

  Logs:
    logs:server       follow WildFly logs (docker)
    logs:debug [n]    fetch last n remote/debug logs (default 50)
    logs:clear        empty the debug-log buffer
EOF
}

case "${1:-help}" in
  docker:rebuild) docker_rebuild ;;
  server:restart) server_restart ;;
  up)             stack_up ;;
  down)           stack_down ;;
  nuke)           stack_nuke ;;
  app:reinstall)  app_reinstall ;;
  app:logcat)     app_logcat ;;
  logs:server)    logs_server ;;
  logs:debug)     logs_debug "${2:-50}" ;;
  logs:clear)     logs_clear ;;
  help|-h|--help) help ;;
  *) echo "Unknown task: $1"; echo; help; exit 1 ;;
esac
