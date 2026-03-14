# MASTER_SPEC — gpts-decision-stack

## Přehled

`gpts-decision-stack` je rozhodovací systém řízený kontrolní rovinou (control plane), který strukturuje komplexní komerční a governance rozhodnutí prostřednictvím sekvence specializovaných GPT agentů.

Systém se skládá ze dvou vrstev:

- **Řídicí rovina (Control Plane):** neměnné agenty (INVARIANT), kteří řídí orchestraci, audit smluv, přechody stavů a uvolnění.
- **Adaptivní enginy (Adaptive Engines):** přizpůsobitelné agenty (ADAPTIVE), kteří zpracovávají konkrétní kroky rozhodovacího potrubí.

---

## Architektura systému

### Řídicí rovina

| Identifikátor        | Role                                              | Výstupní artefakt       |
|----------------------|---------------------------------------------------|-------------------------|
| CP-Governor          | Orchestrátor celého pipeline                      | StateDecisionPacket     |
| CP-ContractAuditor   | Audit claimů vůči evidenci                        | ClaimsDecision (audit)  |
| CP-TransitionJudge   | Validace přechodů mezi stavy                      | TransitionDecision      |
| CP-ReleaseArbiter    | Finální gate před uvolněním                       | ReleaseDecision         |

Agenti řídicí roviny jsou INVARIANT. Jejich logika nesmí být měněna bez explicitní revize governance.

### Adaptivní enginy

| Identifikátor        | Stav pipeline                  | Výstupní artefakt         |
|----------------------|-------------------------------|---------------------------|
| AE-Intake            | intake                         | ProblemBrief              |
| AE-Framing           | problem_framing                | FramingAssessment         |
| AE-Primitive         | primitive_selection            | OfferDecision             |
| AE-Architecture      | architecture_validation        | ArchitectureSpec          |
| AE-Claims            | claims_validation              | ClaimsDecision            |
| AE-RiskGov           | risk_governance_validation     | RiskDecision              |
| AE-Commercial        | commercial_packaging           | CommercialSpec            |
| AE-ReviewRouter      | (přesměrování review)          | ReviewTopologyPlan        |

---

## Pipeline — stavy a pořadí

Rozhodovací pipeline prochází těmito stavy v uvedeném pořadí, s možností explicitního zpětného vstupu (re-entry):

```
intake
  → problem_framing
    → primitive_selection
      → architecture_validation
        → claims_validation
          → risk_governance_validation
            → commercial_packaging
              → release_decision
```

Zpětný vstup musí být vždy explicitně zaznamenán. Tichý zpětný vstup není povolen.

---

## Artefakty

Každý agent vrací právě jeden artefakt. Kanonické názvy artefaktů jsou:

| Artefakt               | Vlastník            |
|------------------------|---------------------|
| ProblemBrief           | AE-Intake           |
| FramingAssessment      | AE-Framing          |
| OfferDecision          | AE-Primitive        |
| ArchitectureSpec       | AE-Architecture     |
| ClaimsDecision         | AE-Claims / CP-ContractAuditor |
| RiskDecision           | AE-RiskGov          |
| CommercialSpec         | AE-Commercial       |
| ReviewTopologyPlan     | AE-ReviewRouter     |
| StateDecisionPacket    | CP-Governor         |

Schémata artefaktů jsou uložena v `/schemas/artifacts/`.

---

## Pravidla pro rozhodování

### Statusy rozhodnutí

Povolené hodnoty pro `decision_status`:

- `proceed` — vstupní kritéria jsou splněna, pipeline může pokračovat
- `revise` — vstupní kritéria nejsou splněna, vyžadována oprava
- `invalidate` — artefakt nebo framing je neplatný, nutný zpětný vstup
- `escalate` — rozhodnutí vyžaduje vyšší autoritu
- `stop` — tvrdá blokace, pipeline nesmí pokračovat
- `unresolved` — rozhodnutí nelze učinit bez dalšího vstupu
- `blocked` — pipeline je zablokován externím veto nebo chybějícím artefaktem

