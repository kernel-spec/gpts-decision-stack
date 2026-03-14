# Kontrolní seznam Staging

## Účel

Spustit plnou zkoušku vydání s aktivovanou realitou správy.

Toto prostředí validuje:
- úplné pokrytí akceptačními testy
- podnikovou topologii
- regulovanou eskalaci
- workflow schvalování
- operační veto
- blokování vydání mimo model
- finální staging bránu

## Hodnoty stavu

Používejte pouze:
- `PASS`
- `FAIL`
- `BLOCKED`
- `N/A`

## Vstupní blokátory

Pokud některé z následujících není pravdivé, staging je automaticky BLOCKED:

| Blokátor | Požadováno |
|---|---|
| všechny knowledge_files mají obsah | ano |
| všechny soubory tests/fixtures/... existují a mají obsah | ano |
| QA artefakt existuje | ano |
| mapa vlastnictví existuje | ano |
| mapa schválení existuje | ano |
| mapa veta existuje | ano |

## Kontrolní seznam připravenosti

| Check ID | Kontrola | Vlastník | Stav |
|---|---|---|---|
| S-001 | dev gate = PASS | Release Coordinator |  |
| S-002 | úplnost znalostí = PASS | Knowledge Owner |  |
| S-003 | úplnost fixtures = PASS | QA Owner |  |
| S-004 | QA artefakt existuje | QA Owner |  |
| S-005 | mapa vlastnictví existuje | Governance Ops |  |
| S-006 | mapa schválení existuje | Governance Ops |  |
| S-007 | mapa veta existuje | Governance Ops |  |
| S-008 | fronta schvalování je připojena | Platform Owner |  |
| S-009 | registr veta je připojen | Platform Owner |  |
| S-010 | release controller je připojen | Platform Owner |  |
| S-011 | AC-001 = PASS | QA Owner |  |
| S-012 | AC-002 = PASS | QA Owner |  |
| S-013 | AC-003 = PASS | QA Owner |  |
| S-014 | AC-004 = PASS | QA Owner |  |
| S-015 | AC-005 = PASS | QA Owner |  |
| S-016 | AC-006 = PASS | QA Owner |  |
| S-017 | AC-007 = PASS | QA Owner |  |
| S-018 | AC-008 = PASS | QA Owner |  |
| S-019 | AC-009 = PASS | QA Owner |  |
| S-020 | AC-010 = PASS | QA Owner |  |
| S-021 | AC-011 = PASS | QA Owner |  |
| S-022 | AC-012 = PASS | QA Owner |  |
| S-023 | žádný scénář nekončí false proceed | QA Owner |  |
| S-024 | eskalace schvalování funguje | Governance Ops |  |
| S-025 | aktivní veto blokuje vydání | Governance Ops |  |
| S-026 | release.block funguje mimo model | Platform Owner |  |
| S-027 | finální staging gate report = PASS | QA Owner |  |

## Kritéria ukončení

| Kritérium | Požadovaný výsledek |
|---|---|
| všechny akceptační testy | PASS |
| vynucování veta | PASS |
| workflow schvalování | PASS |
| blokování vydání | PASS |
| QA artefakt | PASS |
| počet false proceed | 0 |

## Balíček důkazů

| Důkaz | Požadováno |
|---|---|
| výstup běhu akceptačních testů | ano |
| QA gate report | ano |
| důkaz schválení | ano |
| důkaz veta | ano |
| důkaz blokování vydání | ano |

## Šablona výsledku brány

```yaml
staging_gate_result:
  environment: staging
  overall_status: PASS|FAIL|BLOCKED
  blocking_gaps: []
  evidence:
    - acceptance_run_output
    - qa_gate_report
    - approval_evidence
    - veto_evidence
    - release_block_evidence
```

## Tvrdé pravidlo

Staging musí zůstat BLOCKED pokud úplnost znalostí nebo úplnost fixtures není PASS.
