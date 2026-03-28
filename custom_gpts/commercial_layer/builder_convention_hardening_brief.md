# Builder Convention Hardening — Commercial Layer

## Účel

Tento brief uzavírá pracovní baseline pro hardening commercial-layer Builder convention.
Cíl je jednoduchý:

- auditovatelná práce
- malodiffové změny
- opakovatelný deployment postup
- žádný scope mix
- žádné repo-wide prompt rewrites bez explicitního zadání

Tento brief je governance vrstva. Není to prompt source, deployment artifact ani evidence file.

---

## Scope

Tento hardening brief řeší pouze:

1. canonical source convention
2. builder deployment convention
3. naming convention
4. review / release discipline
5. separation of artifact types

Explicitně mimo scope:

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

## 1) Canonical source convention

### Working baseline

- `custom_gpts/commercial_layer/prompt_sources/*.full.md` = jediný canonical source-of-truth pro roli
- změna role se nejdřív dělá ve `*.full.md`
- summary docs ani evidence YAML nesmí fungovat jako canonical source promptu
- Builder deployment nesmí být nová canonical vrstva

### Meaning

- `*.full.md` určuje roli, scope, hard rules, output contract a stop rules
- `*.builder.md` smí canonical prompt pouze zkrátit pro Builder použití
- evidence YAML zapisuje audit, ne prompt authoring truth
- summary / verification docs shrnují stav, ale nepřepisují file inventory

---

## 2) Builder deployment convention

### Working baseline

- `custom_gpts/commercial_layer/builder_compact/*.builder.md` = deployment form
- compact verze musí zachovat hard rules
- compact verze nesmí měnit roli, pouze ji komprimovat
- compact verze musí být review-safe vůči odpovídajícímu `*.full.md`

### Required deployment discipline

Každá compact verze musí zachovat alespoň:

- role mission
- stop rules
- hard rules
- output structure
- schema / key discipline
- boundary discipline

### Source pairing rule

Každý builder compact file musí mít jednoznačný canonical pair:

- `ROLE_NAME.full.md`
- `ROLE_NAME.builder.md`

Builder compact review se vždy dělá proti odpovídajícímu `prompt_sources/ROLE_NAME.full.md`.

---

## 3) Naming convention

### Pilot evidence

Path:

- `operations/evidence/custom-gpt-pilots/`

Pattern:

- `PILOT-XXX-role-name.yaml`

Příklad:

- `PILOT-001-positioning-police.yaml`

### Prompt source

Path:

- `custom_gpts/commercial_layer/prompt_sources/`

Pattern:

- `ROLE_NAME.full.md`

### Builder compact

Path:

- `custom_gpts/commercial_layer/builder_compact/`

Pattern:

- `ROLE_NAME.builder.md`

### Summary / verification docs

Summary docs mají být krátké, účelové a explicitně pojmenované.

Preferred examples:

- `operations/evidence/post-merge-verification.md`
- `operations/evidence/custom-gpt-pilots/pilot-artifacts-bundle.md`

### Operator-run artifacts

Operator-run evidence patří do samostatné operating vrstvy:

- `operations/evidence/operator-runs/`

Recommended pattern:

- `OPRUN-XXX_operator_run_starter_brief.md`
- `OPRUN-XXX_operator_run_trace.md`
- `OPRUN-XXX_operator_run_review.md`
- `OPRUN-XXX_operator_run_decision.md`

---

## 4) Review / release discipline

### PR class rules

#### Evidence-only PR

Smí obsahovat pouze evidence artifacts, typicky:

- pilot evidence YAML
- operator-run evidence

Nesmí míchat:

- prompt source files
- builder compact files
- backend/runtime changes

#### Prompt-only PR

Smí obsahovat pouze prompt source nebo jejich odpovídající builder compact změny,
pokud je to nutné pro stejnou roli a stejný scope.

Nesmí míchat:

- pilot evidence YAML
- summary verification docs
- operator-run docs

#### Summary-only PR

Smí obsahovat pouze summary / verification docs.

Summary PR nesmí:

- předstírat canonical truth
- rozhodovat proti skutečnému file inventory
- přepisovat prompt source semantics

#### Operator-run PR

Operator-run docs musí být oddělené od pilot merge práce.
Operator run je operating phase, ne pilot baseline merge práce.

### Actual files > preview output

Source of truth je skutečný soubor v repu.
Preview blok, chat render nebo zkrácený copy block nesmí přebít skutečný soubor.

### Small-diff rule

Preferovat:

- 1 scope
- 1 PR
- 1 pracovní vrstvu

Nedělat:

- evidence + prompt rewrite + dashboard + ops v jednom kroku

### Merge order rule

1. evidence
2. prompt artifacts
3. summary / verification
4. convention hardening
5. first real operator run

---

## 5) Artifact separation

Musí být jasně oddělené tyto třídy artefaktů:

### Evidence

- `operations/evidence/custom-gpt-pilots/*.yaml`
- `operations/evidence/operator-runs/*.md`

Účel:

- audit trail
- run trace
- review / decision evidence

### Prompt sources

- `custom_gpts/commercial_layer/prompt_sources/*.full.md`

Účel:

- canonical authoring truth

### Builder compact deployment files

- `custom_gpts/commercial_layer/builder_compact/*.builder.md`

Účel:

- Builder-safe deployment form canonical promptu

### Summary / verification docs

- `operations/evidence/*.md`
- `operations/evidence/custom-gpt-pilots/*.md`

Účel:

- stručný stavový nebo ověřovací souhrn

Summary docs nejsou canonical prompt source ani audit verdict authority.

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

## Immediate next step

Po tomto hardeningu:

1. nepouštět další repo-wide změny bez explicitního zadání
2. připravit první skutečný operator run
3. použít OPRUN-001 flow
4. zapsat trace / review / decision odděleně do `operations/evidence/operator-runs/`
5. teprve potom řešit další rozšíření nebo dashboard vrstvu

Recommended first route:

- `SYSTEM_OS_MASTER`
- potom `POSITIONING_POLICE`

---

## Success condition

Hardening je dostatečný, pokud je po přečtení tohoto briefu jasné:

- co je canonical source
- co je deployment form
- co je evidence vs summary vs operator-run artifact
- že další práce nemá vytvářet mix PR
- že první real operator run může začít bez další governance mlhy
