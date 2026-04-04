---
description: "Use when: working on backend worker TypeScript handlers/services/routes, Cloudflare bindings, D1/R2/KV integration, auth, and API contract changes in gpts-decision-stack."
name: "Backend Worker Rules"
applyTo: "backend/worker/src/**/*.ts"
---
# Backend Worker Rules

## Scope
- Tato instrukce platí pro backend implementaci v `backend/worker/src/`.
- Runtime source of truth je backend Worker, ne model ani UI.

## Before You Change
- Nejdřív načti: `MASTER_SPEC.md`, `repo.manifest.yaml`, `operations/backend_binding.yaml`.
- Pokud měníš kontrakt endpointu, zkontroluj konzistenci s `actions/openapi.yaml`.

## Change Discipline
- Dělej malé, reviewovatelné změny.
- Nemíchej bez důvodu v jednom kroku změny promptů, artifact schémat a backend logiky.
- Preferuj fail-closed chování: při nejasnosti nebo chybějícím povinném vstupu nepropouštěj tok jako `proceed`.
- Chybějící povinné vstupy explicitně označuj jako `UNKNOWN`; neodhaduj je.

## Data and Governance Invariants
- Aktivní veto je absolutní blokace release až do explicitního `veto_release`.
- Re-entry musí být explicitní, tichý re-entry není povolen.
- Zachovej kanonické názvy artifactů, decision status enumy a pipeline stavy dle `MASTER_SPEC.md`.

## Verification
- Po změnách v backendu spusť:
  - `cd backend/worker && npm run typecheck`
  - `cd backend/worker && npm run test`
- `npm run dev` používej pro lokální runtime validaci; evidence skripty spouštěj jen když je potřeba live ověření.

## References
- System source of truth: `MASTER_SPEC.md`
- Canonical map: `repo.manifest.yaml`
- Backend authority/binding: `operations/backend_binding.yaml`
- Worker setup and bindings: `backend/worker/README.md`
- Promotion gate: `operations/gates/promotion-gate.yaml`
