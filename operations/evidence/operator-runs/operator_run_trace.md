# operator_run_trace.md

## Run Identity

- run_id: OPRUN-001
- date: 2026-03-28
- execution_status: executed
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

```text
Nejmenší správný route je positioning audit přes POSITIONING_POLICE.

NEXT_GPT:
POSITIONING_POLICE
INPUT:
artifacts: |
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
intended_ICP: Head of RevOps / Revenue Operations leader v B2B SaaS
intended_CTA: Book a 15-min call
```

## Selected NEXT_GPT

`POSITIONING_POLICE`

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

```text
1) Truth Source Block
- canonical ICP: Head of RevOps / Revenue Operations leader v B2B SaaS
- canonical CTA: Book a 15-min call
- core claim (approved): AI Workflow Sprint během 14 dní audituje 1 existující workflow a navrhne 1 prioritní AI workflow pro pilotní zavedení včetně SOP, prompt stacku, QA checklistu a doporučení pro pilot.
- approved vocabulary:
  - audit 1 existujícího workflow
  - 1 prioritní AI workflow
  - pilotní zavedení
  - praktický pilot
  - bez nafouknuté transformace
- banned claims:
  - hotová implementace
  - full automation
  - CRM integrace v rámci sprintu
  - garantované revenue zlepšení
  - redesign celého RevOps operating modelu

2) Drift Audit
- artifact: Cold email draft
- issue: Email posouvá offer z audit + pilot framingu do obecného prioritization / ownership framingu.
- type [ICP drift / claim drift / vocabulary drift / CTA drift / tone drift]: vocabulary drift
- severity: medium

- artifact: Cold email draft
- issue: Email podtrhuje "jasně seřazené priority" a "konkrétní vlastníky", ale neukotvuje hlavní deliverable jako audit 1 workflow + návrh 1 prioritního AI workflow.
- type [ICP drift / claim drift / vocabulary drift / CTA drift / tone drift]: claim drift
- severity: medium

- artifact: Cold email draft
- issue: Nabídka v emailu může znít jako širší RevOps prioritization advisory, ne jako úzce scope-locked AI Workflow Sprint.
- type [ICP drift / claim drift / vocabulary drift / CTA drift / tone drift]: tone drift
- severity: low

3) Vocabulary Policy
- approved phrases:
  - audit 1 workflow
  - návrh 1 prioritního AI workflow
  - pilotní zavedení
  - SOP
  - prompt stack
  - QA checklist
  - praktický pilot
- banned claims:
  - transformujeme celý váš RevOps
  - zavedeme AI za vás
  - vyřešíme chaos napříč celou organizací
  - nasadíme hotový systém
  - garantujeme provozní výsledky
- rationale for key bans:
  - Offer je audit + pilot design scope, ne plná implementace ani celofiremní transformace.
  - Messaging nesmí přislibovat delivery nebo outcomes, které nejsou v input packu explicitně ukotvené.
- how to handle edge cases:
  - Pokud chceš mluvit o zjednodušení nebo srovnání chaosu, vždy to ukotvi k auditu 1 workflow a k návrhu pilotu.
  - Pokud deliverable není v input packu explicitní, neproměňuj ho v claim.

4) Minimal Fix List
- artifact: Cold email draft
- current text [quoted]: "AI Workflow Sprint je krátký formát, který pomůže převést roztříštěné signály do: - jasně seřazených priorit, - konkrétních vlastníků, - a navazujících kroků, které se dají opravdu provést."
- issue: Posouvá offer do obecného RevOps prioritization framingu a oslabuje workflow-audit positioning.
- recommended fix: Překotvit value prop na audit 1 existujícího workflow, návrh 1 prioritního AI workflow a pilotní doporučení; prioritizaci ponechat jen jako sekundární důsledek.
- priority: high

- artifact: Cold email draft
- current text [quoted]: "Bez nafouknuté transformace. Jen praktické srovnání toho, co je důležité teď a kdo za to nese odpovědnost."
- issue: Druhá věta znovu rozšiřuje framing do širšího operating model advisory.
- recommended fix: Nahradit formulací, která explicitně drží scope sprintu: audit, návrh pilot workflow a jasné pilotní doporučení.
- priority: medium

- artifact: Cold email draft
- current text [quoted]: celý email neukotvuje deliverables SOP / prompt stack / QA checklist
- issue: Chybí explicitní vazba na konkrétní sprint deliverables, takže offer může působit vágněji než ve source artifactu.
- recommended fix: Přidat krátkou ukotvující větu, že sprint končí doporučeným pilot workflow, SOP, prompt stackem a QA checklistem.
- priority: medium

5) Regression Checklist
Before publishing any new asset:
- [ ] ICP matches canonical ICP?
- [ ] CTA matches canonical CTA?
- [ ] No banned claims used?
- [ ] Approved vocabulary used?
- [ ] Proof-safe language only?
- [ ] No multi-CTA output?
```

## Where human judgment was needed

- Rozhodnutí, že emailový framing je ještě positioning drift a ne samostatný pricing / offer-design problém.
- Rozhodnutí, že chybějící explicitní deliverables v emailu jsou relevantní drift, ne pouze legitimní zkrácení copy.

## What was intentionally skipped due to scope discipline

- žádný rewrite emailu
- žádný pricing packaging
- žádný delivery SOP návrh
- žádná asset production expanze
