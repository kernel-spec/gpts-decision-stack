# Definition of Done — gpts-decision-stack

## Účel

Tento dokument definuje podmínky, za nichž je repozitář `gpts-decision-stack`
považován za dokončený v kontextu dané fáze. DoD je hierarchické:
každá fáze staví na předchozí a přidává další požadavky.

---

## Fáze 1 — Skeleton (REPO-READY SKELETON)

Repozitář je REPO-READY SKELETON pokud fyzicky existují:

- [ ] `MASTER_SPEC.md` — kanonická specifikace systému
- [ ] `repo.manifest.yaml` — kanonický manifest repozitáře
- [ ] Všechny prompty řídicí roviny (`prompts/core/`)
- [ ] Všechny prompty adaptivních enginů (`prompts/adaptive/`)
- [ ] Všechna schémata artefaktů (`schemas/artifacts/`)
- [ ] Acceptance fixtures (`tests/fixtures/`)
- [ ] Acceptance testy (`tests/acceptance/`)
- [ ] Governance mapy (`operations/operational_*.yaml`)
- [ ] QA gate report (`qa/final-gate-report.yaml`)

**Aktuální stav:** SPLNĚNO po přidání governance maps a QA gate reportu.

---

## Fáze 2 — Operačně připravený (OPERATIONS-READY)

Repozitář je OPERATIONS-READY pokud navíc fyzicky existují:

- [ ] Knowledge soubory core (`knowledge/core/00-06`)
- [ ] Knowledge soubory domain (`knowledge/domains/default/10-18`)
- [ ] Operační checklisty (`operations/checklists/`)
- [ ] Promotion gate (`operations/gates/promotion-gate.yaml`)
- [ ] `operations/Definition_of_Done.md` — tento soubor
- [ ] `operations/Management_Summary_Checklist.md`
- [ ] `release/authoritative_release_notes.md`
- [ ] `release/derived_packaging_notes.md`

**Aktuální stav:** NESPLNĚNO — knowledge soubory a operační checklisty chybí.

---

## Fáze 3 — Připravený k nasazení (DEPLOY-READY STACK)

Repozitář je DEPLOY-READY STACK pokud navíc existují a jsou ověřeny:

- [ ] Backend binding (GPT deployment konfigurace)
- [ ] API binding manifest
- [ ] Deployment manifest pro cílová prostředí
- [ ] Všechny promotion gate podmínky jsou splněny
- [ ] QA gate report s `overall_status: PASS`
- [ ] Acceptance testy prošly evaluací (ne pouze definicí)

**Aktuální stav:** NESPLNĚNO — backend binding chybí.

---

## Governance invarianty DoD

- DoD nesmí být retroaktivně oslaben bez explicitní revize governance.
- Fáze nelze přeskočit.
- `qa/final-gate-report.yaml` musí vždy odrážet aktuální fyzický stav.
- Falešné splnění DoD je stejně závažné selhání jako falešný proceed v pipeline.
