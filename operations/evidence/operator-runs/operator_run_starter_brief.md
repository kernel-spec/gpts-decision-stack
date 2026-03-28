# operator_run_starter_brief.md

## Run Identity

- run_id: OPRUN-001
- date: 2026-03-28
- status: prepared_not_executed
- artifact_class: operating_evidence
- owner: Founder / Operator
- repo: kernel-spec/gpts-decision-stack
- linked pilot chain reference: PILOT-001 až PILOT-010 approved_as_baseline
- run mode: simulated-but-realistic internal validation run

## Selected Use Case

- chosen use case: AI Workflow Sprint positioning audit
- primary goal: ověřit positioning audit path bez driftu do rewrite / pricing / delivery scope
- route: SYSTEM_OS_MASTER -> POSITIONING_POLICE

## Boundaries

- no rewrite execution
- no pricing packaging
- no sales closer output
- no delivery SOP
- no asset generation
- no multi-role expansion unless strictly necessary

## Input Pack Summary

- offer summary: AI Workflow Sprint pro B2B SaaS RevOps / GTM týmy
- ICP: Head of RevOps / Revenue Operations leader v B2B SaaS
- intended CTA: Book a 15-min call
- artifacts:
  1. offer description
  2. cold email draft

## Router Entry Block for SYSTEM_OS_MASTER

```text
OPRUN-001

Potřebuji auditovat positioning pro jeden konkrétní commercial offer.

Goal:
- provést positioning audit
- identifikovat drift, claim problémy a vocabulary problémy
- navrhnout minimální opravy bez rewrite scope

Hard boundaries:
- nechci full rewrite
- nechci pricing packaging
- nechci sales call closer output
- nechci delivery SOP
- nechci asset production

Expected routing:
- nejmenší správný route
- jeden specialist, pokud není nutný další

Input pack:
Offer summary:
AI Workflow Sprint je 14denní sprint pro B2B SaaS týmy, který pomáhá vybrat 1 existující workflow,
auditovat jeho současný stav a navrhnout 1 prioritní AI workflow pro pilotní zavedení.
Výstupem má být jasný audit, návrh cílového workflow, SOP, prompt stack, QA checklist a doporučení
pro pilot. Není to hands-on implementace, není to integrace do CRM ani školení širšího týmu.

ICP:
Head of RevOps / Revenue Operations leader v B2B SaaS

Intended CTA:
Book a 15-min call

Existing artifacts:
1. Offer description
AI Workflow Sprint pomáhá revenue týmům převést chaotické a ručně řízené workflow do jasněji
definovaného AI-supported procesu. Typicky se používá ve chvíli, kdy tým vidí příliš mnoho signálů,
příliš mnoho ručních kroků a příliš málo jasného vlastnictví. Sprint během 14 dní dodá audit 1
existujícího workflow, návrh 1 prioritního AI workflow, SOP, prompt stack, QA checklist a doporučení
pro pilotní zavedení. Cílem není velká transformace, ale praktický pilot, který tým může bezpečně
otestovat.

2. Cold email draft
Předmět: Kde se vám ztrácí signály v RevOps?
Ahoj {{first_name}},
u vedoucích RevOps v B2B SaaS často vidím stejný vzorec: signálů je hodně, ale není jasné,
co má prioritu a kdo to má skutečně převzít. To pak vytváří tření mezi CRM, pipeline řízením,
GTM týmy a operativou. Ne proto, že by chyběla data, ale protože chybí jasné pořadí priorit a
vlastnictví.

AI Workflow Sprint je krátký formát, který pomůže převést roztříštěné signály do:
- jasně seřazených priorit,
- konkrétních vlastníků,
- a navazujících kroků, které se dají opravdu provést.

Bez nafouknuté transformace. Jen praktické srovnání toho, co je důležité teď a kdo za to nese
odpovědnost.

Book a 15-min call
```

## Direct Specialist Input for POSITIONING_POLICE

```text
Run a positioning audit only.

Required output:
1. Truth Source Block
2. Drift Audit
3. Vocabulary Policy
4. Minimal Fix List
5. Regression Checklist

Boundaries:
- no rewrite execution
- no pricing design
- no offer expansion
- no delivery SOP
- no asset generation

Use the provided materials as the only working truth unless explicitly marked uncertain.

artifacts:
Offer description:
AI Workflow Sprint pomáhá revenue týmům převést chaotické a ručně řízené workflow do jasněji
definovaného AI-supported procesu. Typicky se používá ve chvíli, kdy tým vidí příliš mnoho signálů,
příliš mnoho ručních kroků a příliš málo jasného vlastnictví. Sprint během 14 dní dodá audit 1
existujícího workflow, návrh 1 prioritního AI workflow, SOP, prompt stack, QA checklist a doporučení
pro pilotní zavedení. Cílem není velká transformace, ale praktický pilot, který tým může bezpečně
otestovat.

Cold email draft:
Předmět: Kde se vám ztrácí signály v RevOps?
Ahoj {{first_name}},
u vedoucích RevOps v B2B SaaS často vidím stejný vzorec: signálů je hodně, ale není jasné,
co má prioritu a kdo to má skutečně převzít. To pak vytváří tření mezi CRM, pipeline řízením,
GTM týmy a operativou. Ne proto, že by chyběla data, ale protože chybí jasné pořadí priorit a
vlastnictví.

AI Workflow Sprint je krátký formát, který pomůže převést roztříštěné signály do:
- jasně seřazených priorit,
- konkrétních vlastníků,
- a navazujících kroků, které se dají opravdu provést.

Bez nafouknuté transformace. Jen praktické srovnání toho, co je důležité teď a kdo za to nese
odpovědnost.

Book a 15-min call

intended_ICP:
Head of RevOps / Revenue Operations leader v B2B SaaS

intended_CTA:
Book a 15-min call
```

## Success Criteria

- router holds single-route discipline
- route = POSITIONING_POLICE
- specialist returns:
  - Truth Source Block
  - Drift Audit
  - Vocabulary Policy
  - Minimal Fix List
  - Regression Checklist
- no rewrite / pricing / delivery drift
- output is usable at least as audit baseline

## Failure Signals

- router creates unnecessary multi-role chain
- router drifts into rewrite / pricing / asset scope
- specialist rewrites instead of auditing
- specialist expands into delivery or pricing design
- output is redesign instead of audit

## Exact Next Action

- paste router entry block into SYSTEM_OS_MASTER
- capture router output
- paste specialist input into POSITIONING_POLICE
- capture specialist output
- complete trace / review / decision docs
