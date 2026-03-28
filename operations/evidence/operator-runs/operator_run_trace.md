# operator_run_trace.md

## Run Identity

- run_id: OPRUN-001
- date: 2026-03-28
- execution_status: prepared_not_executed
- artifact_class: operating_evidence
- run mode: simulated-but-realistic internal validation run
- route: SYSTEM_OS_MASTER -> POSITIONING_POLICE

## Exact router input

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

## Exact router output

_Doplnit po skutečném běhu._

## Selected NEXT_GPT

_Doplnit po skutečném běhu._

## Exact specialist input

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

## Exact specialist output

_Doplnit po skutečném běhu._

## Where human judgment was needed

_Doplnit po skutečném běhu._

## What was intentionally skipped due to scope discipline

- expected skip: žádný rewrite emailu
- expected skip: žádný pricing packaging
- expected skip: žádný delivery SOP návrh
- expected skip: žádná asset production expanze
