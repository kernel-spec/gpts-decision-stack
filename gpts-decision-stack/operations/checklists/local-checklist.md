# Local Checklist

## Purpose

Catch structural errors, missing content, and schema issues before any integration environment is used.

## Status values

Use only:

- `PASS`
- `FAIL`
- `BLOCKED`
- `N/A`

`BLOCKED` means the checklist cannot be fairly evaluated because required inputs are missing.

## Readiness checklist

| Check ID | Check | Owner | Status |
|---|---|---|---|
| L-001 | `README.md` exists | Repo Owner |  |
| L-002 | `MASTER_SPEC.md` exists | Repo Owner |  |
| L-003 | `repo.manifest.yaml` exists and is a full final file | Repo Owner |  |
| L-004 | all `prompts/...` files exist | Prompt Owner |  |
| L-005 | all `prompts/...` files have content | Prompt Owner |  |
| L-006 | all `knowledge/...` files exist | Knowledge Owner |  |
| L-007 | all `knowledge/...` files have content | Knowledge Owner |  |
| L-008 | all `schemas/...` files exist | Schema Owner |  |
| L-009 | all `tests/acceptance/...` files exist | QA Owner |  |
| L-010 | all `tests/fixtures/...` files exist | QA Owner |  |
| L-011 | all `tests/fixtures/...` files have content | QA Owner |  |
| L-012 | YAML syntax validation completed | Repo Owner |  |
| L-013 | manifest references point to existing files | Repo Owner |  |
| L-014 | acceptance references point to existing fixtures | QA Owner |  |
| L-015 | ownership map exists | Governance Ops |  |
| L-016 | approval map exists | Governance Ops |  |
| L-017 | operational veto map exists | Governance Ops |  |
| L-018 | QA artifact path is defined | QA Owner |  |

## Exit criteria

| Criterion | Required Result |
|---|---|
| all required files exist | `PASS` |
| knowledge completeness | `PASS` |
| fixture completeness | `PASS` |
| schema syntax | `PASS` |
| manifest consistency | `PASS` |

## Evidence pack

| Evidence | Required |
|---|---|
| file existence report | yes |
| YAML validation output | yes |
| manifest reference check | yes |
| local QA report | yes |

## Gate result template

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

Fail-fast rule

If any knowledge_file is missing content, or any fixture is missing or empty, local may continue only as working draft validation.

Required result:

overall_status: FAIL
bundle_classification: REPO-READY SKELETON
deployment_ready_stack: false

