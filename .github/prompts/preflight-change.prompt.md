---
description: "Use when: preparing a non-trivial code or contract change in gpts-decision-stack and needing a preflight impact check before edits."
name: "Preflight Change Check"
argument-hint: "Popiš plánovanou změnu a dotčené soubory"
agent: "agent"
---
Proveď preflight kontrolu plánované změny v repozitáři `gpts-decision-stack`.

Plánovaná změna:
$ARGUMENTS

Postupuj přesně v tomto pořadí:
1. Načti a použij jako source-of-truth:
   - [MASTER_SPEC.md](../../MASTER_SPEC.md)
   - [repo.manifest.yaml](../../repo.manifest.yaml)
   - [operations/backend_binding.yaml](../../operations/backend_binding.yaml)
2. Urči, zda změna zasahuje některou oblast:
   - backend runtime (`backend/worker/src/**`)
   - artifact schemas (`schemas/artifacts/**`)
   - prompty (`prompts/**`)
   - governance/operations (`operations/**`, `qa/**`, `release/**`)
3. Zkontroluj konzistenci vůči invariantům:
   - control plane vs adaptive boundary
   - UNKNOWN disciplína
   - fail-closed rozhodování (žádný falešný `proceed`)
   - explicitní re-entry
   - veto jako absolutní blokace release
4. Zkontroluj mapování prompt -> artifact -> schema -> manifest, pokud je relevantní.
5. Navrhni minimální bezpečný plán implementace v malých reviewovatelných krocích.
6. Navrhni verifikační kroky (typecheck/test/evidence) jen pro dotčené části.

Vrať výsledek přesně v tomto formátu:

## Scope
- Dotčené oblasti:
- Dotčené soubory/cesty:

## Risks
- HIGH:
- MEDIUM:
- LOW:

## Required Consistency Updates
- 

## Safe Implementation Plan
1.
2.
3.

## Verification Plan
- 

## Blockers or UNKNOWNs
- 

Pravidla odpovědi:
- Pokud chybí klíčový vstup, explicitně napiš `UNKNOWN`.
- Neodhaduj chybějící fakta.
- Odkazuj na kanonické dokumenty, neduplikuj jejich plný obsah.
