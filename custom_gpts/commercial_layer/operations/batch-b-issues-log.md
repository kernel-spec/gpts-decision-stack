# Batch B — Issues Log

## Účel

Tento soubor eviduje všechny problémy identifikované během živého testování Batch B
commercial GPT rolí v prostředí ChatGPT Builder. Slouží jako auditní záznam pro
korektivní akce, re-testy a release tracking.

Referenční soubory:
- `custom_gpts/commercial_layer/operations/batch-b-live-validation-report.yaml`
- `custom_gpts/commercial_layer/operations/batch-b-handoff-test-matrix.yaml`
- `custom_gpts/commercial_layer/operations/batch-b-live-deployment-checklist.md`

---

## Issue logging rules

- Každý issue musí mít unikátní ID ve formátu `BB-NNN`.
- Každý issue musí mít: affected_role, category, severity, description, fix_applied,
  retest_result, status.
- Severity: `low` | `medium` | `high` | `blocker`.
- Status: `OPEN` | `RESOLVED` | `WONT_FIX`.
- Neupravovat `.builder.md` bez záznamu issue a po-fixového re-testu.
- Nepostupovat na Batch C pokud existuje jakýkoliv issue se status `OPEN` a severity
  `high` nebo `blocker`.

---

## Issue template

```
### ISSUE-ID: BB-NNN

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

### ISSUE-ID: BB-001

| Pole            | Hodnota                                              |
|-----------------|------------------------------------------------------|
| Affected role   | MARKET_SCOUT_OUTBOUND                                |
| Category        | citation_discipline                                  |
| Severity        | low                                                  |
| Detected        | 2026-03-18 — live Builder test                       |
| Status          | RESOLVED                                             |

**Description:**
MARKET_SCOUT_OUTBOUND měl slabší citation discipline než je požadováno.
Pricing tvrzení a offer claims nebyly vždy viditelně vázány na explicitní
citované zdroje. Sources sekce hrozila degradací na pouhé source labels bez
jasného citation expectations.

**Evidence:**
- Model produkoval pricing signály a offer claims bez explicitního odkazu na
  konkrétní citovaný zdroj.
- Sources sekce obsahovala vágní source labels místo explicitních URL nebo
  referencí pro každé materiální market claim.
- Výzkumná kvalita byla silná, ale citation discipline nedosahovala požadované úrovně.

**Fix applied:**
- Do HARD RULES přidáno:
  `"All factual pricing and offer claims must be source-cited"`,
  `"Do not state pricing as fact without a cited source"`,
  `"Use primary sources whenever available"`,
  `"If sources conflict, show both and mark confidence"`,
  `"Sources block must include explicit source references for all material market claims"`.
- Sources output block rozšířen o požadavek na explicitní source reference pro
  každé materiální market claim, pricing signal nebo competitor offer.
- Do SELF-CHECK přidáno:
  `"all pricing and offer claims tied to a cited source?"`,
  `"sources block contains explicit references for all material claims?"`.

**Files changed:**
- `custom_gpts/commercial_layer/builder_compact/MARKET_SCOUT_OUTBOUND.builder.md`

**Retest result:** PASS

**Notes:**
Retest 14 (TS-B-014: market_scout_no_uncited_pricing) a Retest 17
(TS-B-013: primary_sources_preference) oba PASS po aplikaci fixu.

---

### ISSUE-ID: BB-002

| Pole            | Hodnota                                              |
|-----------------|------------------------------------------------------|
| Affected role   | ASSET_ENGINE                                         |
| Category        | forbidden_claims                                     |
| Severity        | low                                                  |
| Detected        | 2026-03-18 — live Builder test (cross-role handoff)  |
| Status          | RESOLVED                                             |

**Description:**
ASSET_ENGINE injektoval market-derived pricing anchory do generovaného outbound
copy v průběhu cross-role handoff MARKET_SCOUT_OUTBOUND → ASSET_ENGINE. Toto
porušuje forbidden_claims disciplínu v případech, kdy uživatel explicitně
neschválil pricing claims pro použití v assetech.

**Evidence:**
- V cross-role handoff scénáři ASSET_ENGINE převzal pricing data z výstupu
  MARKET_SCOUT_OUTBOUND a vložil je do outbound copy jako nekritovaná tvrzení.
- Generovaný asset obsahoval benchmark nebo anchor pricing language, která nebyla
  explicitně poskytnuta uživatelem jako schválený asset input.
- Porušení: pricing claims z market research se staly přímou součástí copy
  bez uživatelského schválení nebo explicitní citace.

**Fix applied:**
- Do HARD RULES přidáno:
  `"Do not inject market-derived pricing claims into assets"`,
  `"Do not introduce benchmark or pricing-anchor language unless explicitly
  provided by the user for asset use"`,
  `"External market research may inform strategy, but must not be inserted
  into copy as uncited claims"`,
  `"Generated assets must stay proof-safe and citation-safe"`.
- Do SELF-CHECK přidáno:
  `"no external pricing or benchmark claims introduced?"`.

**Files changed:**
- `custom_gpts/commercial_layer/builder_compact/ASSET_ENGINE.builder.md`

**Retest result:** PASS

**Notes:**
Retest 20 (TS-B-CROSS-003: market_scout_findings_as_asset_engine_input) PASS
po aplikaci fixu. One-CTA a no-fake-proof disciplína zachována beze změny.

---

### ISSUE-ID: BB-003

| Pole            | Hodnota                                              |
|-----------------|------------------------------------------------------|
| Affected role   | ASSET_ENGINE, REWRITE_ENGINE, SUGGESTION_ENGINE,     |
|                 | MARKET_SCOUT_OUTBOUND                                |
| Category        | web_boundary                                         |
| Severity        | low                                                  |
| Detected        | 2026-03-18 — live Builder test (web boundary check)  |
| Status          | RESOLVED                                             |

**Description:**
Web ON/OFF boundary pro všechny Batch B role musela být explicitně ověřena.
ASSET_ENGINE zůstává non-web; MARKET_SCOUT_OUTBOUND se musí chovat jako
web-enabled research role.

**Evidence:**
- Ověření nastavení Web Search v ChatGPT Builder pro každou Batch B roli.
- ASSET_ENGINE, REWRITE_ENGINE a SUGGESTION_ENGINE: Web OFF — neprovádí live
  web research, necitují live URLs.
- MARKET_SCOUT_OUTBOUND: Web ON — vždy používá web a cituje zdroje.

**Fix applied:**
- Žádná změna `.builder.md` souborů nebyla nutná pro web boundary validaci.
- Potvrzení správné konfigurace Web Search v ChatGPT Builder pro všechny 4 role.

**Files changed:**
- žádné

**Retest result:** PASS

**Notes:**
Retest 22 (TS-B-CROSS-005: web_on_only_market_scout) PASS.
Web boundary plně validována pro celý Batch B.

---

## Open issues

_Žádné otevřené issuly._

---

## Resolution tracking

| Issue ID | Affected role         | Severity | Status   | Retest    |
|----------|-----------------------|----------|----------|-----------|
| BB-001   | MARKET_SCOUT_OUTBOUND | low      | RESOLVED | PASS      |
| BB-002   | ASSET_ENGINE          | low      | RESOLVED | PASS      |
| BB-003   | web boundary (all 4)  | low      | RESOLVED | PASS      |

**Celkem issues:** 3
**Resolved:** 3
**Open:** 0
**Blockers:** 0

**Batch B release verdict:** PASS — připraveno pro Batch C.
