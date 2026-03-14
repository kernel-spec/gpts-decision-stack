#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-gpts-decision-stack}"

mkdir -p \
  "$ROOT/operations/checklists" \
  "$ROOT/operations/gates"

cat > "$ROOT/operations/checklists/local-checklist.md" <<'EOF'
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

EOF

cat > "$ROOT/operations/checklists/dev-checklist.md" <<'EOF'
# Kontrolní seznam Dev

## Účel

Validovat první skutečnou integraci GPT konfigurace s backendem a službami vynucování.

## Hodnoty stavu

Používejte pouze:
- `PASS`
- `FAIL`
- `BLOCKED`
- `N/A`

## Vstupní kritéria

| Kritérium | Požadováno |
|---|---|
| local gate = PASS | ano |
| backend image build existuje | ano |
| dev target existuje | ano |
| dev secrets existují | ano |
| GPT config binding je připraven | ano |

## Kontrolní seznam připravenosti

| Check ID | Kontrola | Vlastník | Stav |
|---|---|---|---|
| D-001 | local gate = PASS | Release Coordinator |  |
| D-002 | action backend build existuje | Platform Owner |  |
| D-003 | actions/openapi.yaml je svázán s konkrétním backendem | Platform Owner |  |
| D-004 | auth binding je definován | Security Owner |  |
| D-005 | mapování vlastníků endpointů existuje | Platform Owner |  |
| D-006 | deployment target pro dev existuje | Platform Owner |  |
| D-007 | core GPT jsou provisioned | GPT Ops Owner |  |
| D-008 | adaptive GPT jsou provisioned | GPT Ops Owner |  |
| D-009 | knowledge bundle binding odpovídá manifestu | GPT Ops Owner |  |
| D-010 | actions binding odpovídá manifestu | GPT Ops Owner |  |
| D-011 | /v1/state/read odpovídá | Platform Owner |  |
| D-012 | /v1/artifacts/validate odpovídá | Platform Owner |  |
| D-013 | /v1/policy/read odpovídá | Platform Owner |  |
| D-014 | /v1/decision-log/append odpovídá | Platform Owner |  |
| D-015 | /v1/veto/check odpovídá | Platform Owner |  |
| D-016 | CP-Governor smoke test = PASS | GPT Ops Owner |  |
| D-017 | AE-Intake smoke test = PASS | GPT Ops Owner |  |
| D-018 | AE-Claims bez důkazů vrací non-proceed | GPT Ops Owner |  |
| D-019 | append decision logu funguje | Audit Owner |  |
| D-020 | selhání autentizace vrací očekávanou sémantiku selhání | Security Owner |  |

## Kritéria ukončení

| Kritérium | Požadovaný výsledek |
|---|---|
| stav backendu | PASS |
| GPT provisioning | PASS |
| auth binding | PASS |
| mapování endpointů | PASS |
| smoke testy | PASS |
| zápis decision logu | PASS |

## Balíček důkazů

| Důkaz | Požadováno |
|---|---|
| log nasazení | ano |
| výstup stavu backendu | ano |
| výstup kontroly autentizace | ano |
| výsledky GPT smoke testů | ano |
| ukázka appendu decision logu | ano |

## Šablona výsledku brány

```yaml
dev_gate_result:
  environment: dev
  overall_status: PASS|FAIL|BLOCKED
  blocking_gaps: []
  evidence:
    - deploy_log
    - backend_health_output
    - auth_check_output
    - gpt_smoke_results
    - decision_log_append_sample
```

## Pravidlo blokování

Dev je BLOCKED pokud backend není konkrétně svázán, nebo pokud chybí auth binding, vlastnictví endpointů nebo GPT/action binding.
EOF

cat > "$ROOT/operations/checklists/staging-checklist.md" <<'EOF'
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
EOF

cat > "$ROOT/operations/checklists/prod-checklist.md" <<'EOF'
# Kontrolní seznam Prod

## Účel

Řídit produkční vydání schváleného release kandidáta.

## Hodnoty stavu

Používejte pouze:
- `PASS`
- `FAIL`
- `BLOCKED`
- `N/A`

## Vstupní kritéria

| Kritérium | Požadováno |
|---|---|
| staging gate = PASS | ano |
| finální QA artefakt = PASS | ano |
| autoritativní release notes existují | ano |
| mapy vlastnictví / schválení / veta jsou schváleny | ano |
| rollback plán existuje | ano |
| monitoring a alerting existují | ano |

## Kontrolní seznam připravenosti

