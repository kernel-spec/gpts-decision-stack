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
