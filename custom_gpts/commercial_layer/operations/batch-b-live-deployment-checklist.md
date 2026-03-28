# Batch B — Live Deployment Checklist

## Účel

Tento soubor definuje manuální deployment postup pro Batch B commercial GPT rolí do prostředí ChatGPT Builder. Slouží jako operátorský deployment checklist, ne jako canonical source role.

## Rozsah

**Batch B zahrnuje tyto role (v pořadí nasazení):**

1. ASSET_ENGINE — Outreach & Copy Factory
2. REWRITE_ENGINE — High-Conversion Rewriter
3. SUGGESTION_ENGINE — Conversion Diagnostics
4. MARKET_SCOUT_OUTBOUND — Offer/ICP/Channel Finder (Web)

## Reference files

| Soubor | Účel |
|--------|------|
| `custom_gpts/commercial_layer/deployment/builder-deployment-sheet.yaml` | Kanonická deployment konfigurace |
| `custom_gpts/commercial_layer/builder_convention_hardening_brief.md` | Governance baseline pro canonical source, naming a artifact separation |
| `custom_gpts/commercial_layer/builder_compact/ASSET_ENGINE.builder.md` | Instructions pro Builder |
| `custom_gpts/commercial_layer/builder_compact/REWRITE_ENGINE.builder.md` | Instructions pro Builder |
| `custom_gpts/commercial_layer/builder_compact/SUGGESTION_ENGINE.builder.md` | Instructions pro Builder |
| `custom_gpts/commercial_layer/builder_compact/MARKET_SCOUT_OUTBOUND.builder.md` | Instructions pro Builder |

Canonical source pro význam role, hard rules a scope zůstává v odpovídajícím
`prompt_sources/*.full.md` souboru.

---

## Builder nastavení per role

### Role 1: ASSET_ENGINE

| Pole | Hodnota |
|------|---------|
| **Name** | ASSET_ENGINE — Outreach & Copy Factory |
| **Description** | Vytváří revenue assety z definované nabídky: DM opener, follow-up, post, email, one-screen page. Jeden CTA, proof-safe language, zachovává positioning terms. |
| **Instructions source** | `builder_compact/ASSET_ENGINE.builder.md` (celý obsah sekce `## Instructions`) |
| **Web** | OFF |
| **Memory** | OFF |
| **Knowledge** | OFF |
| **Capabilities** | _(vše vypnuto)_ |

---

### Role 2: REWRITE_ENGINE

| Pole | Hodnota |
|------|---------|
| **Name** | REWRITE_ENGINE — High-Conversion Rewriter |
| **Description** | Přepisuje konkrétní asset pro vyšší konverzi. Zachovává intent, odstraňuje fluff, zpřesňuje CTA. Žádný offer redesign. |
| **Instructions source** | `builder_compact/REWRITE_ENGINE.builder.md` (celý obsah sekce `## Instructions`) |
| **Web** | OFF |
| **Memory** | OFF |
| **Knowledge** | OFF |
| **Capabilities** | _(vše vypnuto)_ |

---

### Role 3: SUGGESTION_ENGINE

| Pole | Hodnota |
|------|---------|
| **Name** | SUGGESTION_ENGINE — Conversion Diagnostics |
| **Description** | Diagnostikuje tření v assetu nebo offeru bez přepisování. Ranked friction points, strongest node, weakest node, 3 testovatelné změny. |
| **Instructions source** | `builder_compact/SUGGESTION_ENGINE.builder.md` (celý obsah sekce `## Instructions`) |
| **Web** | OFF |
| **Memory** | OFF |
| **Knowledge** | OFF |
| **Capabilities** | _(vše vypnuto)_ |

---

### Role 4: MARKET_SCOUT_OUTBOUND

| Pole | Hodnota |
|------|---------|
| **Name** | MARKET_SCOUT_OUTBOUND — Offer/ICP/Channel Finder (Web) |
| **Description** | Web-based research role. Hledá reálné nabídky, pricing, ICP signály, outbound channel patterny. Výstup: source-cited outbound-first plán s jedním ICP, jedním offerem, 14-day validací. |
| **Instructions source** | `builder_compact/MARKET_SCOUT_OUTBOUND.builder.md` (celý obsah sekce `## Instructions`) |
| **Web** | ON |
| **Memory** | OFF |
| **Knowledge** | OFF |
| **Capabilities** | Web Search ON, ostatní vypnuto |

---

## Pořadí nasazení

Nasazovat přesně v tomto pořadí. Každou roli verifikovat před přechodem na další.

```
1. ASSET_ENGINE
2. REWRITE_ENGINE
3. SUGGESTION_ENGINE
4. MARKET_SCOUT_OUTBOUND
```

Důvod: ASSET_ENGINE závisí na výstupech STRUCTURAL_ENGINE a POSITIONING_POLICE z Batch A. REWRITE_ENGINE závisí na existujících assetech z ASSET_ENGINE. SUGGESTION_ENGINE závisí na výstupech ASSET_ENGINE a POSITIONING_POLICE. MARKET_SCOUT_OUTBOUND je nezávislá Web ON research role a nasazuje se jako poslední, aby bylo možné ověřit Web behavior izolovaně.

---

## Manuální paste checklist

Pro každou roli:

