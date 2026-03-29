#!/usr/bin/env bash
# setup-github-secrets.sh
#
# Sets required GitHub Actions secrets for the gpts-decision-stack deployment
# workflow (.github/workflows/deploy-workers.yaml).
#
# Required secrets:
#   CLOUDFLARE_API_TOKEN   — Cloudflare API token with Workers/D1/R2/KV permissions
#   CLOUDFLARE_ACCOUNT_ID  — Cloudflare account ID (see wrangler.toml for reference)
#
# Prerequisites:
#   - GitHub CLI (gh) installed
#   - CLOUDFLARE_API_TOKEN env var set in the calling shell
#   - CLOUDFLARE_ACCOUNT_ID env var set in the calling shell
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="<your-token>"
#   export CLOUDFLARE_ACCOUNT_ID="<your-account-id>"
#   bash scripts/setup-github-secrets.sh

set -euo pipefail

REPO="${REPO:-kernel-spec/gpts-decision-stack}"

# ---------- 1. Authenticate GitHub CLI ----------

echo "==> Logging out any existing GitHub CLI session..."
gh auth logout -h github.com || true

echo "==> Logging in to GitHub with required scopes (repo, workflow, read:org)..."
gh auth login -h github.com --web --scopes "repo,workflow,read:org"

echo "==> Verifying GitHub CLI auth status..."
gh auth status

# ---------- 2. Verify secrets API access ----------

echo "==> Verifying access to repository secrets API..."
gh api "repos/${REPO}/actions/secrets/public-key"

# ---------- 3. Set required secrets ----------

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "[ERROR] CLOUDFLARE_API_TOKEN is not set. Export it before running this script."
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "[ERROR] CLOUDFLARE_ACCOUNT_ID is not set. Export it before running this script."
  exit 1
fi

echo "==> Setting CLOUDFLARE_API_TOKEN secret..."
gh secret set CLOUDFLARE_API_TOKEN \
  --repo "${REPO}" \
  --body "${CLOUDFLARE_API_TOKEN}"

echo "==> Setting CLOUDFLARE_ACCOUNT_ID secret..."
gh secret set CLOUDFLARE_ACCOUNT_ID \
  --repo "${REPO}" \
  --body "${CLOUDFLARE_ACCOUNT_ID}"

echo "==> Done. Both secrets are set for ${REPO}."
