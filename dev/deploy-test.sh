#!/usr/bin/env bash
#
# Build the Wiki.js NG container image locally and run it as a throwaway test
# instance. Production deployments are done via CI/CD images from the registry —
# this script is for verifying changes locally before committing.
#
# Usage:
#   dev/deploy-test.sh build      Build the image as wikijs-ng:local-test
#   dev/deploy-test.sh test       Run a test container on :3006 (SQLite, own volume)
#   dev/deploy-test.sh cleanup    Stop and remove the test container and its volume
#
# Configuration (environment variables, all optional):
#   WIKI_IMAGE      Image name/tag to build and run  (default: localhost/wikijs-ng:local-test)
#   WIKI_TEST_PORT  Host port for the test instance  (default: 3006)
#   WIKI_PODMAN     Container tool                   (default: podman; docker works too)
#   WIKI_BUILD_MEM  Memory cap for the build         (default: 4G; empty = uncapped)
#   DB_TYPE/DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME
#                   Use an external database instead of the default SQLite volume.
#                   NEVER point a test instance at a production database.
#
# Snapshot mode (optional): test against a fresh COPY of a production database.
# When WIKI_SNAPSHOT_DB is set, `test` dumps that MariaDB/MySQL database into
# WIKI_SNAPSHOT_TEST_DB, disables the git storage target in the copy (so the
# test instance can never sync/push to the real repository) and starts the
# container against the copy. The production database is only ever read.
#
#   WIKI_SNAPSHOT_DB           Production database name to copy
#   WIKI_SNAPSHOT_TEST_DB      Name of the copy               (default: wikijs_test)
#   WIKI_DB_ADMIN_PW_FILE      File containing the DB root password
#   WIKI_DB_ADMIN_USER         Admin user for dump/create     (default: root)
#   WIKI_MYSQL_CLI             mariadb or mysql               (default: mariadb)
#   DB_HOST/DB_PORT/DB_USER/DB_PASS  App credentials for the test container
#
# Host-specific values belong in dev/deploy-test.local.env (gitignored, sourced
# automatically) — keep this script and the repository generic.
set -euo pipefail

if [ -f "$(dirname "$0")/deploy-test.local.env" ]; then
  # shellcheck source=/dev/null
  . "$(dirname "$0")/deploy-test.local.env"
fi

IMAGE="${WIKI_IMAGE:-localhost/wikijs-ng:local-test}"
TEST_PORT="${WIKI_TEST_PORT:-3006}"
PODMAN="${WIKI_PODMAN:-podman}"
BUILD_MEM="${WIKI_BUILD_MEM:-4G}"
TEST_CONTAINER="wikijs-ng-test"
TEST_VOLUME="wikijs-ng-test-data"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cmd_build() {
  echo ">> Building $IMAGE..."
  local runner=()
  if [ -n "$BUILD_MEM" ] && command -v systemd-run >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
    runner=(systemd-run --scope -p "MemoryMax=$BUILD_MEM" -p CPUQuota=300%)
  fi
  # --format docker: OCI images silently drop the HEALTHCHECK instruction
  "${runner[@]}" "$PODMAN" build --format docker \
    -f "$REPO_DIR/dev/build/Dockerfile" \
    --build-arg VERSION="v$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$REPO_DIR/package.json" | head -1)" \
    --build-arg REVISION="$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo local)" \
    --build-arg CREATED="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -t "$IMAGE" "$REPO_DIR"
  echo ">> Build complete: $IMAGE"
}

db_admin() {
  local cli="${WIKI_MYSQL_CLI:-mariadb}"
  local user="${WIKI_DB_ADMIN_USER:-root}"
  if [ -n "${WIKI_DB_ADMIN_PW_FILE:-}" ]; then
    sudo sh -c "MYSQL_PWD=\$(cat '$WIKI_DB_ADMIN_PW_FILE') exec ${cli}${1:+-$1} -u '$user' \"\$@\"" _ "${@:2}"
  else
    sudo "${cli}${1:+-$1}" -u "$user" "${@:2}"
  fi
}

