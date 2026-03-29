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
  0001_init.sql               ← D1 schema migrace
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

### 2. Aplikace D1 migrace

```bash
# Dev:
wrangler d1 execute gpts-decision-stack-db-dev --file migrations/0001_init.sql
# Prod:
wrangler d1 execute gpts-decision-stack-db --file migrations/0001_init.sql
```

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

Před prvním spuštěním se přihlaste ke Cloudflare:

```bash
npx wrangler login
npx wrangler whoami
```

Poté nainstalujte závislosti a spusťte lokální vývojový server:

```bash
npm install
npm run dev
```

Worker poběží na `http://localhost:8787`.

## Deployment

Viz `.github/workflows/deploy-workers.yaml` pro automatický deployment přes GitHub Actions.

```bash
# Ruční deployment:
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
| POST /session/{session_id}/artifact   | submitArtifact     |
| POST /session/{session_id}/reentry    | triggerReentry     |
| GET /session/{session_id}/decision-log| getDecisionLog     |
| GET /veto/{session_id}/status         | getVetoStatus      |
| POST /veto/{session_id}/activate      | activateVeto       |
| POST /veto/{session_id}/release       | releaseVeto        |
| GET /approval/{session_id}            | getApprovals       |
| POST /approval/{session_id}/submit    | submitApproval     |
