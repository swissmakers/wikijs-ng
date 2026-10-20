#!/usr/bin/env bash
#
# Regenerate the README screenshots in docs/screenshots/.
#
# Starts a throwaway container (fresh SQLite database, no storage targets),
# seeds it with demo content (dev/screenshots/seed-demo.js), runs the Cypress
# screenshot spec against it and copies the results. The container is removed
# afterwards.
#
# Usage:
#   dev/screenshots.sh [image] [host port]
#
# Configuration (environment variables, all optional):
#   WIKI_PODMAN   Container tool (default: podman; docker works too). May include a
#                 prefix, e.g. "sudo podman" for images in root's storage — run the
#                 script itself as a normal user, Cypress is installed per user.
set -euo pipefail

IMAGE="${1:-localhost/wikijs-ng:local-test}"
PORT="${2:-3999}"
read -ra PODMAN <<< "${WIKI_PODMAN:-podman}"
NAME="wikijs-ng-screenshots-$$"
BASE="http://127.0.0.1:${PORT}"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASS="Screenshots-$$-Pass"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHOTS_DIR="$REPO_DIR/dev/cypress/screenshots/screenshots.spec.js"
OUT_DIR="$REPO_DIR/docs/screenshots"

cleanup() {
  "${PODMAN[@]}" rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo ">> Starting ${IMAGE} on port ${PORT}..."
"${PODMAN[@]}" run -d --name "$NAME" -p "127.0.0.1:${PORT}:3000" \
  -e DB_TYPE=sqlite -e DB_FILEPATH=/wiki/data/db.sqlite \
  "$IMAGE" >/dev/null

JWT="$(node "$REPO_DIR/dev/screenshots/seed-demo.js" "$BASE" "$ADMIN_EMAIL" "$ADMIN_PASS" | tail -1)"

echo ">> Taking screenshots..."
rm -rf "$SHOTS_DIR"
# -> Editor terminals (e.g. VS Code) export ELECTRON_RUN_AS_NODE, which keeps Cypress' Electron from starting
(cd "$REPO_DIR" && env -u ELECTRON_RUN_AS_NODE npx cypress run \
  --spec dev/cypress/integration/admin-settings.spec.js,dev/cypress/integration/screenshots.spec.js \
  --config "baseUrl=${BASE},video=false,viewportWidth=1600,viewportHeight=900" \
  --env "jwt=${JWT}")

mkdir -p "$OUT_DIR"
for file in "$SHOTS_DIR"/*.png; do
  name="$(basename "$file")"
  if [ "$name" = "login.png" ]; then
    # -> Store the photographic login background efficiently.
    python3 -c 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], quality=88, optimize=True)' \
      "$file" "$OUT_DIR/login.jpg"
  else
    cp "$file" "$OUT_DIR/$name"
  fi
done
echo ">> Screenshots written to docs/screenshots/"
