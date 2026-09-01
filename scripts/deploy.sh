#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  printf 'Deployment failed: %s\n' "$1" >&2
  exit 1
}

if [ "$#" -ne 1 ]; then
  printf 'Usage: %s GIT_COMMIT_SHA\n' "$0" >&2
  exit 2
fi

image_tag=$1
[[ "$image_tag" =~ ^[0-9a-f]{40}$ ]] || fail 'image tag must be a full lowercase 40-character Git commit SHA'

repository_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
production_env=${PRODUCTION_ENV_FILE:-"$repository_dir/production.env"}
registry_env=${GHCR_CREDENTIALS_FILE:-/etc/cukurpro/ghcr.env}
backup_dir=${BACKUP_DIR:-/var/lib/cukurpro/backups}
state_dir=${STATE_DIR:-/var/lib/cukurpro}
health_timeout=${HEALTH_TIMEOUT_SECONDS:-180}

for secret_file in "$production_env" "$registry_env"; do
  [ -f "$secret_file" ] || fail "required file does not exist: $secret_file"
  [ "$(stat -c '%a' "$secret_file")" = '600' ] || fail "$secret_file must have mode 0600"
done

set -a
# These files are operator-managed shell-compatible KEY=VALUE files with mode 0600.
# shellcheck disable=SC1090
source "$production_env"
# shellcheck disable=SC1090
source "$registry_env"
set +a

: "${APP_DOMAIN:?APP_DOMAIN is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${ALLOWED_ORIGINS:?ALLOWED_ORIGINS is required}"
: "${PUBLIC_API_BASE_URL:?PUBLIC_API_BASE_URL is required}"
: "${GHCR_USERNAME:?GHCR_USERNAME is required}"
: "${GHCR_TOKEN:?GHCR_TOKEN is required}"

[ "$ALLOWED_ORIGINS" = "https://$APP_DOMAIN" ] || fail 'ALLOWED_ORIGINS must equal https://APP_DOMAIN'
[ "$PUBLIC_API_BASE_URL" = "https://$APP_DOMAIN" ] || fail 'PUBLIC_API_BASE_URL must equal https://APP_DOMAIN'
[[ "$health_timeout" =~ ^[1-9][0-9]*$ ]] || fail 'HEALTH_TIMEOUT_SECONDS must be a positive integer'

export IMAGE_TAG="$image_tag"
export IMAGE_REGISTRY=${IMAGE_REGISTRY:-ghcr.io/nicastra/barberkita}

mkdir -p -- "$backup_dir" "$state_dir"
chmod 700 -- "$backup_dir" "$state_dir"

docker_config=$(mktemp -d "${TMPDIR:-/tmp}/cukurpro-docker-config.XXXXXX")
partial_backup=
cleanup() {
  if [ -n "$partial_backup" ] && [ -f "$partial_backup" ]; then
    rm -f -- "$partial_backup"
  fi
  case "$docker_config" in
    "${TMPDIR:-/tmp}"/cukurpro-docker-config.*) rm -rf -- "$docker_config" ;;
  esac
}
trap cleanup EXIT
export DOCKER_CONFIG="$docker_config"

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USERNAME" --password-stdin >/dev/null
unset GHCR_TOKEN

compose=(
  docker compose
  --project-name cukurpro
  --env-file "$production_env"
  --file "$repository_dir/compose.production.yaml"
)

printf 'Starting PostgreSQL and creating the required pre-deployment backup...\n'
if ! docker image inspect postgres:17-alpine >/dev/null 2>&1; then
  "${compose[@]}" pull postgres
fi
"${compose[@]}" up --detach --wait postgres

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_path="$backup_dir/cukurpro-${timestamp}-pre-${image_tag}.dump"
partial_backup="${backup_path}.partial"
[ ! -e "$backup_path" ] && [ ! -e "$partial_backup" ] || fail "backup path already exists: $backup_path"
umask 077
if ! "${compose[@]}" exec -T postgres pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --no-owner \
  --no-privileges >"$partial_backup"; then
  fail 'the pre-deployment PostgreSQL backup failed; application images were not changed'
fi
[ -s "$partial_backup" ] || fail 'the pre-deployment PostgreSQL backup is empty'
if ! "${compose[@]}" exec -T postgres pg_restore --list <"$partial_backup" >/dev/null; then
  fail 'the pre-deployment PostgreSQL backup could not be read by pg_restore'
fi
mv -- "$partial_backup" "$backup_path"
partial_backup=
(
  cd -- "$backup_dir"
  sha256sum "$(basename -- "$backup_path")" >"$(basename -- "$backup_path").sha256"
)
chmod 600 -- "$backup_path" "${backup_path}.sha256"
printf 'Backup: %s\n' "$backup_path"

printf 'Pulling immutable application images for %s...\n' "$image_tag"
"${compose[@]}" pull server-migrate server client caddy

printf 'Running migrations before replacing application containers...\n'
"${compose[@]}" up \
  --no-deps \
  --force-recreate \
  --abort-on-container-exit \
  --exit-code-from server-migrate \
  server-migrate

printf 'Starting the API, client, and HTTPS edge...\n'
"${compose[@]}" up --detach --wait --remove-orphans server client caddy

wait_for_url() {
  local label=$1
  local url=$2
  local deadline=$((SECONDS + health_timeout))

  until curl --fail --silent --show-error --max-time 10 "$url" >/dev/null 2>&1; do
    if ((SECONDS >= deadline)); then
      fail "$label did not become healthy within ${health_timeout}s: $url"
    fi
    sleep 2
  done
  printf '%s health: OK (%s)\n' "$label" "$url"
}

postgres_container=$("${compose[@]}" ps --quiet postgres)
[ -n "$postgres_container" ] || fail 'PostgreSQL container is not running'
[ "$(docker inspect --format '{{.State.Health.Status}}' "$postgres_container")" = 'healthy' ] || fail 'PostgreSQL is not healthy'
printf 'PostgreSQL health: OK\n'
wait_for_url 'Client' "https://$APP_DOMAIN/health"
wait_for_url 'API' "https://$APP_DOMAIN/api/health"

current_tag_file="$state_dir/current-image-tag"
previous_tag_file="$state_dir/previous-image-tag"
if [ -f "$current_tag_file" ]; then
  previous_tag=$(tr -d '\n' <"$current_tag_file")
  if [[ "$previous_tag" =~ ^[0-9a-f]{40}$ ]] && [ "$previous_tag" != "$image_tag" ]; then
    printf '%s\n' "$previous_tag" >"$previous_tag_file"
    chmod 600 -- "$previous_tag_file"
  fi
fi
printf '%s\n' "$image_tag" >"$current_tag_file"
chmod 600 -- "$current_tag_file"

printf 'Deployed image tag: %s\n' "$image_tag"
for image_name in server server-migrate client; do
  image_reference="$IMAGE_REGISTRY/$image_name:$image_tag"
  image_digest=$(docker image inspect --format '{{join .RepoDigests ", "}}' "$image_reference")
  printf '%s digest: %s\n' "$image_name" "$image_digest"
done
if [ -f "$previous_tag_file" ]; then
  printf 'Application rollback tag: %s\n' "$(tr -d '\n' <"$previous_tag_file")"
else
  printf 'Application rollback tag: none (first successful deployment)\n'
fi
