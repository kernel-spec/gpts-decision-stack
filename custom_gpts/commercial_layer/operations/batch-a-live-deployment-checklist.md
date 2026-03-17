# Batch A — Live Deployment Checklist

## Účel

Tento soubor definuje manuální deployment postup pro Batch A commercial GPT rolí do prostředí ChatGPT Builder. Slouží jako single-source-of-truth pro operátora při prvním nasazení a verifikaci.

## Rozsah

**Batch A zahrnuje tyto role (v pořadí nasazení):**

1. SYSTEM_OS_MASTER — Revenue Orchestrator
2. STRUCTURAL_ENGINE — Offer & System Builder
3. PRICING_PACKAGER — Pricing & Packaging
4. POSITIONING_POLICE — Positioning Consistency

## Reference files

| Soubor | Účel |
|--------|------|
| `custom_gpts/commercial_layer/deployment/builder-deployment-sheet.yaml` | Kanonická deployment konfigurace |
| `custom_gpts/commercial_layer/builder_compact/SYSTEM_OS_MASTER.builder.md` | Instructions pro Builder |
| `custom_gpts/commercial_layer/builder_compact/STRUCTURAL_ENGINE.builder.md` | Instructions pro Builder |
| `custom_gpts/commercial_layer/builder_compact/PRICING_PACKAGER.builder.md` | Instructions pro Builder |
| `custom_gpts/commercial_layer/builder_compact/POSITIONING_POLICE.builder.md` | Instructions pro Builder |

---

## Builder nastavení per role

### Role 1: SYSTEM_OS_MASTER

| Pole | Hodnota |
|------|---------|
| **Name** | SYSTEM_OS_MASTER — Revenue Orchestrator |
| **Description** | Deterministický router-only orchestrátor pro Top 10 commercial layer. Vybere přesně jeden NEXT_GPT a vrátí strict copy-paste pack. |
| **Instructions source** | `builder_compact/SYSTEM_OS_MASTER.builder.md` (celý obsah sekce `## Instructions`) |
| **Web** | OFF |
| **Memory** | OFF |
| **Knowledge** | OFF |
| **Capabilities** | _(vše vypnuto)_ |

---

### Role 2: STRUCTURAL_ENGINE

| Pole | Hodnota |
|------|---------|
| **Name** | STRUCTURAL_ENGINE — Offer & System Builder |
| **Description** | Převádí vágní nápad do monetizovatelného systému: ICP, output contract, scope lock, measurable outcome, kill criteria. |
| **Instructions source** | `builder_compact/STRUCTURAL_ENGINE.builder.md` (celý obsah sekce `## Instructions`) |
| **Web** | OFF |
| **Memory** | OFF |
| **Knowledge** | OFF |
| **Capabilities** | _(vše vypnuto)_ |

---

### Role 3: PRICING_PACKAGER

| Pole | Hodnota |
|------|---------|
| **Name** | PRICING_PACKAGER — Pricing & Packaging |
| **Description** | Navrhuje pricing logiku, tier strukturu a value ladder pro definovaný offer. Scope lock per tier, entry offer, raise-price triggers. Žádné invented benchmarks. |
| **Instructions source** | `builder_compact/PRICING_PACKAGER.builder.md` (celý obsah sekce `## Instructions`) |
| **Web** | OFF |
| **Memory** | OFF |
| **Knowledge** | OFF |
| **Capabilities** | _(vše vypnuto)_ |

---

### Role 4: POSITIONING_POLICE

| Pole | Hodnota |
|------|---------|
| **Name** | POSITIONING_POLICE — Positioning Consistency |
| **Description** | Audituje konzistenci mezi offerem, assety a call skriptem. Detekuje ICP drift, claim drift, vocabulary drift. Výstup: truth source, minimal fix list, regression checklist. Nepřepisuje vše. |
| **Instructions source** | `builder_compact/POSITIONING_POLICE.builder.md` (celý obsah sekce `## Instructions`) |
| **Web** | OFF |
| **Memory** | OFF |
| **Knowledge** | OFF |
| **Capabilities** | _(vše vypnuto)_ |

---

## Pořadí nasazení

Nasazovat přesně v tomto pořadí. Každou roli verifikovat před přechodem na další.

```
1. SYSTEM_OS_MASTER
2. STRUCTURAL_ENGINE
3. PRICING_PACKAGER
4. POSITIONING_POLICE
```

