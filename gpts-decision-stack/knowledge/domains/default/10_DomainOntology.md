# Doménová Ontologie - Výchozí Doména

**Status**: ADAPTIVE
**Version**: 1.0.0

## Účel

Tato ontologie definuje doménové koncepty, terminologii a vztahy pro výchozí doménu. Doménové ontologie jsou ADAPTIVE a mohou být přizpůsobeny podle kontextu nasazení.

## Základní Koncepty

### Artifact

Diskrétní jednotka práce nebo dodávka předložená k hodnocení a potenciálnímu uvolnění.

**Vlastnosti**:
- Jedinečný identifikátor
- Klasifikace typu
- Identita předkladatele
- Časové razítko vytvoření
- Cílové prostředí

**Typy**:
- `PACKAGE_RELEASE`: Vydání softwarového balíčku nebo knihovny
- `CONFIGURATION_CHANGE`: Úprava systémové konfigurace
- `POLICY_UPDATE`: Změna zásad správy nebo provozu
- `KNOWLEDGE_UPDATE`: Aktualizace znalostní báze nebo dokumentace

### Claim

Tvrzení o vlastnostech, kvalitě nebo stavu souladu artefaktu.

**Vlastnosti**:
- Prohlášení tvrzení
- Požadavky na důkazy
- Stav ověření
- Autorita ověření

**Příklady**:
- "Všechny jednotkové testy prošly"
- "Bezpečnostní sken nezjistil žádné kritické zranitelnosti"
- "Dokumentace je úplná a přesná"
- "Vyhovuje regulačním požadavkům"

### Evidence

Podpůrný materiál, který validuje nebo vyvrací tvrzení.

**Typy**:
- `TEST_RESULTS`: Výsledky automatizovaného spuštění testů
- `DOCUMENTATION`: Technická nebo uživatelská dokumentace
- `CERTIFICATION`: Certifikace nebo osvědčení třetích stran
- `AUDIT_REPORT`: Zjištění interního nebo externího auditu
- `REVIEW_FINDINGS`: Závěry odborné kontroly

**Vlastnosti**:
- Typ důkazu
- Odkaz na obsah (URI/cesta)
- Stav ověření
- Identita ověřovatele

### Decision

Rozhodnutí učiněné autorizovaným GPT nebo autoritou ohledně postupu artefaktu.

**Komponenty**:
- Tvůrce rozhodnutí
- Odůvodnění rozhodnutí
- Pokus o přechod stavu
- Ověření autority
- Záznam do auditu

### Review Lane

Klasifikační mechanismus pro směrování artefaktů k příslušným kontrolním autoritám.

**Kategorie** (ADAPTIVE):
- `TECHNICAL`: Technická správnost a kvalita
- `SECURITY`: Posouzení bezpečnosti a zranitelností
- `COMPLIANCE`: Soulad s regulacemi a zásadami
- `BUSINESS`: Obchodní hodnota a priorita
- `OPERATIONAL`: Provozní připravenost a dopad

### Approval Workflow

Sekvence kroků schválení požadovaných před uvolněním artefaktu.

**Fáze** (ADAPTIVE):
- Technické schválení
- Bezpečnostní schválení
- Obchodní schválení
- Výkonné schválení (pro změny s vysokým dopadem)

## Vztahy

```
Artifact
  ├─ hasType → ArtifactType
  ├─ submittedBy → Submitter
  ├─ makes → Claims
  │   └─ supportedBy → Evidence
  ├─ routedTo → ReviewLane
  ├─ requires → ApprovalWorkflow
  └─ progressesThrough → States

Decision
  ├─ madeBy → Authority
  ├─ affects → Artifact
  ├─ causes → StateTransition
  └─ recordedIn → DecisionLog
```

## Doménově Specifická Pravidla (ADAPTIVE)

Tato pravidla mohou být přizpůsobena podle nasazení:

### Požadavky na Tvrzení

- `PACKAGE_RELEASE` vyžaduje:
  - Tvrzení o testovacím pokrytí s důkazy výsledků testů
  - Tvrzení o bezpečnostním skenu s důkazy výsledků skenu
  - Tvrzení o dokumentaci s dokumentačními artefakty
  - Tvrzení o kritických změnách s analýzou dopadu

- `CONFIGURATION_CHANGE` vyžaduje:
  - Tvrzení o validaci s důkazy validačních testů
  - Tvrzení o plánu návratu s důkazy postupu návratu
  - Tvrzení o posouzení dopadu s důkazy analýzy dopadu

- `POLICY_UPDATE` vyžaduje:
  - Tvrzení o právní kontrole s důkazy právní kontroly
  - Tvrzení o schválení zúčastněných stran s důkazy záznamů schválení

### Přiřazení Review Lane

Přiřazení je založeno na:
1. Typ artefaktu
2. Cílové prostředí
3. Odhadovaný dopad
4. Požadavky na soulad

### Spouštěče Eskalace

Automatická eskalace nastává když:
- Artefakty s vysokou nebo kritickou prioritou
- Odhadován významný nebo hlavní dopad
- Cíleno produkční prostředí
- Identifikovány obavy ohledně souladu

## Terminologie

### Doménově Specifické Termíny (ADAPTIVE)

- **Intake**: Počáteční hodnocení předloženého artefaktu
- **Claims Verification**: Proces validace tvrzení oproti důkazům
- **Review Lane**: Klasifikace pro směrování k příslušným kontrolorům
- **Governance Approval**: Formální schválení správní autoritou
- **Operational Veto**: Blokování vydání provozní autoritou
- **Release Controller**: Autorita, která provádí schválená vydání

### Invariantní Termíny (z Jádra)

Tyto termíny mají pevné významy ze základních znalostí:

- **State**: Kanonický stav ve stavovém automatu
- **Transition**: Přesun mezi stavy
- **Authority**: Rozhodovací pravomoc
- **Audit Trail**: Neměnný protokol rozhodnutí
- **Terminal State**: Stav bez odchozích přechodů

## Body Rozšíření

Domény mohou rozšířit tuto ontologii o:

- Dodatečné typy artefaktů
- Vlastní kategorie tvrzení
- Doménově specifické typy důkazů
- Specializované kontrolní linie
- Vlastní schvalovací workflow
- Doménově specifickou terminologii

Rozšíření nesmí:

- Být v rozporu se základními invarianty
- Oslabovat požadavky na správu
- Obcházet požadavky na audit
- Kompromitovat model autority

## Historie Verzí

- 1.0.0 (2026-03-14): Počáteční výchozí doménová ontologie
