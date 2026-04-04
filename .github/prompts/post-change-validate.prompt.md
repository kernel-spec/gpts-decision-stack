---
description: "Use when: validating a completed change in gpts-decision-stack before commit or PR creation."
name: "Post-Change Validation"
argument-hint: "Popiš, co se změnilo a jaké soubory byly dotčené"
agent: "agent"
---
Proveď post-change validaci po implementaci změny v repozitáři `gpts-decision-stack`.

Změna k validaci:
$ARGUMENTS

Postupuj v tomto pořadí:
1. Načti a použij jako referenci:
   - [MASTER_SPEC.md](../../MASTER_SPEC.md)
   - [repo.manifest.yaml](../../repo.manifest.yaml)
   - [operations/backend_binding.yaml](../../operations/backend_binding.yaml)
2. Zkontroluj, zda se změna nedotkla těchto kontraktů bez návazných úprav:
   - prompt -> artifact ownership
   - artifact -> schema mapping
   - backend endpoint behavior -> action contract
3. Ověř governance invarianty:
   - control plane boundary je zachovaná
   - UNKNOWN disciplína není porušená
   - fail-closed semantika je zachovaná
   - explicitní re-entry pravidla nejsou porušená
   - veto blokace release zůstává absolutní
4. Navrhni minimální sadu ověření k provedení podle dotčených částí:
   - backend: typecheck/test/dev run
   - schema/prompt změny: konzistence s manifestem a acceptance scénáři
   - evidence: jen pokud jde o runtime/gate dopad
5. Vypiš, co je připravené na commit a co ještě chybí.

Vrať výsledek přesně takto:

## Validation Summary
- Status: PASS | FAIL | PARTIAL
- Scope reviewed:

## Contract Consistency
- Prompt/Artifact:
- Artifact/Schema:
- Backend/Action Contract:

## Governance Checks
- Control plane boundary:
- UNKNOWN discipline:
- Fail-closed semantics:
- Re-entry explicitness:
- Veto release blocking:

## Required Fixes Before Commit
1.
2.

## Suggested Verification Commands
- 

## Ready-to-Commit Checklist
- [ ]
- [ ]

## UNKNOWNs / Assumptions
- 

Pravidla odpovědi:
- Pokud něco nelze ověřit, označ to explicitně jako `UNKNOWN`.
- Neodhaduj chybějící fakta.
- Odkazuj na kanonické dokumenty místo jejich kopírování.
