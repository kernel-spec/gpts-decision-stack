# MASTER_SPEC: GPTs Decision Stack

## Přehled

GPTs Decision Stack je architektura s důrazem na správu pro nasazování vlastních GPT s explicitní rozhodovací pravomocí, řízením stavů a auditními záznamy.

## Architektonické principy

1. **Kontrolní rovina na prvním místě**: Všechny GPT pracují pod explicitními omezeními správy
2. **Invariance stavů**: Základní rozhodovací stavy jsou neměnné a kanonické
3. **Audit od návrhu**: Každé rozhodnutí je zaznamenáno s plným kontextem
4. **Adaptivní domény**: Pravidla specifická pro doménu se mohou přizpůsobit, zatímco jádro zůstává neměnné
5. **Žádná konverze na workflow**: Toto je model rozhodování, nikoliv engine pro workflow

## Základní komponenty

### Vrstva znalostí

Vrstva znalostí poskytuje kanonickou pravdu pro:

- **Základní znalosti** (`/knowledge/core/`): Neměnná pravidla kontrolní roviny
  - Charta a definice pravomocí
  - Kanonické stavy a přechody
  - Schémata artefaktů a validační pravidla
  - Sémantika selhání a cesty obnovy
  - Struktura záznamu rozhodnutí

- **Doménové znalosti** (`/knowledge/domains/default/`): Adaptivní pravidla domény
  - Ontologie a koncepty domény
  - Pravidla rámování pro chování GPT
  - Katalogy primitiv a operací
  - Omezení topologie dodání
  - Spouštěče rizik a compliance
  - Pravidla komerčního balení
  - Politiky důkazů pro tvrzení
  - Směrování kontrolních řad
  - Matice eskalace schvalování

### Brány nasazení

Progresivní nasazení přes čtyři prostředí:

1. **Local**: Strukturální validace a kontroly úplnosti
2. **Dev**: Integrační testování s backendovými službami
3. **Staging**: Plná realita správy s akceptačním testováním
4. **Prod**: Autorizované produkční nasazení

### Model správy

- **Mapy vlastnictví**: Definují, kdo vlastní které komponenty
- **Mapy schvalování**: Definují workflow schvalování
- **Mapy veta**: Definují pravomoc provozního veta
- **Kontroler vydání**: Blokování vydání mimo model

## Struktura souborů

```
/
├── MASTER_SPEC.md                    # Tento soubor
├── repo.manifest.yaml                # Inventář souborů a reference
├── README.md                         # Přehled repozitáře
├── bootstrap_checklists_pack.sh      # Generování provozních checklistů
├── bootstrap_knowledge_pack.sh       # Generování souborů znalostí
├── knowledge/
│   ├── core/                         # Neměnné základní znalosti
│   │   ├── 00_ControlPlane_Charter.md
│   │   ├── 01_CanonicalStates.yaml
│   │   ├── 02_TransitionRules.yaml
│   │   ├── 03_ArtifactSchemas.yaml
│   │   ├── 04_AuthorityMatrix.yaml
│   │   ├── 05_FailureSemantics.yaml
│   │   └── 06_DecisionLogSchema.yaml
│   └── domains/
│       └── default/                  # Adaptivní doménové znalosti
│           ├── 10_DomainOntology.md
│           ├── 11_FramingRules.yaml
│           ├── 12_PrimitiveCatalog.yaml
│           ├── 13_DeliveryTopologyRules.yaml
│           ├── 14_RiskComplianceTriggers.yaml
│           ├── 15_CommercialPackagingRules.yaml
│           ├── 16_ClaimsEvidencePolicy.yaml
│           ├── 17_ReviewLaneRules.yaml
│           └── 18_ApprovalEscalationMatrix.yaml
├── prompts/                          # Sady instrukcí GPT (budoucí)
├── schemas/                          # Validační schémata (budoucí)
├── tests/
│   ├── acceptance/                   # Definice akceptačních testů (budoucí)
│   └── fixtures/                     # Testovací fixtury (budoucí)
└── operations/
    ├── checklists/                   # Checklisty připravenosti prostředí
    └── gates/                        # Pravidla bran propagace
```

## Model stavového automatu

Systém funguje jako stavový automat, NIKOLIV workflow:

- **Stavy jsou kanonické**: Definovány jednou, nikdy nezměněny
- **Přechody jsou explicitní**: Všechny cesty jsou definovány předem
- **Rozhodnutí spouštějí přechody**: GPT neexekuují; rozhodují
- **Audit je povinný**: Každý přechod je zaznamenán

## Připravenost k nasazení

Nasazení do staging/prod je BLOKOVÁNO, pokud:

- Kterýkoli soubor znalostí nemá obsah
- Kterákoli testovací fixtura chybí nebo je prázdná
- QA artefakty jsou neúplné
- Mapy vlastnictví/schvalování/veta nejsou schváleny

Aktuální stav: Soubory znalostí jsou vytvářeny v této fázi.

## Verze

Verze specifikace: 1.0.0
Poslední aktualizace: 2026-03-14
