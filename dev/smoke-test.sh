#!/usr/bin/env bash
#
# Smoke test a built Wiki.js NG image: start it with a throwaway SQLite database,
# complete the setup wizard, log in and load a few pages and assets.
# Used by CI after the image build and before anything is pushed.
#
# Usage:
#   dev/smoke-test.sh <image> [host port]
#
# Configuration (environment variables, all optional):
#   WIKI_PODMAN   Container tool (default: podman; docker works too)
set -euo pipefail

IMAGE="${1:?Usage: dev/smoke-test.sh <image> [host port]}"
PORT="${2:-3099}"
PODMAN="${WIKI_PODMAN:-podman}"
NAME="wikijs-ng-smoke-$$"
BASE="http://127.0.0.1:${PORT}"
ADMIN_EMAIL="smoke@example.com"
ADMIN_PASS="SmokeTest-$$-Pass"

cleanup() {
  "$PODMAN" rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "!! $1" >&2
  echo "---- container logs ----" >&2
  "$PODMAN" logs --tail 60 "$NAME" >&2 || true
  exit 1
}

wait_for() {
  local url="$1" pattern="$2" tries="${3:-90}"
  for _ in $(seq 1 "$tries"); do
    if curl -sf "$url" 2>/dev/null | grep -q "$pattern"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

check_status() {
  local path="$1" expected="${2:-200}" status
  status="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}${path}")"
  [ "$status" = "$expected" ] || fail "GET ${path} returned ${status}, expected ${expected}"
  echo ">> GET ${path}: ${status}"
}

echo ">> Starting ${IMAGE} on port ${PORT}..."
"$PODMAN" run -d --name "$NAME" -p "127.0.0.1:${PORT}:3000" \
  -e DB_TYPE=sqlite -e DB_FILEPATH=/wiki/data/db.sqlite \
  "$IMAGE" >/dev/null

wait_for "${BASE}/" "Wiki.js NG" || fail "Setup page did not come up"
echo ">> Setup page is up"

curl -sf -X POST "${BASE}/finalize" -H 'Content-Type: application/json' \
  -d "{\"adminEmail\":\"${ADMIN_EMAIL}\",\"adminPassword\":\"${ADMIN_PASS}\",\"adminPasswordConfirm\":\"${ADMIN_PASS}\",\"siteUrl\":\"${BASE}\"}" \
  | grep -q '"ok":true' || fail "Setup did not complete"
echo ">> Setup completed"

wait_for "${BASE}/healthz" "ok" || fail "Wiki did not start after setup"
echo ">> Health check OK"

curl -sf -X POST "${BASE}/graphql" -H 'Content-Type: application/json' \
  -d "{\"query\":\"mutation { authentication { login(username: \\\"${ADMIN_EMAIL}\\\", password: \\\"${ADMIN_PASS}\\\", strategy: \\\"local\\\") { responseResult { succeeded } jwt } } }\"}" \
  | grep -q '"succeeded":true' || fail "Admin login failed"
echo ">> Admin login OK"

check_status /
check_status /login
check_status /sitemap.xml
check_status /rss.xml
check_status /_assets/svg/logo-swissmakers.svg
APP_JS="$(curl -sf "${BASE}/login" | grep -o '/_assets/js/app\.[a-z0-9]*\.js' | head -1)"
[ -n "$APP_JS" ] || fail "No app bundle referenced by the login page"
check_status "$APP_JS"

echo ">> Smoke test passed"
