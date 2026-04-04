# Project Guidelines

## Architecture
- Tento repozitář je řízený artifact-first decision stack. Architekturu ne-redesignuj bez explicitního zadání.
- Control plane a adaptive engines jsou oddělené; control plane je INVARIANT.
- Model není system of record. Veškerá runtime pravda (stav, veto, approvals, release autorita) je v backendu Worker.
- Před větší změnou nejdřív načti:
  - `MASTER_SPEC.md`
  - `repo.manifest.yaml`
  - `operations/backend_binding.yaml`

## Build and Test
- Root neobsahuje standardní npm scripts; primární vývoj běží v `backend/worker/`.
- Pro backend používej:
  - `cd backend/worker && npm run typecheck`
  - `cd backend/worker && npm run test`
  - `cd backend/worker && npm run dev`
- Evidence skripty (live dev worker) používej jen pokud je to potřeba pro runtime ověření:
  - `DEV_WORKER_URL=... DEV_API_KEY=... node scripts/evidence/run-dev-runtime-evidence.mjs`
  - `DEV_WORKER_URL=... DEV_API_KEY=... node scripts/evidence/run-dev-acceptance-evidence.mjs`

## Conventions
- UNKNOWN disciplína je povinná: chybějící povinné vstupy neodhadovat, explicitně značit jako `UNKNOWN`.
- Fail-closed rozhodování: pokud nejsou splněná kritéria, nikdy nevracej falešné `proceed`.
- Re-entry musí být explicitní; tichý re-entry není povolen.
- Aktivní veto je absolutní blokace release do explicitního `veto_release`.
- Zachovávej artefaktové názvy, decision status enumy a pipeline stavy dle kanonických definic.

## Working Rules for Agents
- Preferuj malé, reviewovatelné změny.
- Neměň současně prompty, schémata a backend logiku bez jasné vazby a vysvětlení.
- Při změně kontraktu nebo artifact shape aktualizuj související schéma v `schemas/artifacts/` a ověř konzistenci vůči `repo.manifest.yaml`.
- Pokud je potřeba detailní governance kontext, odkazuj na dokumenty místo duplikace pravidel.

## Key References (Link, Don’t Embed)
- System source of truth: `MASTER_SPEC.md`
- Canonical component/artifact map: `repo.manifest.yaml`
- Backend authority and binding: `operations/backend_binding.yaml`
- Definition of done and phase status: `operations/Definition_of_Done.md`
- Worker setup and bindings: `backend/worker/README.md`
- Instrumentation docs: `docs/instrumentation/`
- Operations runbooks/checklists: `operations/checklists/`
- Promotion gate: `operations/gates/promotion-gate.yaml`
