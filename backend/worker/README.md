# gpts-decision-stack Worker

Backend Cloudflare Workers implementace pro systém gpts-decision-stack.
Zpracovává akce GPT agentů prostřednictvím autentizovaného HTTPS action endpointu.
Model není systémem záznamu — veškerý persistentní stav, veto enforcement,
schválení a release autorita žijí výhradně v tomto backend workeru.

## Architektura

```
actions/openapi.yaml          ← API kontrakt
backend/worker/src/
  index.ts                    ← Worker entry point + auth middleware
  router.ts                   ← Request routing + helper utilities
  types/index.ts              ← Sdílené TypeScript typy
  services/
    state.ts                  ← Session CRUD (D1)
    artifact.ts               ← Artifact submit/read (D1 + R2)
    decisionlog.ts            ← Decision log append/read (D1)
    veto.ts                   ← Veto activate/status/release (D1)
    approval.ts               ← Approval create/read (D1)
    policy.ts                 ← Policy/config lookup (KV)
  handlers/
    health.ts                 ← GET /health
    session.ts                ← POST /session, GET /session/{id}, POST /session/{id}/reentry
    artifact.ts               ← POST /session/{id}/artifact
    decisionlog.ts            ← GET /session/{id}/decision-log
    veto.ts                   ← GET/POST /veto/{id}/status|activate|release
    approval.ts               ← GET/POST /approval/{id}/submit
migrations/
  0001_init.sql               ← D1: initial schema
  0002_add_requestor_columns.sql ← D1: requestor columns
  0003_add_founder_write_loop.sql ← D1: founder artifact + model-output tables
  0004_delivery_integrity.sql ← D1: delivery integrity events
  0006_artifact_lineage.sql   ← D1: artifact lineage (PR-2)
  0007_handoff_events.sql     ← D1: handoff events (PR-3)
  postgres/
    0005_delivery_integrity_pg.sql ← PG-only; never applied by wrangler d1
```

## Cloudflare bindings

| Binding          | Typ    | Účel                                           |
|------------------|--------|------------------------------------------------|
| `DECISIONS_DB`   | D1     | Session stav, artifacts index, decision log, veto, approvals |
| `ARTIFACTS_BUCKET` | R2   | Immutable artifact payloads (JSON)             |
| `POLICY_STORE`   | KV     | Policy/config lookups                          |
| `API_KEY_SECRET` | Secret | Auth validace X-API-Key hlavičky               |

## Inicializace prostředí

### 1. Vytvoření D1 databáze

```bash
wrangler d1 create gpts-decision-stack-db
# Pro dev:
wrangler d1 create gpts-decision-stack-db-dev
```

Zkopírujte `database_id` do `wrangler.toml`.

### 2. Aplikace D1 migrací

```bash
# Dev:
wrangler d1 migrations apply gpts-decision-stack-db-dev --env dev --remote
# Prod:
wrangler d1 migrations apply gpts-decision-stack-db --env prod --remote
```

Wrangler scans `migrations/` (root only, non-recursive) for numbered `*.sql` files.
Files under `migrations/postgres/` are **never** picked up by `wrangler d1 migrations apply`.

### Dependency reproducibility

`backend/worker/package-lock.json` is the **reproducibility contract** for this repository. It is the only authoritative npm lockfile; the repo root carries no npm scope. CI exclusively uses `npm ci` from `backend/worker`. Editing `package.json` without regenerating the lockfile, or committing a stale lockfile, is a contract violation — the `validate` job will fail hard on any lockfile drift.

### D1 / PostgreSQL migration boundary

| Location | Applied by | Allowed dialect |
|---|---|---|
| `migrations/*.sql` | `wrangler d1 migrations apply` | D1/SQLite only |
| `migrations/postgres/*.sql` | external Postgres tooling | PostgreSQL |

**Rules:**
- D1 migrations must not contain: `TIMESTAMPTZ`, `DEFAULT NOW(`, `::` (cast), `SERIAL`, `CREATE INDEX … USING`, `ALTER TABLE … TYPE`, `USING gin`, `USING btree`, `gen_random_uuid`, `jsonb`, `RETURNING`.
- PostgreSQL-only files must live under `migrations/postgres/` and follow the `*_pg.sql` naming convention.
- CI enforces this boundary on every push (`validate` job in both `deploy-worker.yml` and `deploy-workers.yaml`). Any `*_pg.sql` in `migrations/` root, or any PG dialect marker in a `migrations/*.sql` file, causes the workflow to fail hard with `::error::` output.

### 3. Vytvoření R2 bucketu

```bash
wrangler r2 bucket create gpts-decision-stack-artifacts
wrangler r2 bucket create gpts-decision-stack-artifacts-dev
```

### 4. Vytvoření KV namespace

```bash
wrangler kv namespace create POLICY_STORE
wrangler kv namespace create POLICY_STORE --env dev
```

Zkopírujte `id` do `wrangler.toml`.

### 5. Nastavení API klíče (secret)

```bash
# Nikdy necommitujte skutečný API klíč!
wrangler secret put API_KEY_SECRET
wrangler secret put API_KEY_SECRET --env prod
```

## Lokální vývoj

```bash
npm install
npm run dev
```

Worker poběží na `http://localhost:8787`.

## Deployment

### Deploy workflow path

Two workflows are active. Both run on push to `main` when `backend/worker/**` changes; `deploy-workers.yaml` additionally accepts `workflow_dispatch` for manual prod deploys.

| Workflow | Trigger | Jobs | Notes |
|---|---|---|---|
| `.github/workflows/deploy-worker.yml` | push to `main` | `validate → deploy-dev` | Critical path. Dev auto-deploys on every merge. |
| `.github/workflows/deploy-workers.yaml` | push to `main` OR `workflow_dispatch` | `validate → deploy-dev → deploy-prod` | Prod deploys only via `workflow_dispatch` with `environment: prod`. |

**Assumptions:**
- PRs do **not** trigger any deploy job. Deploy runs only after merge to `main`.
- Evidence PRs (documentation, checklist updates, pilot records, post-merge verification docs) are **not** deploy events. Their merge may trigger the workflows above if `backend/worker/**` is in scope, but if no worker files changed, no deploy runs.
- A successful CI run on a PR is not evidence of deployment. Deployment truth is the `deploy-dev` or `deploy-prod` job completing in the workflow run after the merge commit lands on `main`.

```bash
# Manual prod deploy (requires workflow_dispatch on deploy-workers.yaml):
npm run deploy:prod
```

## Auth

Každý request (kromě `/health`) musí obsahovat hlavičku:

```
X-API-Key: <api-key>
```

Klíč je validován oproti `API_KEY_SECRET` Worker Secret.
Konstantní porovnání zabraňuje timing útokům.

## Endpointy

Viz `actions/openapi.yaml` pro kompletní API kontrakt.

| Endpoint                              | Operace            |
|---------------------------------------|--------------------|
| GET /health                           | getHealth          |
| POST /session                         | createSession      |
| GET /session/{session_id}             | getSessionState    |
| GET /session/{session_id}/delivery    | getDeliverySummary |
| POST /session/{session_id}/artifact   | submitArtifact     |
| POST /session/{session_id}/reentry    | triggerReentry     |
| GET /session/{session_id}/decision-log| getDecisionLog     |
| GET /veto/{session_id}/status         | getVetoStatus      |
| POST /veto/{session_id}/activate      | activateVeto       |
| POST /veto/{session_id}/release       | releaseVeto        |
| GET /approval/{session_id}            | getApprovals       |
| POST /approval/{session_id}/submit    | submitApproval     |
