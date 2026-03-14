# Kontrolní seznam Local

## Účel

Zachytit strukturální chyby, chybějící obsah a problémy se schématy před použitím jakéhokoli integračního prostředí.

## Hodnoty stavu

Používejte pouze:

- `PASS`
- `FAIL`
- `BLOCKED`
- `N/A`

`BLOCKED` znamená, že kontrolní seznam nelze spravedlivě vyhodnotit, protože chybí požadované vstupy.

## Kontrolní seznam připravenosti

| Check ID | Kontrola | Vlastník | Stav |
|---|---|---|---|
| L-001 | `README.md` existuje | Repo Owner |  |
| L-002 | `MASTER_SPEC.md` existuje | Repo Owner |  |
| L-003 | `repo.manifest.yaml` existuje a je kompletní finální soubor | Repo Owner |  |
| L-004 | všechny soubory `prompts/...` existují | Prompt Owner |  |
| L-005 | všechny soubory `prompts/...` mají obsah | Prompt Owner |  |
| L-006 | všechny soubory `knowledge/...` existují | Knowledge Owner |  |
| L-007 | všechny soubory `knowledge/...` mají obsah | Knowledge Owner |  |
| L-008 | všechny soubory `schemas/...` existují | Schema Owner |  |
| L-009 | všechny soubory `tests/acceptance/...` existují | QA Owner |  |
| L-010 | všechny soubory `tests/fixtures/...` existují | QA Owner |  |
| L-011 | všechny soubory `tests/fixtures/...` mají obsah | QA Owner |  |
| L-012 | validace syntaxe YAML dokončena | Repo Owner |  |
| L-013 | odkazy v manifestu ukazují na existující soubory | Repo Owner |  |
| L-014 | odkazy v akceptačních testech ukazují na existující fixtures | QA Owner |  |
| L-015 | mapa vlastnictví existuje | Governance Ops |  |
| L-016 | mapa schválení existuje | Governance Ops |  |
| L-017 | mapa operačního veta existuje | Governance Ops |  |
| L-018 | cesta k QA artefaktu je definována | QA Owner |  |

## Kritéria ukončení

| Kritérium | Požadovaný výsledek |
|---|---|
| všechny požadované soubory existují | `PASS` |
| úplnost znalostí | `PASS` |
| úplnost fixtures | `PASS` |
| syntaxe schématu | `PASS` |
| konzistence manifestu | `PASS` |

## Balíček důkazů

| Důkaz | Požadováno |
|---|---|
| zpráva o existenci souborů | ano |
| výstup validace YAML | ano |
| kontrola odkazů v manifestu | ano |
| lokální QA zpráva | ano |

## Šablona výsledku brány

```yaml
local_gate_result:
  environment: local
  overall_status: PASS|FAIL|BLOCKED
  blocking_gaps: []
  evidence:
    - file_existence_report
    - yaml_validation_output
    - manifest_reference_check
    - local_qa_report
```

## Pravidlo okamžitého selhání

Pokud jakýkoli knowledge_file nemá obsah, nebo jakýkoli fixture chybí nebo je prázdný, local může pokračovat pouze jako validace pracovního návrhu.

Požadovaný výsledek:

```yaml
overall_status: FAIL
bundle_classification: REPO-READY SKELETON
deployment_ready_stack: false
```

