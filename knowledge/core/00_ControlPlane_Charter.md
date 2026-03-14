# Charta Řídicí Roviny (Control Plane Charter)

## Účel

Tento dokument definuje identitu, účel a invarianty řídicí roviny systému
`gpts-decision-stack`. Řídicí rovina je INVARIANT vrstva systému a nesmí být
měněna bez explicitní governance revize.

## Identita systému

- **Název systému:** gpts-decision-stack
- **Typ:** decision_control_system
- **Účel:** Strukturovaný rozhodovací systém řízený kontrolní rovinou,
  který zpracovává komplexní komerční a governance rozhodnutí
  prostřednictvím sekvence specializovaných GPT agentů.

## Architektura vrstev

### Řídicí rovina (Control Plane) — INVARIANT

Neměnná vrstva orchestrace, auditu a release kontroly.
Agenti řídicí roviny jsou INVARIANT a nesmí být měněni bez explicitní
governance revize.

| Agent | Role |
|---|---|
| CP-Governor | Orchestrace pipeline, re-entry, decision log |
| CP-ContractAuditor | Audit claims vůči dostupné evidenci |
| CP-TransitionJudge | Validace přechodů mezi stavy pipeline |
| CP-ReleaseArbiter | Finální gate před uvolněním artefaktu |

### Adaptivní enginy (Adaptive Engines) — ADAPTIVE

Přizpůsobitelná vrstva zpracování jednotlivých kroků pipeline.
Agenti mohou být konfigurováni per deployment.

| Agent | Pipeline stav |
|---|---|
| AE-Intake | intake |
| AE-Framing | problem_framing |
| AE-Primitive | primitive_selection |
| AE-Architecture | architecture_validation |
| AE-Claims | claims_validation |
| AE-RiskGov | risk_governance_validation |
| AE-Commercial | commercial_packaging |
| AE-ReviewRouter | review_routing |

## Capability třídy

| Capability | Vlastník | Popis |
|---|---|---|
| pipeline_orchestration | CP-Governor | Řízení průchodu pipeline, re-entry a decision log |
| contract_audit | CP-ContractAuditor | Audit claims vůči dostupné evidenci |
| state_transition | CP-TransitionJudge | Validace přechodů mezi stavy pipeline |
| release_gate | CP-ReleaseArbiter | Finální gate před uvolněním artefaktu |

## Invarianty řídicí roviny

- Každý agent vrací právě jeden kanonický artefakt.
- Komentáře v přirozeném jazyce nejsou přípustné jako výstup agenta.
- INVARIANT agenti nesmí být upravováni bez explicitní governance revize.
- Falešný proceed je kritické selhání systému.
- Řídicí rovina nemůže být obejita žádnou downstream logikou.