refresh_snapshot_db() {
  local src="$WIKI_SNAPSHOT_DB" dst="${WIKI_SNAPSHOT_TEST_DB:-wikijs_test}" dump
  echo ">> Snapshot mode: copying $src -> $dst (production is only read)"
  dump="$(mktemp /tmp/wikijs-snapshot-XXXX.sql)"
  db_admin dump --single-transaction "$src" > "$dump"
  db_admin "" -e "DROP DATABASE IF EXISTS \`$dst\`; CREATE DATABASE \`$dst\`;"
  # Grant for every host entry the app user actually has (a '%' entry may not exist)
  db_admin "" -N -B -e "SELECT Host FROM mysql.user WHERE User='${DB_USER:?DB_USER must be set in snapshot mode}';" | while read -r dbhost; do
    echo "   granting on $dst to '${DB_USER}'@'$dbhost'"
    db_admin "" -e "GRANT ALL ON \`$dst\`.* TO '${DB_USER}'@'$dbhost';"
  done
  db_admin "" "$dst" < "$dump"
  rm -f "$dump"

  # Safety: the copy contains the PRODUCTION git storage config (remote URL +
  # SSH key). Disable the target so the test instance can never sync/push to
  # the real repository.
  echo ">> Disabling git storage target in $dst..."
  db_admin "" "$dst" -e "UPDATE storage SET isEnabled = 0 WHERE \`key\` = 'git';"
}

cmd_test() {
  "$PODMAN" rm -f "$TEST_CONTAINER" >/dev/null 2>&1 || true

  local db_args=()
  if [ -n "${WIKI_SNAPSHOT_DB:-}" ]; then
    refresh_snapshot_db
    db_args=(
      -e "DB_TYPE=${DB_TYPE:-mariadb}" -e "DB_HOST=${DB_HOST:?}" -e "DB_PORT=${DB_PORT:-3306}"
      -e "DB_USER=${DB_USER:?}" -e "DB_PASS=${DB_PASS:?}" -e "DB_NAME=${WIKI_SNAPSHOT_TEST_DB:-wikijs_test}"
    )
  elif [ -n "${DB_TYPE:-}" ]; then
    echo ">> Using external database: ${DB_TYPE} on ${DB_HOST:-?}"
    db_args=(
      -e "DB_TYPE=${DB_TYPE}" -e "DB_HOST=${DB_HOST:-}" -e "DB_PORT=${DB_PORT:-}"
      -e "DB_USER=${DB_USER:-}" -e "DB_PASS=${DB_PASS:-}" -e "DB_NAME=${DB_NAME:-}"
    )
  else
    echo ">> Using SQLite in named volume $TEST_VOLUME"
    db_args=(
      -e DB_TYPE=sqlite -e DB_FILEPATH=/wiki/data/db.sqlite
      -v "$TEST_VOLUME:/wiki/data"
    )
  fi

  "$PODMAN" run -d --name "$TEST_CONTAINER" \
    -p "${TEST_PORT}:3000" \
    "${db_args[@]}" \
    "$IMAGE"
  echo ">> Test instance starting on http://localhost:${TEST_PORT}"
  echo ">> Logs:    $PODMAN logs -f $TEST_CONTAINER"
  echo ">> Cleanup: dev/deploy-test.sh cleanup"
}

cmd_cleanup() {
  "$PODMAN" rm -f "$TEST_CONTAINER" >/dev/null 2>&1 || true
  "$PODMAN" volume rm "$TEST_VOLUME" >/dev/null 2>&1 || true
  if [ -n "${WIKI_SNAPSHOT_DB:-}" ]; then
    db_admin "" -e "DROP DATABASE IF EXISTS \`${WIKI_SNAPSHOT_TEST_DB:-wikijs_test}\`;" || true
    echo ">> Snapshot test database removed."
  fi
  echo ">> Test container and volume removed."
}

case "${1:-}" in
  build)   cmd_build ;;
  test)    cmd_test ;;
  cleanup) cmd_cleanup ;;
  *)
    grep '^#' "$0" | sed -n '2,20p' | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