| Check ID | Kontrola | Vlastník | Stav |
|---|---|---|---|
| P-001 | staging gate = PASS | Release Coordinator |  |
| P-002 | finální QA artefakt = PASS | QA Owner |  |
| P-003 | autoritativní release notes schváleny | Release Authority |  |
| P-004 | odvozené poznámky k balíčkování jsou odděleny | Release Coordinator |  |
| P-005 | mapa vlastnictví schválena | Governance Approver |  |
| P-006 | mapa schválení schválena | Governance Approver |  |
| P-007 | mapa veta schválena | Governance Approver |  |
| P-008 | rozsah exportu shell skriptů explicitně rozhodnut | Release Authority |  |
| P-009 | schválený image tag / zmrazení rozsahu vydání existuje | Platform Owner |  |
| P-010 | produkční backend zdravý | Platform Owner |  |
| P-011 | produkční auth zdravý | Security Owner |  |
| P-012 | produkční GPT config aktivní | GPT Ops Owner |  |
| P-013 | post-deploy smoke = PASS | GPT Ops Owner |  |
| P-014 | decision log zapisuje úspěšně | Audit Owner |  |
| P-015 | kontrola veta funguje | Governance Ops |  |
| P-016 | blokování vydání funguje | Governance Ops |  |
| P-017 | alerting zelený | Platform Owner |  |
| P-018 | připravenost na rollback potvrzena | Platform Owner |  |

## Kritéria ukončení

| Kritérium | Požadovaný výsledek |
|---|---|
| schválení správy | PASS |
| produkční smoke | PASS |
| auditní logování | PASS |
| veto a blokování vydání | PASS |
| připravenost na rollback | PASS |

## Balíček důkazů

| Důkaz | Požadováno |
|---|---|
| záznam produkčního nasazení | ano |
| schválený rozsah vydání | ano |
| finální QA artefakt | ano |
| výstup produkčních smoke testů | ano |
| snímek monitoringu | ano |
| autoritativní release notes | ano |

## Šablona výsledku brány

```yaml
prod_gate_result:
  environment: prod
  overall_status: PASS|FAIL|BLOCKED
  blocking_gaps: []
  evidence:
    - production_deployment_record
    - approved_release_scope
    - final_qa_artifact
    - production_smoke_output
    - monitoring_snapshot
    - authoritative_release_notes
```

## Tvrdé pravidlo

Produkce musí zůstat BLOCKED pokud staging není PASS, nebo pokud úplnost znalostí nebo úplnost fixtures není PASS.
EOF

cat > "$ROOT/operations/gates/promotion-gate.yaml" <<'EOF'
status_model:
  allowed_statuses:
    - PASS
    - FAIL
    - BLOCKED
    - N/A

global_promotion_gate:
  fail_if:
    - any_knowledge_file_missing_content
    - any_fixture_missing
    - any_fixture_missing_content
  result_if_triggered:
    overall_status: FAIL
    bundle_classification: REPO-READY SKELETON
    deployment_ready_stack: false
    staging: BLOCKED
    prod: BLOCKED
    blocking_gaps:
      - knowledge_content
      - fixture_content

environment_promotion_map:
  - from: local
    to: dev
    allowed_only_if:
      - repo_manifest_complete
      - prompt_completeness == PASS
      - schema_consistency == PASS
      - backend_binding_defined == PASS
  - from: dev
    to: staging
    allowed_only_if:
      - dev_gate == PASS
      - backend_health == PASS
      - auth_binding == PASS
      - gpt_provisioning == PASS
      - smoke_tests == PASS
  - from: staging
    to: prod
    allowed_only_if:
      - staging_gate == PASS
      - final_qa_artifact == PASS
      - ownership_map_approved == PASS
      - approval_map_approved == PASS
      - veto_map_approved == PASS
      - authoritative_release_notes_approved == PASS

environment_blockers:
  local:
    blocked_if: []
  dev:
    blocked_if:
      - openapi_not_bound_to_concrete_backend
      - auth_binding_missing
      - endpoint_owner_mapping_missing
      - gpt_action_binding_missing
  staging:
    blocked_if:
      - knowledge_file_completeness != PASS
      - fixture_completeness != PASS
      - qa_artifact_missing
      - ownership_map_missing
      - approval_map_missing
      - veto_map_missing
  prod:
    blocked_if:
      - staging_gate != PASS
      - final_qa_artifact != PASS
      - knowledge_file_completeness != PASS
      - fixture_completeness != PASS
      - ownership_map_not_approved
      - approval_map_not_approved
      - veto_map_not_approved
      - authoritative_release_notes_missing

promotion_override_rule:
  if_any:
    - knowledge_file_completeness != PASS
    - fixture_completeness != PASS
  force_result:
    staging: BLOCKED
    prod: BLOCKED
    overall_status: FAIL
    bundle_classification: REPO-READY SKELETON
    deployment_ready_stack: false
    blocking_gaps:
      - knowledge_content
      - fixture_content

current_gate_position:
  overall_status: FAIL
  bundle_classification: REPO-READY SKELETON
  deployment_ready_stack: false
  staging: BLOCKED
  prod: BLOCKED
  blocking_gaps:
    - knowledge_content
    - fixture_content
  reason: >
    Final deployment readiness cannot pass until all knowledge_files and
    tests/fixtures content are explicitly present and auditable.
EOF


echo "Created files:"
printf ' - %s\n' \
  "$ROOT/operations/checklists/local-checklist.md" \
  "$ROOT/operations/checklists/dev-checklist.md" \
  "$ROOT/operations/checklists/staging-checklist.md" \
  "$ROOT/operations/checklists/prod-checklist.md" \
  "$ROOT/operations/gates/promotion-gate.yaml"
