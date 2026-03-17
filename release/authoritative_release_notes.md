# Autoritativní poznámky k vydání — gpts-decision-stack

## Verze

`gpts-decision-stack` — REPO-READY SKELETON (backend IMPLEMENTATION-BACKED, dev prostředí live)

---

## Stav vydání

**Klasifikace:** REPO-READY SKELETON

Tato verze neprošla plným deployment gate procesem a není klasifikována jako
DEPLOY-READY STACK. Backend je IMPLEMENTATION-BACKED (Cloudflare Worker,
dev prostředí live), ale governed deployment readiness zůstává FAIL
(fail-closed governance) — viz `qa/final-gate-report.yaml`.

---

## Co je obsaženo v tomto vydání

- Kompletní sada promptů řídicí roviny (CP-Governor, CP-ContractAuditor, CP-TransitionJudge, CP-ReleaseArbiter)
- Kompletní sada promptů adaptivních enginů (AE-Intake, AE-Framing, AE-Primitive, AE-Architecture, AE-Claims, AE-RiskGov, AE-Commercial, AE-ReviewRouter)
- Všechna schémata artefaktů (10 kanonických artefaktů)
- Acceptance fixtures pro 4 domény (founder-led, enterprise, regulated, enablement)
- Acceptance testy (AC-001 až AC-012)
- Governance mapy (ownership, approval, veto)
- Kanonické repo-control soubory (MASTER_SPEC.md, repo.manifest.yaml)
- Všechny knowledge soubory (7 core INVARIANT + 9 domain ADAPTIVE)
- Operační checklisty (local/dev/staging/prod)
- Backend binding: Cloudflare Worker TypeScript implementace (IMPLEMENTATION-BACKED)
- API binding manifest (actions/openapi.yaml, actions/openapi.openai.yaml)
- Deployment manifest (release/deployment_target.yaml)
- Dev runtime evidence (operations/evidence/audit-evidence-bundle-dev.yaml)
- QA gate report (overall_status FAIL — viz blokátory)

---

## Blokátory pro dosažení DEPLOY-READY STACK

- **PROV-002**: Acceptance testy (AC-001–AC-012) existují jako YAML definice, ale nebyly evaluovány oproti live backendu
- **PROV-001**: Dev prostředí je live; produkční Cloudflare infrastruktura a GitHub Secrets musí být nastaveny

---

## Governance poznámka

Tato autoritativní poznámka nesmí být zaměňována s `derived_packaging_notes.md`.
Pouze tento dokument nese autoritativní release verdict.
Jakékoliv označení jako DEPLOY-READY STACK bez splnění všech podmínek
Definition of Done je nepřípustné.
