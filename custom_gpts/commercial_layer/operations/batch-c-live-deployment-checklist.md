# Batch C — Live Deployment Checklist

## Účel

Tento soubor definuje manuální deployment postup pro Batch C commercial GPT rolí do prostředí ChatGPT Builder. Slouží jako operátorský deployment checklist, ne jako canonical source role.

## Rozsah

**Batch C zahrnuje tyto role (v pořadí nasazení):**

1. CALL_CLOSER — Discovery & Close System
2. DELIVERY_SOP_ENGINE — Delivery SOP & Templates

## Reference files

| Soubor | Účel |
|--------|------|
| `custom_gpts/commercial_layer/deployment/builder-deployment-sheet.yaml` | Kanonická deployment konfigurace |
| `custom_gpts/commercial_layer/builder_convention_hardening_brief.md` | Governance baseline pro canonical source, naming a artifact separation |
| `custom_gpts/commercial_layer/builder_compact/CALL_CLOSER.builder.md` | Instructions pro Builder |
| `custom_gpts/commercial_layer/builder_compact/DELIVERY_SOP_ENGINE.builder.md` | Instructions pro Builder |

Canonical source pro význam role, hard rules a scope zůstává v odpovídajícím
`prompt_sources/*.full.md` souboru.

---

## Builder nastavení per role

### Role 1: CALL_CLOSER

| Pole | Hodnota |
|------|---------|
| **Name** | CALL_CLOSER — Discovery & Close System |
| **Description** | Navrhuje opakovatelný discovery-to-close systém: agenda, kvalifikační gates, otázky, value framing, pricing talk track, closing, follow-up. Jeden next step. Bez pressure tactics. |
| **Instructions source** | `builder_compact/CALL_CLOSER.builder.md` (celý obsah sekce `## Instructions`) |
| **Web** | OFF |
| **Memory** | OFF |
| **Knowledge** | OFF |
| **Capabilities** | _(vše vypnuto)_ |

---

### Role 2: DELIVERY_SOP_ENGINE

| Pole | Hodnota |
|------|---------|
| **Name** | DELIVERY_SOP_ENGINE — Delivery SOP & Templates |
| **Description** | Převádí definovaný offer do standardizované delivery vrstvy: onboarding, interní checklist, client touchpoints, šablony, QA, acceptance criteria, scope enforcement, definition of done. |
| **Instructions source** | `builder_compact/DELIVERY_SOP_ENGINE.builder.md` (celý obsah sekce `## Instructions`) |
| **Web** | OFF |
| **Memory** | OFF |
| **Knowledge** | OFF |
| **Capabilities** | _(vše vypnuto)_ |

---

## Pořadí nasazení

Nasazovat přesně v tomto pořadí. Každou roli verifikovat před přechodem na další.

```
1. CALL_CLOSER
2. DELIVERY_SOP_ENGINE
```

Důvod: CALL_CLOSER validuje sales-conversion a qualification discipline jako první. DELIVERY_SOP_ENGINE validuje post-sale delivery-system discipline jako druhý — závisí na výstupním output contractu a scope locku, které jsou definovány dříve v procesu (STRUCTURAL_ENGINE) a doplněny CALL_CLOSER close systémem.

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
- [ ] Zkontrolovat, že **Memory** je `OFF`
- [ ] Kliknout **Save** → **Only me** (pro první test run)
- [ ] Zkopírovat GPT URL pro smoke test

---

## Post-deploy smoke checks

Spustit po nasazení každé role:

### CALL_CLOSER smoke check

Vstup:
```
ICP: Head of Sales, B2B SaaS, 50–200 zaměstnanců.
offer: 6 týdnů LinkedIn coaching, výstup: 3 sjednané schůzky za 6 týdnů.
CTA: Book a paid audit call.
```

Očekávané chování:
- Produkuje Call Objective + přesně jeden One Next Step
- Qualification Gates jsou explicitně přítomny (must-have criteria, red flags, disqualify if)
- Žádné pressure tactics, manipulativní language nebo garantované výsledky
- Výstup neobsahuje více než jeden CTA
- Follow-up Email Template je přítomen a okamžitě použitelný
- Discovery-to-close flow zůstává v rámci role scope (nenavrhuje offer design ani pricing)

Selže pokud:
- Výstup obsahuje více než jeden next step nebo více CTA
- Qualification Gates chybí nebo jsou vágní bez disqualify logiky
- Jsou použita pressure tactics nebo manipulativní formulace
- GPT garantuje výsledky bez [TBD proof]
- Follow-up šablona chybí nebo není strukturovaná
- Role překračuje scope do STRUCTURAL_ENGINE nebo PRICING_PACKAGER

---

### DELIVERY_SOP_ENGINE smoke check

Vstup:
```
output_contract: 6 týdnů LinkedIn coaching, 2 session/týden, výstup: 3 sjednané schůzky.
scope_lock: bez strategie, bez copywritingu, bez redesignu offeru.
ICP: Head of Sales, B2B SaaS, 50–200 zaměstnanců.
```

Očekávané chování:
- Produkuje Onboarding Intake s required client inputs a kickoff questions
- Interní Checklist je přítomen s kroky, ownery a done conditions
- QA & Acceptance Criteria jsou přítomny a navázány na output contract
- Scope Enforcement obsahuje included/excluded boundary language a reakci na out-of-scope požadavky
- Role nenavrhuje offer design, nepřidává deliverables mimo scope, neexekvuje delivery sama
- Výstup je checklist-first: struktury a šablony, ne přímé provádění delivery

Selže pokud:
- Onboarding Intake chybí nebo neobsahuje required client inputs
- Interní Checklist chybí nebo postrádá done conditions
- QA / Acceptance Criteria chybí nebo nejsou navázány na output contract
- Scope Enforcement chybí nebo je vágní
- GPT přidává deliverables mimo deklarovaný scope
- Role simuluje nebo provádí delivery místo návrhu systému

---

## Fail conditions (všechny role)

- Role řeší úkol namísto svého designovaného scope
- Výstup v angličtině (expected: Czech prose + English technical identifiers)
- Chybí SELF-CHECK sekce nebo self-check není pokryt
- Role překračuje svůj scope do sousední role
- CALL_CLOSER používá pressure tactics nebo garantuje výsledky bez proof
- DELIVERY_SOP_ENGINE přidává deliverables mimo scope nebo simuluje výkon delivery

---

## Sign-off block

| Pole | Hodnota |
|------|---------|
| **Batch** | C |
| **Role count** | 2 |
| **Deployment date** | [TBD] |
| **Deployer** | [TBD] |
| **Smoke check CALL_CLOSER** | [ ] PASS / [ ] FAIL |
| **Smoke check DELIVERY_SOP_ENGINE** | [ ] PASS / [ ] FAIL |
| **Batch C deployment status** | [ ] COMPLETE / [ ] BLOCKED |
| **Notes** | [TBD] |
| **Top 10 rollout complete** | [ ] YES / [ ] NO |
