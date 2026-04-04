---
description: "Use when: editing artifact JSON/YAML schemas in schemas/artifacts, adding new artifact types, or changing artifact shape/enum constraints in gpts-decision-stack."
name: "Artifact Schema Rules"
applyTo: "schemas/artifacts/**/*.yaml"
---
# Artifact Schema Rules

## Scope
- Tato instrukce platí pro soubory v `schemas/artifacts/`.
- Schémata jsou kanonický kontrakt pro artifact shape; změny dělej konzervativně.

## Before You Change
- Načti `MASTER_SPEC.md` a `repo.manifest.yaml`.
- Ověř vazbu na vlastněný artefakt agenta (control plane/adaptive engine) v `repo.manifest.yaml`.
- Pokud měníš artifact typy nebo enumy, zkontroluj konzistenci s `knowledge/core/03_ArtifactSchemas.yaml`.

## Change Discipline
- Zachovávej kanonické artifact names a `artifact_type` konstanty.
- Neměň bez důvodu současně názvy artifactů, pipeline state mapování a ownership.
- Při rozšíření schématu preferuj kompatibilní změny; breaking změnu dělej jen s explicitním odůvodněním.
- Povinné vstupy neodhaduj; pravidla UNKNOWN disciplíny respektuj dle `MASTER_SPEC.md`.

## Consistency Checks
- Po změně schématu zkontroluj, že odpovídající položka v `repo.manifest.yaml` stále ukazuje na správný soubor.
- Ověř, že decision status enumy jsou kompatibilní s kanonickými hodnotami v `MASTER_SPEC.md`.
- Pokud přidáš nový schema soubor, doplň jeho registraci do `repo.manifest.yaml`.

## Verification
- Spusť validaci, která je dostupná pro změněnou část repo (typicky backend testy/typecheck, pokud schéma ovlivňuje runtime parsování).
- U změn s dopadem na governance zkontroluj i relevantní acceptance test fixtures v `tests/acceptance/`.

## References
- System source of truth: `MASTER_SPEC.md`
- Canonical component/artifact map: `repo.manifest.yaml`
- Artifact schema mapping rules: `knowledge/core/03_ArtifactSchemas.yaml`
- Core governance semantics: `knowledge/core/05_FailureSemantics.yaml`
- Acceptance scenarios: `tests/acceptance/`
