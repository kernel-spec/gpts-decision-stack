---
description: "Use when: editing system prompt files in prompts/core or prompts/adaptive, changing agent role boundaries, or updating pipeline-stage behavior in gpts-decision-stack."
name: "Prompt Governance Rules"
applyTo: "prompts/**/*.md"
---
# Prompt Governance Rules

## Scope
- Platí pro prompt soubory v `prompts/core/` a `prompts/adaptive/`.
- Prompty měň pouze v souladu s kanonickým rozdělením control plane vs adaptive engines.

## Invariant vs Adaptive Boundary
- `prompts/core/` reprezentuje control plane (INVARIANT): změny dělej jen když jsou explicitně požadované a odůvodněné governance.
- `prompts/adaptive/` reprezentuje adaptive engines (ADAPTIVE): změny mohou být častější, ale musí zachovat pipeline kontrakt a artifact ownership.

## Before You Change
- Načti `MASTER_SPEC.md` a `repo.manifest.yaml`.
- Ověř, že upravovaný prompt odpovídá správnému agent ID, pipeline stavu a vlastněnému artefaktu v `repo.manifest.yaml`.
- Pokud změna ovlivní output shape, zkontroluj návazné schéma v `schemas/artifacts/`.

## Prompt Output and Decision Discipline
- Nezaváděj nekanonické artifact názvy ani nekanonické decision status hodnoty.
- Zachovej UNKNOWN disciplínu: chybějící povinné vstupy se neodhadují, explicitně se označují jako `UNKNOWN`.
- Zachovej fail-closed rozhodování: nesmí vznikat falešný `proceed`.
- Re-entry musí být explicitní, tichý re-entry není povolen.

## Change Discipline
- Neměň najednou bez jasné vazby core prompts, artifact schemas a backend logiku.
- U větších prompt změn preferuj malé, reviewovatelné kroky.
- Pravidla duplikuj minimálně; odkazuj na kanonické dokumenty.

## Verification
- Zkontroluj konzistenci prompt->artifact->schema mapování přes `repo.manifest.yaml`.
- Pokud změna ovlivňuje runtime chování, spusť odpovídající validaci backendu (`backend/worker` typecheck/test).
- U governance citlivých změn ověř dopad na acceptance scénáře v `tests/acceptance/`.

## References
- System source of truth: `MASTER_SPEC.md`
- Canonical component/artifact map: `repo.manifest.yaml`
- Artifact schemas: `schemas/artifacts/`
- Governance gate: `operations/gates/promotion-gate.yaml`
- Definition of done: `operations/Definition_of_Done.md`
