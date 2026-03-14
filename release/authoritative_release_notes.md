# Autoritativní poznámky k vydání — gpts-decision-stack

## Verze

`gpts-decision-stack` — vývojový skeleton (neproduktivní verze)

---

## Stav vydání

**Klasifikace:** REPO-READY SKELETON

Tato verze není určena k produkčnímu nasazení. Neobsahuje backend binding
a neprošla plným deployment gate procesem.

---

## Co je obsaženo v tomto vydání

- Kompletní sada promptů řídicí roviny (CP-Governor, CP-ContractAuditor, CP-TransitionJudge, CP-ReleaseArbiter)
- Kompletní sada promptů adaptivních enginů (AE-Intake, AE-Framing, AE-Primitive, AE-Architecture, AE-Claims, AE-RiskGov, AE-Commercial, AE-ReviewRouter)
- Všechna schémata artefaktů (10 kanonických artefaktů)
- Acceptance fixtures pro 4 domény (founder-led, enterprise, regulated, enablement)
- Acceptance testy (AC-001 až AC-012)
- Governance mapy (ownership, approval, veto)
- Kanonické repo-control soubory (MASTER_SPEC.md, repo.manifest.yaml)
- QA gate report (status FAIL — viz blokátory)

---

## Blokátory pro produkci

- Knowledge soubory fyzicky chybí (16 souborů)
- Operační checklisty fyzicky chybí (4 soubory)
- Promotion gate fyzicky chybí
- Backend binding (GPT konfigurace, API binding, deployment manifest) chybí

---

## Governance poznámka

Tato autoritativní poznámka nesmí být zaměňována s `derived_packaging_notes.md`.
Pouze tento dokument nese autoritativní release verdict.
Jakékoliv označení jako DEPLOY-READY STACK bez splnění všech podmínek
Definition of Done je nepřípustné.
