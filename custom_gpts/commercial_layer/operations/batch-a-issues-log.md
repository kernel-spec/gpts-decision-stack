# Batch A — Issues Log

## Účel

Tento soubor eviduje všechny problémy identifikované během živého testování Batch A
commercial GPT rolí v prostředí ChatGPT Builder. Slouží jako auditní záznam pro
korektivní akce, re-testy a release tracking.

Referenční soubory:
- `custom_gpts/commercial_layer/operations/batch-a-live-validation-report.yaml`
- `custom_gpts/commercial_layer/operations/batch-a-handoff-test-matrix.yaml`
- `custom_gpts/commercial_layer/operations/batch-a-live-deployment-checklist.md`

---

## Issue logging rules

- Každý issue musí mít unikátní ID ve formátu `BA-NNN`.
- Každý issue musí mít: affected_role, category, severity, description, fix_applied,
  retest_result, status.
- Severity: `low` | `medium` | `high` | `blocker`.
- Status: `OPEN` | `RESOLVED` | `WONT_FIX`.
- Neupravovat `.builder.md` bez záznamu issue a po-fixového re-testu.
- Nepostupovat na Batch B pokud existuje jakýkoliv issue se status `OPEN` a severity
  `high` nebo `blocker`.

---

## Issue template

```
### ISSUE-ID: BA-NNN

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

### ISSUE-ID: BA-001

| Pole            | Hodnota                                        |
|-----------------|------------------------------------------------|
| Affected role   | STRUCTURAL_ENGINE                              |
| Category        | schema_discipline                              |
| Severity        | medium                                         |
| Detected        | 2026-03-17 — live smoke test                  |
| Status          | RESOLVED                                       |

**Description:**
STRUCTURAL_ENGINE vynechával povinné výstupní sekce. Původní prompt obsahoval pouze
7 bloků zkombinovaných do jednoho bloku "Validation Metric + Kill Criteria". Blok
"14-Day Execution Plan" a blok "Risks" nebyly v promptu jako samostatné povinné sekce,
čímž model tyto sekce vynechával.

**Evidence:**
- Model vrátil 7 bloků místo požadovaných 10.
- Bloky "14-Day Execution Plan" a "Risks" chyběly zcela.
- Blok "Validation Metric + Kill Criteria" byl fúzí 3 samostatných bloků.

**Fix applied:**
- Původní blok 7 "Validation Metric + Kill Criteria" nahrazen 4 samostatnými bloky:
  `7) 14-Day Execution Plan`, `8) Early Validation Metric`, `9) Kill Criteria`,
  `10) Risks`.
- Do HARD RULES přidáno:
  `"Use exact output section names — do not rename output blocks"`
  a `"All 10 required output blocks must be present"`.
- Do SELF-CHECK přidáno: přítomnost 14-Day Execution Plan, Risks sekce
  a přesné pojmenování všech 10 bloků.

**Files changed:**
- `custom_gpts/commercial_layer/builder_compact/STRUCTURAL_ENGINE.builder.md`

**Retest result:** PASS

---

### ISSUE-ID: BA-002

| Pole            | Hodnota                                        |
|-----------------|------------------------------------------------|
| Affected role   | PRICING_PACKAGER                               |
| Category        | schema_discipline                              |
| Severity        | medium                                         |
| Detected        | 2026-03-17 — live smoke test                  |
| Status          | RESOLVED                                       |

**Description:**
PRICING_PACKAGER vrátil nesprávné názvy výstupních bloků a vynechal povinnou sekci
"Risks + Mitigations". Prompt neobsahoval explicitní zákaz přejmenování bloků.

**Evidence:**
- Model vrátil blok nazvaný `"Package Structure"` místo požadovaného `"3-Tier Packages"`.
- Model vrátil blok nazvaný `"Anchoring & Risk Reversal"` místo `"Anchors & Risk Reversal"`.
- Sekce `"Risks + Mitigations"` zcela chyběla v původním promptu i ve výstupu.

**Fix applied:**
- Blok 2 přejmenován z `"Package Structure"` na `"3-Tier Packages"` v sekci
  WHAT YOU MUST PRODUCE i OUTPUT FORMAT.
- Blok 4 přejmenován z `"Anchoring & Risk Reversal"` na `"Anchors & Risk Reversal"`.
- Přidán nový blok 7 `"Risks + Mitigations"` (risk 1, risk 2, mitigation).
- Do HARD RULES přidáno:
  `"Use exact output section names — do not rename output blocks"`
  a `"All 7 required output blocks must be present"`.
- Do SELF-CHECK přidáno: přesné pojmenování všech 7 bloků.

**Files changed:**
- `custom_gpts/commercial_layer/builder_compact/PRICING_PACKAGER.builder.md`

**Retest result:** PASS

---

### ISSUE-ID: BA-003

| Pole            | Hodnota                                        |
|-----------------|------------------------------------------------|
| Affected role   | POSITIONING_POLICE                             |
| Category        | schema_discipline                              |
| Severity        | medium                                         |
| Detected        | 2026-03-17 — live smoke test                  |
| Status          | RESOLVED                                       |

**Description:**
POSITIONING_POLICE vrátil nesprávné názvy výstupních bloků a neúplný první blok.
Block 1 neobsahoval povinné kanonické fieldy. Prompt neobsahoval explicitní zákaz
přejmenování bloků.

**Evidence:**
- Model vrátil blok nazvaný `"Truth Source Block"` místo `"Single Source of Truth"`.
- Model vrátil blok nazvaný `"Vocabulary Policy"` místo `"Vocabulary & Claims Policy"`.
- Block 1 neobsahoval: `canonical promise`, `canonical deliverables`, `canonical scope lock`.

**Fix applied:**
- Blok 1 přejmenován z `"Truth Source Block"` na `"Single Source of Truth"` v sekci
  WHAT YOU MUST PRODUCE i OUTPUT FORMAT.
- Blok 3 přejmenován z `"Vocabulary Policy"` na `"Vocabulary & Claims Policy"`.
- Do OUTPUT FORMAT bloku 1 přidány chybějící fieldy:
  `canonical promise`, `canonical deliverables`, `canonical scope lock`.
- Do HARD RULES přidáno:
  `"Use exact output section names — do not rename output blocks"`
  a `"All 5 required output blocks must be present and complete"`.
- Do SELF-CHECK přidáno: kontrola přesných názvů bloků 1 a 3, kontrola přítomnosti
  všech 5 kanonických fieldů v bloku 1, kompletnost všech 5 bloků.

**Files changed:**
- `custom_gpts/commercial_layer/builder_compact/POSITIONING_POLICE.builder.md`

**Retest result:** PASS

---

## Open issues

_Žádné otevřené issuly._

---

## Resolution tracking

| Issue ID | Affected role     | Severity | Status   | Retest  |
|----------|-------------------|----------|----------|---------|
| BA-001   | STRUCTURAL_ENGINE | medium   | RESOLVED | PASS    |
| BA-002   | PRICING_PACKAGER  | medium   | RESOLVED | PASS    |
| BA-003   | POSITIONING_POLICE| medium   | RESOLVED | PASS    |

**Celkem issues:** 3
**Resolved:** 3
**Open:** 0
**Blockers:** 0

**Batch A release verdict:** PASS — připraveno pro Batch B.
