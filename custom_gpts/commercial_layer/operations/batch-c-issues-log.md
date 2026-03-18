# Batch C — Issues Log

## Účel

Tento soubor eviduje všechny problémy identifikované během živého testování Batch C
commercial GPT rolí v prostředí ChatGPT Builder. Slouží jako auditní záznam pro
korektivní akce, re-testy a release tracking.

## Reference files

- `custom_gpts/commercial_layer/operations/batch-c-live-validation-report.yaml`
- `custom_gpts/commercial_layer/operations/batch-c-handoff-test-matrix.yaml`
- `custom_gpts/commercial_layer/operations/batch-c-live-deployment-checklist.md`

---

## Issue logging rules

- Každý issue musí mít unikátní ID ve formátu `BC-NNN`.
- Každý issue musí mít: affected_role, category, severity, description, fix_applied,
  retest_result, status.
- Severity: `low` | `medium` | `high` | `blocker`.
- Status: `OPEN` | `RESOLVED` | `WONT_FIX`.
- Neupravovat `.builder.md` bez záznamu issue a po-fixového re-testu.
- Nepostupovat na finální stack sign-off pokud existuje jakýkoliv issue se status
  `OPEN` a severity `high` nebo `blocker`.

---

## Issue template

```
### ISSUE-ID: BC-NNN

| Pole            | Hodnota                        |
|-----------------|--------------------------------|
| Affected role   |                                |
| Category        |                                |
| Severity        |                                |
| Detected        |                                |
| Status          |                                |

**Description:**
[Popis problému]

**Evidence:**
[Co přesně model vrátil vs. co se očekávalo]

**Fix applied:**
[Popis opravy — co přesně bylo změněno]

**Files changed:**
- `path/to/file`

**Retest result:** PASS / FAIL / PENDING

**Notes:**
[Volitelné poznámky]
```

---

## Resolved issues

### ISSUE-ID: BC-001

| Pole            | Hodnota                                              |
|-----------------|------------------------------------------------------|
| Affected role   | DELIVERY_SOP_ENGINE                                  |
| Category        | meta_output_leakage                                  |
| Severity        | medium                                               |
| Detected        | 2026-03-18 — live Builder test                       |
| Status          | RESOLVED                                             |

**Description:**
DELIVERY_SOP_ENGINE produkoval raw meta-instrukce a placeholder-style výstupy
namísto generování delivery SOP. Původní STOP RULES obsahovaly operátorské direktivy
formulované jako České imperativy ("Vlož Output Contract...", "Vlož Scope Lock..."),
které model vrátil jako literální odpověď. Při dostupnosti výstupů pokračoval s
hodnotami "[TBD]" místo konkrétního obsahu.

**Evidence:**
- Model vrátil text: "Vlož Output Contract (deliverables + timeline)." jako
  přímou odpověď na vstup místo generování SOP.
- Model vrátil text: "Vlož Scope Lock (co je vyloučeno)." jako placeholder
  instrukci namísto výstupního bloku.
- Při průchodu STOP RULES model pokračoval s "[TBD]" hodnotami v povinných blocích
  místo plného obsahu.
- Povinné bloky jako Onboarding Flow, Output Contract a QA sekce nebyly plně populovány.

**Fix applied:**
- STOP RULES přeformulována: operátorské direktivy nahrazeny přirozenými clarifying
  otázkami v češtině ("Co přesně dodáváš? (deliverables + timeline)").
- Průchod při dostupných vstupech přepsán z "proceed with [TBD]" na
  "proceed immediately and produce full SOP output".
- Do HARD RULES přidáno 9 nových pravidel:
  `"Do not output meta-instructions, editor notes, or placeholder text"`,
  `"Do not tell the operator to insert or fill in sections manually"`,
  `"Fill every required output block with actual usable content"`,
  `"Output must be checklist-first and immediately usable"`,
  `"Output must describe delivery design only — never perform or simulate delivery execution"`,
  `"Onboarding flow must include explicit client inputs, deadlines, and ownership"`,
  `"Output Contract must include concrete deliverables and timeline"`,
  `"Scope Lock must include explicit exclusions"`,
  `"QA / acceptance criteria must be concrete and tied to output contract"`.
- WHAT YOU MUST PRODUCE rozšířeno na 10 explicitních bloků s typovanými fieldy
  (owner, deadline, pass condition, sign-off) v sekci OUTPUT FORMAT.
- SELF-CHECK zpřísněn o `"no meta-instructions or placeholder text in output?"` a
  `"all required blocks filled with immediately usable content?"`.

**Files changed:**
- `custom_gpts/commercial_layer/builder_compact/DELIVERY_SOP_ENGINE.builder.md`

**Retest result:** PASS

