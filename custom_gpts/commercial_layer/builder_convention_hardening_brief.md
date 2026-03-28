# builder_convention_hardening_brief.md

## Název
Builder Convention Hardening — Commercial Layer

## Kontext
Pilot baseline je formálně uzavřená.

Na `main` jsou nyní:
- pilot evidence chain `PILOT-001` až `PILOT-010`
- `PILOT_TEMPLATE.yaml`
- `REPO_PILOT_OPS_MASTER.full.md`
- `REPO_PILOT_OPS_MASTER.builder.md`
- post-merge verification / summary docs

To znamená, že další krok už není pilot merge práce, ale stabilizace deployment convention před prvním skutečným operator runem.

---

## Cíl
Zpevnit builder convention pro custom GPT vrstvu tak, aby další práce byla:
- auditovatelná
- malodiffová
- opakovatelná
- bez scope mixu
- bez repo-wide prompt rewritů

---

## Scope
Tento hardening brief se týká pouze:

1. canonical source convention
2. builder deployment convention
3. naming convention
4. review / release discipline
5. separation of artifact types

---

## Explicitně in-scope

### 1) Canonical source convention
Potvrdit:
- `*.full.md` = canonical source-of-truth
- builder deployment nesmí být nová canonical vrstva
- změna role se nejdřív děje v `full.md`, ne v summary docs a ne v evidence YAML

### 2) Builder deployment convention
Potvrdit:
- `builder_compact/*.builder.md` = deployment form
- compact verze má zachovat hard rules
- compact verze nesmí měnit roli, jen ji zkracovat pro builder použití
- compact verze musí být review-safe vůči `full.md`

### 3) Naming convention
Potvrdit naming pro:
- pilot evidence files
- prompt source files
- builder compact files
- post-merge / summary docs
- operator-run artifacts

### 4) Review / release discipline
Potvrdit:
- evidence-only PR
- prompt-only PR
- summary-only PR
- operator-run artifacts odděleně
- žádné mix PR přes více pracovních vrstev bez nutnosti

### 5) Artifact separation
Jasně oddělit:
- evidence
- prompt sources
- builder compact deployment files
- summary / verification docs
- operator-run docs

---

## Explicitně out-of-scope
Tento hardening brief teď neřeší:
- repo-wide prompt rewrite
- redesign všech GPT promptů
- dashboard layer
- Notion layer
- backend
- workflows
- schemas
- tests
- gates
- release infra
- rozšiřování commercial layer o nové role

---

## Canonical conventions

### A. Prompt source truth
- `custom_gpts/commercial_layer/prompt_sources/*.full.md`
- Toto je jediný canonical source pro roli.

### B. Builder deployment form
- `custom_gpts/commercial_layer/builder_compact/*.builder.md`
- Toto je builder-safe deployment forma canonical promptu.

### C. Pilot evidence
- `operations/evidence/custom-gpt-pilots/PILOT-XXX-role-name.yaml`
- Toto je audit evidence, ne prompt source.

### D. Summary / verification
- `operations/evidence/post-merge-verification.md`
- `operations/evidence/custom-gpt-pilots/pilot-artifacts-bundle.md`
- Toto jsou summary docs, ne canonical truth source pro prompty ani verdicty.

### E. Operator runs
- doporučená cesta:
  - `operations/evidence/operator-runs/`
- toto je operating evidence vrstva, ne pilot evidence vrstva

---

## Naming convention

### Pilot evidence
- `PILOT-001-positioning-police.yaml`
- `PILOT-002-structural-engine.yaml`
- …
- `PILOT-010-system-os-master.yaml`

Pattern:
- `PILOT-XXX-role-name.yaml`

### Prompt source
Pattern:
- `ROLE_NAME.full.md`

### Builder compact
Pattern:
- `ROLE_NAME.builder.md`

### Summary docs
Pattern:
- krátké, účelové, explicitní jméno
- např.:
  - `post-merge-verification.md`
  - `pilot-artifacts-bundle.md`

### Operator runs
Doporučený pattern:
- `OPRUN-XXX_operator_run_starter_brief.md`
- `OPRUN-XXX_operator_run_trace.md`
- `OPRUN-XXX_operator_run_review.md`
- `OPRUN-XXX_operator_run_decision.md`

---

## Review rules

### Rule 1
Evidence PR nesmí míchat:
- prompt source files
- builder compact files
- operator-run files
- backend/runtime changes

### Rule 2
Prompt-source PR nesmí míchat:
- pilot evidence YAML
- summary verification docs
- operator-run docs

### Rule 3
Summary PR nesmí předstírat canonical truth
- summary doc je jen summary doc
- nerozhoduje proti skutečnému file inventory

### Rule 4
Operator-run docs nesmí být míchané do pilot merge PR
- operator run je až operating phase

### Rule 5
Actual files > preview output
- source of truth je skutečný soubor
- ne chybně vykreslený preview blok

---

## Release / merge discipline

### Merge order rule
1. evidence
2. prompt artifacts
3. summary / verification
4. hardening
5. first real operator run

### Small-diff rule
Preferovat:
- 1 scope
- 1 PR
- 1 pracovní vrstva

### No chaos rule
Nedělat:
- evidence + prompt rewrite + dashboard + ops v jednom kroku

---

## Quality bar for future changes

Každá další změna má splnit:
- jasný scope
- správnou artifact class
- správnou cílovou cestu
- žádné scope mixing
- explicitní next logical step
- audit-friendly diff

---

## Immediate actions
1. Potvrdit tyto convention rules jako pracovní baseline
2. Nepouštět další repo-wide změny
3. Připravit první skutečný operator run
4. Použít už připravený `OPRUN-001` flow
5. Zapsat trace / review / decision
6. Až po tom řešit dashboard

---

## Success condition
Hardening je dostatečný, pokud:
- další práce už nevytváří mix PR
- je jasné, co je canonical source
- je jasné, co je deployment form
- je jasné, co je evidence vs summary vs operator-run artifact
- první real operator run může začít bez další governance mlhy

---

## Final recommended next step
Spustit:
- `SYSTEM_OS_MASTER`
- potom `POSITIONING_POLICE`

a provést `OPRUN-001` jako první skutečný end-to-end operator run.
