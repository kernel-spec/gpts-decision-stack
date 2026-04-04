#!/usr/bin/env bash
set -euo pipefail

# Deploy both Cloudflare Worker environments (dev + prod) using Wrangler.
#
# Required environment variables:
#   CLOUDFLARE_API_TOKEN
#   CLOUDFLARE_ACCOUNT_ID
#   DEV_API_KEY_SECRET_VALUE
#   PROD_API_KEY_SECRET_VALUE
#
# Optional:
#   SKIP_NPM_CI=1  (skip npm ci when dependencies are already installed)

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

run_step() {
  local label="$1"
  shift
  echo "== ${label} =="
  "$@"
}

put_secret() {
  local env_name="$1"
  local value="$2"
  echo "== ${env_name^^}: set API_KEY_SECRET =="
  printf '%s' "$value" | npx wrangler secret put API_KEY_SECRET --env "$env_name"
}

require_var "CLOUDFLARE_API_TOKEN"
require_var "CLOUDFLARE_ACCOUNT_ID"
require_var "DEV_API_KEY_SECRET_VALUE"
require_var "PROD_API_KEY_SECRET_VALUE"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ "${SKIP_NPM_CI:-0}" != "1" ]]; then
  run_step "Install deps" npm ci
fi

run_step "Wrangler auth preflight" npx wrangler whoami

run_step "DEV: D1 migrations" npx wrangler d1 migrations apply gpts-decision-stack-db-dev --env dev --remote
put_secret "dev" "$DEV_API_KEY_SECRET_VALUE"
run_step "DEV: deploy" npx wrangler deploy --env dev

run_step "PROD: D1 migrations" npx wrangler d1 migrations apply gpts-decision-stack-db --env prod --remote
put_secret "prod" "$PROD_API_KEY_SECRET_VALUE"
run_step "PROD: deploy" npx wrangler deploy --env prod

echo "Done."