**Notes:**
Po aplikaci fixu role přestala produkovat meta-instrukce. Povinné bloky plně
populovány. Avšak retest odhalil přetrvávající problém s clarification blocking —
viz BC-002.

---

### ISSUE-ID: BC-002

| Pole            | Hodnota                                              |
|-----------------|------------------------------------------------------|
| Affected role   | DELIVERY_SOP_ENGINE                                  |
| Category        | clarification_over_gating                            |
| Severity        | medium                                               |
| Detected        | 2026-03-18 — live Builder test (Retest 5)            |
| Status          | RESOLVED                                             |

**Description:**
DELIVERY_SOP_ENGINE zůstal po prvním micro-fixu (BC-001) přílišně brzděn
clarification logikou. STOP RULES stále podmínily průchod přítomností explicitního
pole `output_contract`. Při absenci tohoto pole role vždy pokládala dotaz
"Co přesně dodáváš? (deliverables + timeline)" — i když vstup obsahoval sold offer,
client type a delivery window, které jsou dostatečné k inferenci delivery kontraktu.
Role nevyužívala dostupný kontext k přímému generování SOP.

**Evidence:**
- Vstup obsahoval: sold offer (10denní outbound messaging sprint pro founder-led
  B2B SaaS), client type (founder-led B2B SaaS, 2–20 lidí), delivery window (10 dní),
  constraints (checklist-first, žádná exekuce za klienta, jen delivery design).
- Přes dostatečný kontext model vrátil: "Co přesně dodáváš? (deliverables + timeline)"
  jako blocking clarifying otázku namísto generování SOP.
- Toto je přímé porušení expected chování: role měla produkovat kompletní SOP
  přímo bez dotazu při takto jasném vstupu.

**Fix applied:**
- MIN INPUT přesunuta z hard-required na "infer when absent — see INFERENCE RULES":
  `output_contract` — if absent, infer from sold offer + delivery window + client type;
  `scope_lock` — if absent, infer conservative exclusions from offer shape.
- STOP RULES kompletně přepsána na inference-first logiku:
  výchozí chování je "Default behavior: proceed immediately and generate the full SOP".
  Clarifying dotaz povolen pouze pokud jsou SPLNĚNY OBĚ podmínky:
  (1) offer je příliš vágní k inferenci delivery shape,
  (2) chybějící informace by materiálně změnila strukturu SOP.
  Přidána explicitní pravidla:
  `"If the input includes a sold offer, delivery window, or client type → proceed directly"`,
  `"A missing explicit output_contract is NOT blocking when the offer already implies a bounded delivery shape"`,
  `"Never ask for deliverables or timeline when a sprint/window is already stated"`.
- Přidána nová sekce INFERENCE RULES definující:
  bounded offer threshold (≥ 2 ze 3 kritérií: named scope/service, delivery window,
  client type/segment),
  vague offer definici (žádné z těchto kritérií),
  typickou sprint strukturu pro inferenci
  (onboarding/intake → current-state review → core delivery work → draft/review/revision loop → handoff/closeout),
  konzervativní scope guard a označení inferred elementů jako (inferred from offer scope).
- Do HARD RULES přidáno:
  `"When sold offer + delivery window + client type are present, produce the SOP directly"`,
  `"Do not ask the operator to restate what is already obvious from the sold offer"`,
  `"Use conservative default assumptions when details are not explicit"`.
- SELF-CHECK doplněn o 4 nové položky:
  `"proceeded without unnecessary clarification when offer context was sufficient?"`,
  `"used conservative inference from sold-offer context when explicit contract was absent?"`,
  `"no blocking question asked when offer / window / client context were sufficient?"`,
  `"all required blocks generated despite missing explicit output_contract?"`.

**Files changed:**
- `custom_gpts/commercial_layer/builder_compact/DELIVERY_SOP_ENGINE.builder.md`

**Retest result:** PASS

**Notes:**
Po aplikaci druhého micro-fixu vstup s 10denním outbound messaging sprintem pro
founder-led B2B SaaS generuje kompletní SOP přímo bez clarifying dotazu. Bounded
offer threshold (named scope + delivery window + client type) splněn → role
postupuje okamžitě s konzervativní default delivery strukturou. Retest 5 PASS.

---

## Open issues

_Žádné otevřené issuly._

---

## Resolution tracking

| Issue ID | Affected role       | Severity | Status   | Retest  |
|----------|---------------------|----------|----------|---------|
| BC-001   | DELIVERY_SOP_ENGINE | medium   | RESOLVED | PASS    |
| BC-002   | DELIVERY_SOP_ENGINE | medium   | RESOLVED | PASS    |

**Celkem issues:** 2
**Resolved:** 2
**Open:** 0
**Blockers:** 0

**Batch C release verdict:** PASS — Top 10 commercial layer rollout kompletní.
