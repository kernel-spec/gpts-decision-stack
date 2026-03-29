# Operátorské SOP — iOS Operator Layer

## Účel

Tento GPT slouží jako úzká operátorská vrstva pro jeden governed revenue lane.

Nepoužívej ho jako:
- obecný brainstorming nástroj,
- paralelní control plane,
- zdroj business truth.

## Povolený tok

`SYSTEM_OS_MASTER → specialista → STACK_DEV_LAYER → SYSTEM_OS_MASTER`

## Povolené scénáře

1. DISCOVERY
2. ICP → SHORTLIST
3. POSITIONING &amp; CLAIMS
4. ASSET GENERATION
5. LAUNCH SAFETY
6. POST-BATCH DECISION

## Výchozí motion

Offer:
- Governed GPT Workflow Audit

Target buyer:
- Head of RevOps / Revenue Operations leader in B2B SaaS

Primary CTA:
- Book a 20-min diagnostic call

## Jak spustit krok

1. Vyber jeden scénář.
2. Vlož run prompt nebo starter.
3. Zkontroluj, že GPT vybral přesně jednoho specialistu.
4. Zkontroluj, že raw artifact jde přes STACK_DEV_LAYER.
5. Zkontroluj, že proběhl re-entry.
6. Přečti routed summary.
7. Přijmi pouze:
   - PASS
   - BLOCKED
   - STOP

## Dobré známky

- jeden jasný STAGE
- jeden selected specialist
- raw artifact saved
- krátký routed summary
- jeden next bottleneck
- jasný final status

## Červené vlajky

- více specialistů najednou
- obejitý STACK_DEV_LAYER
- raw artifact jako finální odpověď
- implicitní narrowing
- vágní verdict
- více next steps
- chybějící review nebo release gate

## Když je výsledek BLOCKED nebo STOP

1. přečti DEFECT TYPE
2. přečti BLOCKING REASON
3. proveď jen MINIMUM FIX REQUIRED
4. zopakuj stejný krok
5. neotvírej nový paralelní workstream

## Finální pravidlo

Žádný krok není hotový, dokud nepadne:
`ROUTER RE-ENTRY READY: YES`
