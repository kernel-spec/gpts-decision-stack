# OPRUN-001 — Operator Run Starter Brief

## Run ID
OPRUN-001

## Typ artefaktu
operator_run_starter_brief

## Datum přípravy
2026-03-28

## Status
PREPARED

---

## Cíl
Provést první skutečný end-to-end operator run pro commercial layer.

Tento run ověřuje, že celý GPT stack funguje jako operační vrstva — nikoliv jako pilotní testovací prostředí.

---

## Vstupní podmínky

- [x] Pilot chain PILOT-001–010 uzavřena, všechny `status: PASS`, `decision.outcome: approved_as_baseline`
- [x] Builder convention hardening brief potvrzen
- [x] `SYSTEM_OS_MASTER.full.md` a `SYSTEM_OS_MASTER.builder.md` přítomny
- [x] `POSITIONING_POLICE.full.md` a `POSITIONING_POLICE.builder.md` přítomny
- [ ] Reálný offer input připraven operátorem
- [ ] Run zahájen

---

## Flow

```
SYSTEM_OS_MASTER
    └─> POSITIONING_POLICE
```

### Krok 1 — SYSTEM_OS_MASTER
- Spustit `SYSTEM_OS_MASTER` v ChatGPT builderu
- Předat reálný offer input (nabídka, produkt nebo klient brief)
- Nechat SYSTEM_OS_MASTER orchestrovat první downstream krok
- Zachytit celý výstup

### Krok 2 — POSITIONING_POLICE
- Předat output z SYSTEM_OS_MASTER do `POSITIONING_POLICE`
- Nechat POSITIONING_POLICE provést positioning audit
- Zachytit: Truth Source Block, Drift Audit, Vocabulary Policy, Minimal Fix List, Regression Checklist
- Ověřit, že nedošlo ke scope leaku mimo audit roli

---

## Artefakty, které vzniknou

| Soubor | Popis |
|--------|-------|
| `OPRUN-001_operator_run_trace.md` | Záznam průběhu runu — vstupy, výstupy, pozorování |
| `OPRUN-001_operator_run_review.md` | Review výstupů — konzistence, scope discipline, quality bar |
| `OPRUN-001_operator_run_decision.md` | Výsledné rozhodnutí — passed / blocked / rerun_required + next step |

Všechny soubory patří do: `operations/evidence/operator-runs/`

---

## Evidence checklist (vyplní operátor po runu)

- [ ] Offer input zaznamenán v trace
- [ ] SYSTEM_OS_MASTER výstup zachycen
- [ ] POSITIONING_POLICE výstup zachycen
- [ ] Role discipline ověřena (bez scope leaku)
- [ ] Verdict zapsán v decision file
- [ ] Next logical step identifikován

---

## Co tento run NENÍ

- Není to pilotní test (piloty jsou uzavřeny)
- Není to prompt rewrite
- Není to governance redesign
- Není to dashboarding nebo orchestrace

---

## Scope — explicitně out-of-scope pro OPRUN-001

- dashboard layer
- backend změny
- prompt rewrite
- evidence pro nové piloty
- jakékoliv repo-wide změny

---

## Next logical step po OPRUN-001

1. Zapsat `OPRUN-001_operator_run_trace.md`
2. Zapsat `OPRUN-001_operator_run_review.md`
3. Zapsat `OPRUN-001_operator_run_decision.md`
4. Teprve pak řešit dashboard / operating layer