Důvod: STRUCTURAL_ENGINE závisí na SYSTEM_OS_MASTER pro routing. PRICING_PACKAGER závisí na STRUCTURAL_ENGINE output contract. POSITIONING_POLICE závisí na STRUCTURAL_ENGINE + PRICING_PACKAGER artifacts.

---

## Manuální paste checklist

Pro každou roli:

- [ ] Otevřít ChatGPT Builder → Create a GPT
- [ ] Přepnout na záložku **Configure**
- [ ] Vyplnit pole **Name** (viz tabulka výše)
- [ ] Vyplnit pole **Description** (viz tabulka výše)
- [ ] Zkopírovat celý obsah sekce `## Instructions` z příslušného `.builder.md` souboru
- [ ] Vložit do pole **Instructions**
- [ ] Zkontrolovat, že **Web Search** je `OFF`
- [ ] Zkontrolovat, že **DALL-E Image Generation** je `OFF`
- [ ] Zkontrolovat, že **Code Interpreter** je `OFF`
- [ ] Kliknout **Save** → **Only me** (pro první test run)
- [ ] Zkopírovat GPT URL pro smoke test

---

## Post-deploy smoke checks

Spustit po nasazení každé role:

### SYSTEM_OS_MASTER smoke check

Vstup: `"Chci začít vydělávat jako konzultant, ale nevím jak."`

Očekávané chování:
- Vrátí přesně jeden NEXT_GPT
- NEXT_GPT = `STRUCTURAL_ENGINE`
- Žádné přímé řešení nebo strategie
- Výstup ve formátu: routing sentence + fenced code block

Selže pokud:
- GPT začne rovnou radit
- GPT vrátí více než jeden NEXT_GPT
- Výstup neobsahuje fenced code block s `NEXT_GPT:`

---

### STRUCTURAL_ENGINE smoke check

Vstup: `"Chci nabízet LinkedIn coaching pro B2B manažery."`

Očekávané chování:
- Ptá se na ICP nebo rovnou produkuje strukturu
- Výstup obsahuje: Problem Definition, ICP Definition, Output Contract, Scope Lock
- Žádný copywriting výstup

Selže pokud:
- Výstup je obecný motivační text
- Chybí Output Contract nebo Scope Lock
- Jsou uvedeny Kill Criteria jako "[TBD]" bez varování

---

### PRICING_PACKAGER smoke check

Vstup: `"Mám offer: 6 týdnů LinkedIn coaching pro senior manažery, 2 session týdně, výstup: 3 sjednané schůzky za 6 týdnů. ICP: Head of Sales, 50–200 zaměstnanců."`

Očekávané chování:
- Produkuje Pricing Strategy, Package Structure, Value Ladder
- Výstup obsahuje Entry Offer
- Žádné invented market benchmarks
- Raise-Price Triggers jsou přítomny

Selže pokud:
- Jsou použita vymyšlená srovnávací čísla bez podkladu
- Chybí Entry Offer nebo Raise-Price Triggers
- Výstup je obecná pricing teorie bez scope locku

---

### POSITIONING_POLICE smoke check

Vstup: `"Tady je offer page a DM sequenci: [krátký fiktivní text]. ICP: Head of Sales. CTA: Book a 15-min call."`

Očekávané chování:
- Produkuje Truth Source Block
- Drift Audit s konkrétními problémy (nebo potvrzení konzistence)
- Minimal Fix List
- Regression Checklist

Selže pokud:
- GPT přepíše celý text místo minimal fix listu
- Chybí Truth Source Block
- Drift Audit je vágní bez konkrétních artifact referencí

---

## Fail conditions (všechny role)

- Role řeší úkol namísto svého designovaného scope
- Role vrací obsah v angličtině (expected: Czech prose + English technical identifiers)
- Output chybí SELF-CHECK sekce nebo self-check není pokryt
- Role překračuje svůj scope do sousední role

---

## Sign-off block

| Pole | Hodnota |
|------|---------|
| **Batch** | A |
| **Role count** | 4 |
| **Deployment date** | [TBD] |
| **Deployer** | [TBD] |
| **Smoke check SYSTEM_OS_MASTER** | [ ] PASS / [ ] FAIL |
| **Smoke check STRUCTURAL_ENGINE** | [ ] PASS / [ ] FAIL |
| **Smoke check PRICING_PACKAGER** | [ ] PASS / [ ] FAIL |
| **Smoke check POSITIONING_POLICE** | [ ] PASS / [ ] FAIL |
| **Batch A deployment status** | [ ] COMPLETE / [ ] BLOCKED |
| **Notes** | [TBD] |
| **Ready for Batch B** | [ ] YES / [ ] NO |
