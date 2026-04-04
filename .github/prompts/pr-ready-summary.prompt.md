---
description: "Use when: preparing a pull request summary for gpts-decision-stack after implementation and validation."
name: "PR-Ready Summary"
argument-hint: "Popiš změny, testy a případné otevřené body"
agent: "agent"
---
Vytvoř PR-ready shrnutí změny pro repozitář gpts-decision-stack.

Vstup:
$ARGUMENTS

Postup:
1. Stručně shrň, co se změnilo a proč.
2. Uveď dopad podle oblastí:
   - backend/worker runtime
   - prompts
   - schemas/artifacts
   - operations/qa/release
3. Zkontroluj konzistenci proti:
   - [MASTER_SPEC.md](../../MASTER_SPEC.md)
   - [repo.manifest.yaml](../../repo.manifest.yaml)
   - [operations/backend_binding.yaml](../../operations/backend_binding.yaml)
4. Uveď governance rizika a mitigace:
   - control plane vs adaptive boundary
   - UNKNOWN disciplína
   - fail-closed semantika
   - explicit re-entry
   - veto release blokace
5. Vypiš provedené ověření a jejich výsledek.
6. Vypiš otevřené body, které blokují merge, nebo explicitně napiš že nejsou.

Vrať výsledek přesně v tomto formátu:

## Change Summary
- 

## Files/Areas Changed
- 

## Consistency With Canonical Sources
- MASTER_SPEC:
- repo.manifest:
- backend_binding:

## Validation Evidence
- Commands run:
- Results:

## Governance Risk Review
- HIGH:
- MEDIUM:
- LOW:

## Merge Blockers
- 

## Suggested PR Description
### Context

### What Changed

### How It Was Verified

### Risks and Mitigations

### Follow-ups

Pravidla:
- Pokud nějaký fakt nelze potvrdit, označ ho jako UNKNOWN.
- Neodhaduj chybějící fakta.
- Odkazuj na kanonické dokumenty místo jejich kopírování.
