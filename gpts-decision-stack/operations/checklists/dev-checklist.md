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
