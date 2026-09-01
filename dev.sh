#!/usr/bin/env bash
# Dev task runner for Tollman's (Digital Returns Bridge).
# Server runs in Docker (postgres + WildFly). App = Android debug build.
# Usage: ./dev.sh <task>   (run ./dev.sh help for list)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID="$ROOT/android-driver-app"
E2E="$ROOT/e2e"
COMPOSE=(docker compose -f "$ROOT/infra/docker-compose.yml" --env-file "$ROOT/infra/.env")
API="http://localhost:8080/api"   # WAR deploys as ROOT.war -> context root "/", no app-name prefix
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

# ─────────────────────────── e2e (playwright) ─────────────────────────
# NOTE: e2e/global-setup.ts drives the stack ITSELF — it shells out to
# `./dev.sh nuke` + `./dev.sh docker:rebuild` so every run starts from a fresh
# DB (schema+seed) and a WAR built from HEAD. So do NOT run `up` here first;
# that would only build twice. It also preflights the Cloudinary creds in
# infra/.env and aborts before touching containers if they are placeholders.
require_e2e_deps() {
  command -v npm >/dev/null || { echo "npm not found — install Node 18+ to run the e2e suite."; exit 1; }
  [ -d "$E2E/node_modules" ] || { c "npm install (first run)"; (cd "$E2E" && npm install); }
  # Playwright's chromium lives in a shared cache, not node_modules, so it can be
  # missing even when node_modules is present. `install` is a no-op once cached.
  c "playwright install chromium"
  (cd "$E2E" && npx playwright install chromium)
}

# e2e: full suite. Extra args pass straight through to playwright, e.g.
#   ./dev.sh e2e tests/auth.spec.ts
#   ./dev.sh e2e --grep @wizard --workers=4
e2e_run() {
  require_e2e_deps
  c "playwright test ${*:-(all specs)}"
  (cd "$E2E" && npx playwright test "$@")
}

# e2e:fast: skip the WAR rebuild (E2E_SKIP_BUILD=1). DB is still nuked+reseeded.
# Only safe when the deployed WAR already matches HEAD — global-setup's staleness
# check catches the obvious case, not a subtle one.
e2e_fast() {
  require_e2e_deps
  c "playwright test (E2E_SKIP_BUILD=1 — no WAR rebuild)"
  (cd "$E2E" && E2E_SKIP_BUILD=1 npx playwright test "$@")
}

# e2e:report: open the HTML report from the last run.
e2e_report() { c "playwright show-report"; (cd "$E2E" && npx playwright show-report); }

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

  E2E (Playwright — boots its own stack, see note in script):
    e2e [args]        full suite; args pass through (spec path, --grep, --workers)
    e2e:fast [args]   same, but skip the WAR rebuild (E2E_SKIP_BUILD=1)
    e2e:report        open the HTML report from the last run

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
  e2e)            shift; e2e_run "$@" ;;
  e2e:fast)       shift; e2e_fast "$@" ;;
  e2e:report)     e2e_report ;;
  logs:server)    logs_server ;;
  logs:debug)     logs_debug "${2:-50}" ;;
  logs:clear)     logs_clear ;;
  help|-h|--help) help ;;
  *) echo "Unknown task: $1"; echo; help; exit 1 ;;
esac