### UNKNOWN disciplína

Pokud je jakákoli povinná hodnota, stakeholder, artefakt nebo evidence v inputu nepřítomna:

- Zaznamenat explicitně jako `UNKNOWN`.
- Nezjišťovat, nedomýšlet ani nedoplňovat chybějící hodnoty.
- Neumožnit pipeline pokračovat za stav, který závisí na chybějících povinných vstupech.

`UNKNOWN` je explicitní, platná hodnota — není chybou.

### Fail semantiky

Falešný `proceed` je kritické selhání.

Pokud vstupní artefakt nesplňuje vstupní kritéria cílového stavu, musí agent vrátit `revise`, `invalidate`, `escalate` nebo `blocked` — nikoli `proceed`.

Výstup `stop` nebo `escalate` nesmí být převeden na `proceed`.

---

## Governance a veta

### Aktivní veto

Aktivní operační veto je absolutní blokací. Nelze jej obejít žádným jiným artefaktem ani rozhodnutím.

Veto lze zrušit pouze explicitním artefaktem `veto_release` od autority veta.

Pokud `veto_active: true`, musí CP-ReleaseArbiter vrátit `release_status: blocked`.

### Regulovaný kontext

V regulovaném kontextu musí být přítomno explicitní manuální schválení před přechodem do stavu `release_decision`.

Pokud `manual_approval_required: true` a schválení chybí, musí CP-TransitionJudge vrátit `transition_status: escalate`.

### Gates pro deployment

Podrobná pravidla pro gates jsou definována v `/operations/gates/promotion-gate.yaml`.

Staging a produkce jsou blokovány, dokud nejsou splněny:
- úplnost knowledge souborů
- úplnost fixture souborů
- QA artefakt
- mapa vlastníků, schválení a veta

---

## Znalostní vrstva (Knowledge Layer)

Knowledge soubory jsou uloženy v `/knowledge/`.

Rozdělení:

- **Core (INVARIANT):** `knowledge/core/` — soubory 00–06, definují pravidla řídicí roviny
- **Domain (ADAPTIVE):** `knowledge/domains/default/` — soubory 10–18, přizpůsobitelné per deployment

---

## Fixture vrstva

Acceptance fixtures jsou uloženy v `/tests/fixtures/` a jsou organizovány podle domény:

- `founder-led/`
- `enterprise/`
- `regulated/`
- `enablement/`

Každý fixture soubor má typ `acceptance_fixture` a je propojen s acceptance testy přes `linked_acceptance_tests`.

---

## Výstupní formát agentů

Každý agent vrací pouze svůj vlastní artefakt ve strukturovaném formátu. Komentáře v přirozeném jazyce nejsou přípustné.

Šablona:

```yaml
<ArtifactName>:
  artifact_type: <ArtifactName>
  decision_status: <status>
  blocking_issues: []
  version: <semver>
```

---

## Soubory v repozitáři

| Cesta                              | Obsah                                       |
|------------------------------------|---------------------------------------------|
| `/MASTER_SPEC.md`                  | Tento dokument                              |
| `/repo.manifest.yaml`              | Kanonický manifest repozitáře               |
| `/README.md`                       | Přehled projektu                            |
| `/prompts/core/`                   | Systémové prompty řídicí roviny             |
| `/prompts/adaptive/`               | Systémové prompty adaptivních enginů        |
| `/schemas/artifacts/`              | Schémata artefaktů                          |
| `/knowledge/core/`                 | INVARIANT knowledge soubory (00–06)         |
| `/knowledge/domains/default/`      | ADAPTIVE knowledge soubory (10–18)          |
| `/operations/checklists/`          | Operační checklisty (local/dev/staging/prod)|
| `/operations/gates/`               | Pravidla pro promotion gates                |
| `/tests/fixtures/`                 | Acceptance fixtures organizované dle domény |
