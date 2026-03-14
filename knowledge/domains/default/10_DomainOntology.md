# Doménová Ontologie — Výchozí Doména (Default Domain Ontology)

## Účel

Tento dokument definuje ontologii výchozí domény systému `gpts-decision-stack`.
Ontologie popisuje klíčové entity, jejich typy, vztahy a pravidla platná
pro výchozí doménu (default domain). Tento soubor je ADAPTIVE a může být
přizpůsoben per deployment.

## Typy žadatelů (Requestor Types)

Systém rozlišuje čtyři základní typy žadatelů:

### founder-led

Zakladatelem vedený projekt nebo startup. Governance je zjednodušená,
procurement a legal lanes nejsou povinné.

- Přímé rozhodování bez enterprise procurement.
- Zjednodušený approval chain.
- Vyšší tolerance pro iterativní přístup.
- Výchozí review lanes: `claims_review`
- Enterprise lanes: nejsou povinné
- Regulovaný kontext: ne

### enterprise

Enterprise organizace s formálním procurement procesem.
Procurement a legal lanes jsou povinné.

- Formální procurement proces.
- Legal review je povinný.
- Risk governance je rozšířená.
- Výchozí review lanes: `procurement_review`, `legal_review`, `claims_review`
- Enterprise lanes: povinné
- Regulovaný kontext: ne (výchozí)

### regulated

Regulovaný kontext (finanční, zdravotní, právní sektor).
Manuální schválení před release je povinné.

- Povinné manuální schválení před release.
- Rozšířená audit trail.
- Compliance lanes jsou povinné.
- Výchozí review lanes: `compliance_review`, `legal_review`, `risk_review`
- Enterprise lanes: povinné
- Regulovaný kontext: ano
- Manuální schválení: povinné

### enablement

Interní enablement nebo ne-prodejní projekt.
Komerční packaging lane může být vynechána pokud to policy dovoluje.

- Není primárně komerční.
- Komerční lane může být bypassed per policy.
- Interní governance je dostatečná.
- Výchozí review lanes: `claims_review`
- Enterprise lanes: nejsou povinné
- Komerční lane bypass eligible: ano

## Klíčové vztahy entity

| Entita | Typ | Vztah k requestor_type |
|---|---|---|
| ProblemBrief | artifact | nese requestor_type |
| FramingAssessment | artifact | vyhodnocuje buyer_fit vůči requestor_type |
| OfferDecision | artifact | vybírá primitiv odpovídající requestor_type |
| ReviewTopologyPlan | artifact | aktivuje lanes dle requestor_type |

## Pravidla domény

- Requestor type musí být explicitně stanoven v ProblemBrief.
- UNKNOWN requestor type blokuje přechod z intake.
- Enterprise a regulated requestor types aktivují povinné review lanes.
- Doménová ontologie je ADAPTIVE — nové requestor_types lze přidat per deployment.
- Rozšíření domény nesmí oslabovat governance pravidla INVARIANT vrstvy.