- [ ] Otevřít ChatGPT Builder → Create a GPT
- [ ] Přepnout na záložku **Configure**
- [ ] Vyplnit pole **Name** (viz tabulka výše)
- [ ] Vyplnit pole **Description** (viz tabulka výše)
- [ ] Zkopírovat celý obsah sekce `## Instructions` z příslušného `.builder.md` souboru
- [ ] Vložit do pole **Instructions**
- [ ] Zkontrolovat nastavení **Web Search** dle tabulky (ON pouze pro MARKET_SCOUT_OUTBOUND)
- [ ] Zkontrolovat, že **DALL-E Image Generation** je `OFF`
- [ ] Zkontrolovat, že **Code Interpreter** je `OFF`
- [ ] Zkontrolovat, že **Memory** je `OFF`
- [ ] Kliknout **Save** → **Only me** (pro první test run)
- [ ] Zkopírovat GPT URL pro smoke test

---

## Post-deploy smoke checks

Spustit po nasazení každé role:

### ASSET_ENGINE smoke check

Vstup:
```
ICP: Head of Sales, B2B SaaS, 50–200 zaměstnanců.
offer: 6 týdnů LinkedIn coaching, výstup: 3 sjednané schůzky za 6 týdnů.
CTA: Book a 15-min call.
```

Očekávané chování:
- Produkuje Core Message, Assets, CTA, Testing Variables
- Přesně jeden CTA v celém výstupu
- Proof-safe language (žádná vymyšlená čísla)
- Positioning terms ze vstupu jsou zachovány
- Assets jsou jasně labeled (DM opener, follow-up, post)

Selže pokud:
- Výstup obsahuje více než jeden CTA
- GPT vymyšluje metriky nebo loga bez podkladu
- Assets nejsou labeled nebo chybí channel
- SELF-CHECK sekce chybí

---

### REWRITE_ENGINE smoke check

Vstup:
```
asset_text: "Ahoj, pomáhám obchodním manažerům generovat víc schůzek přes LinkedIn. Chcete se dozvědět víc? Klikněte na odkaz níže a zarezervujte si hovor."
ICP: Head of Sales, B2B SaaS.
CTA: Book a 15-min call.
```

Očekávané chování:
- Produkuje Revised Version, What Changed, Why It Converts Better
- Zachovává intent původního textu
- CTA je zpřesněno, ne odstraněno
- Žádný offer redesign ani nová strategie
- Proof language je bezpečné

Selže pokud:
- Výstup je kompletní nový offer nebo strategie
- Intent původního textu je ztracen
- Vymyšlená čísla nebo proof bez podkladu
- SELF-CHECK sekce chybí

---

### SUGGESTION_ENGINE smoke check

Vstup:
```
asset_text: "Ahoj, pomáhám obchodním manažerům generovat víc schůzek přes LinkedIn. Chcete se dozvědět víc? Klikněte na odkaz níže a zarezervujte si hovor."
ICP: Head of Sales, B2B SaaS, 50–200 zaměstnanců.
CTA: Book a 15-min call.
```

Očekávané chování:
- Produkuje Friction Points (seřazené), ICP Drift Signals, Strongest Node, Weakest Node, 3 Targeted Improvements
- Žádný přepisování textu
- Friction points jsou ranked a specifické
- Improvements jsou testovatelné

Selže pokud:
- GPT přepíše text místo diagnostiky
- Friction points nejsou ranked
- Improvements jsou vágní bez "how to test"
- SELF-CHECK sekce chybí

---

### MARKET_SCOUT_OUTBOUND smoke check

Vstup:
```
market_topic: LinkedIn outreach coaching pro B2B obchodní manažery, Evropa.
```

Očekávané chování:
- Použije web research (Web ON)
- Produkuje Research Snapshot, Market Offer Map, ICP Recommendation, Offer Recommendation, Outbound Channel Plan, 14-Day Execution Plan, Validation Metrics, Sources
- Všechna tvrzení jsou citována
- Preferuje primární zdroje (firemní weby, pricing pages)
- Jeden best ICP doporučen
- Žádná nekitovaná pricing tvrzení

Selže pokud:
- Web nebyl použit (výstup neobsahuje Sources sekci)
- Pricing claims jsou bez zdroje
- ICP doporučení chybí nebo jsou doporučeny více než 2 ICPs
- SELF-CHECK sekce chybí

---

## Fail conditions (všechny role)

- Role řeší úkol namísto svého designovaného scope
- Výstup v angličtině (expected: Czech prose + English technical identifiers)
- Chybí SELF-CHECK sekce nebo self-check není pokryt
- Role překračuje svůj scope do sousední role
- ASSET_ENGINE nebo REWRITE_ENGINE nebo SUGGESTION_ENGINE používají Web (pouze MARKET_SCOUT_OUTBOUND má Web ON)
- MARKET_SCOUT_OUTBOUND produkuje output bez citovaných zdrojů

---

## Sign-off block

| Pole | Hodnota |
|------|---------|
| **Batch** | B |
| **Role count** | 4 |
| **Deployment date** | [TBD] |
| **Deployer** | [TBD] |
| **Smoke check ASSET_ENGINE** | [ ] PASS / [ ] FAIL |
| **Smoke check REWRITE_ENGINE** | [ ] PASS / [ ] FAIL |
| **Smoke check SUGGESTION_ENGINE** | [ ] PASS / [ ] FAIL |
| **Smoke check MARKET_SCOUT_OUTBOUND** | [ ] PASS / [ ] FAIL |
| **Batch B deployment status** | [ ] COMPLETE / [ ] BLOCKED |
| **Notes** | [TBD] |
| **Ready for Batch C** | [ ] YES / [ ] NO |
