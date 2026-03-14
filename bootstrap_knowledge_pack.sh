#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-gpts-decision-stack}"

mkdir -p \
  "$ROOT/knowledge/core" \
  "$ROOT/knowledge/domains/default"

cat > "$ROOT/knowledge/core/00_ControlPlane_Charter.md" <<'EOF'
# Charta řídicí roviny

## Účel

Tato charta definuje model řízení pro GPTs Decision Stack. Všechny vlastní GPT operují pod explicitní autoritou řídicí roviny.

## Základní principy

### 1. Autorita rozhodování, nikoli provádění

GPT **rozhodují**, co by se mělo stát. Neprovádějí akce přímo. Každé rozhodnutí je:

- Explicitní a zaznamenané
- Předmětem omezení řízení
- Auditovatelné s plným kontextem
- Reverzibilní prostřednictvím definovaných cest

### 2. Model stavového automatu

Systém funguje jako stavový automat:

- **Stavy** jsou kanonické a invariantní
- **Přechody** jsou explicitní a definované
- **Rozhodnutí** spouštějí přechody stavů
- **Pracovní postupy** NEJSOU modelem

### 3. Audit záměrem

Každé rozhodnutí produkuje:

- Časové razítko rozhodnutí
- Rozhodující subjekt (identifikátor GPT)
- Vstupní kontext a artefakty
- Výstup rozhodnutí a odůvodnění
- Pokus o přechod stavu
- Výsledek autorizace

### 4. Řízení na prvním místě

Všechny operace podléhají:

- Kontrolám matice autorit
- Schvalovacím pracovním postupům (kde je to vyžadováno)
- Operačnímu vetu (kde je to autorizováno)
- Kontrole vydání (mimo model)

## Rozsah řídicí roviny

Řídicí rovina spravuje:

1. **Autorita stavů**: Jaké stavy existují a kdo může mezi nimi přecházet
2. **Autorita rozhodování**: Které GPT mohou dělat jaká rozhodnutí
3. **Autorita auditu**: Co musí být zaznamenáno a jak
4. **Autorita řízení**: Kdo může schvalovat, vetovat nebo blokovat

## Role GPT

### CP-Governor

**Autorita**: Řízení řídicí roviny a správa stavů

**Odpovědnosti**:
- Validovat přechody stavů
- Prosazovat omezení autorit
- Udržovat log rozhodnutí
- Hlásit porušení řízení

**Nemůže**: Provádět obchodní operace, obcházet audit, oslabovat řízení

### AE-Intake

**Autorita**: Vyhodnocení artefaktu a rozhodnutí o příjmu

**Odpovědnosti**:
- Vyhodnocovat předložené artefakty
- Rozhodovat o přijetí příjmu
- Označovat problémy s dodržováním předpisů
- Směrovat do příslušných kontrolních linek

**Nemůže**: Schvalovat konečná vydání, obcházet požadavky na důkazy

### AE-Claims

**Autorita**: Ověřování tvrzení proti důkazům

**Odpovědnosti**:
- Ověřovat tvrzení proti poskytnutým důkazům
- Rozhodovat o dostatečnosti důkazů
- Eskalovat, když jsou důkazy nedostatečné
- Dokumentovat odůvodnění ověření

**Nemůže**: Přijímat tvrzení bez důkazů, obcházet požadavky na kontrolu

## Invariantní pravidla

Tato pravidla **NEMOHOU** být změněna doménovou adaptací:

1. Všechna rozhodnutí musí být zaznamenána
2. Přechody stavů vyžadují autoritu
3. Auditní stopy jsou neměnné
4. Kontroly řízení jsou povinné
5. Základní stavy jsou kanonické

## Doménová adaptace

Domény **MOHOU** adaptovat:

- Specifické definice stavů v rámci kanonického rámce
- Pravidla směrování kontrolních linek
- Cesty eskalace schvalování
- Omezení komerčního balení
- Prahové hodnoty tolerance rizika

Domény **NEMOHOU** adaptovat:

- Základní model rozhodování
- Požadavky na audit
- Prosazování autorit
- Invarianty stavového automatu

## Verze

Verze charty: 1.0.0
Status: INVARIANT
Poslední aktualizace: 2026-03-14
EOF

cat > "$ROOT/knowledge/core/01_CanonicalStates.yaml" <<'EOF'
# Kanonické stavy
# Status: INVARIANT
# Tyto stavy tvoří kanonický stavový automat pro všechny artefakty

canonical_states:
  initial:
    - name: UNSUBMITTED
      description: Artefakt ještě nebyl odeslán do systému
      entry_authority: NONE
      exit_authority: ANY_SUBMITTER
  
  intake:
    - name: SUBMITTED
      description: Artefakt odeslán a čeká na vyhodnocení příjmu
      entry_authority: ANY_SUBMITTER
      exit_authority: AE-Intake
    
    - name: INTAKE_REJECTED
      description: Artefakt zamítnut při vyhodnocení příjmu
      entry_authority: AE-Intake
      exit_authority: NONE
      terminal: true
    
    - name: INTAKE_ACCEPTED
      description: Artefakt přijat pro další zpracování
      entry_authority: AE-Intake
      exit_authority: AE-Claims
  
  verification:
    - name: CLAIMS_VERIFICATION
      description: Tvrzení jsou ověřována proti důkazům
      entry_authority: AE-Claims
      exit_authority: AE-Claims
    
    - name: CLAIMS_INSUFFICIENT
      description: Tvrzení postrádají dostatečné důkazy
      entry_authority: AE-Claims
      exit_authority: AE-Intake
    
    - name: CLAIMS_VERIFIED
      description: Tvrzení ověřena s dostatečnými důkazy
      entry_authority: AE-Claims
      exit_authority: CP-Governor
  
  review:
    - name: REVIEW_REQUIRED
      description: Artefakt vyžaduje kontrolu před schválením
      entry_authority: CP-Governor
      exit_authority: REVIEW_AUTHORITY
    
    - name: REVIEW_IN_PROGRESS
      description: Kontrola aktivně probíhá
      entry_authority: REVIEW_AUTHORITY
      exit_authority: REVIEW_AUTHORITY
    
    - name: REVIEW_REJECTED
      description: Kontrola zamítla artefakt
      entry_authority: REVIEW_AUTHORITY
      exit_authority: NONE
      terminal: true
    
    - name: REVIEW_APPROVED
      description: Kontrola schválila artefakt
      entry_authority: REVIEW_AUTHORITY
      exit_authority: CP-Governor
  
  governance:
    - name: APPROVAL_REQUIRED
      description: Vyžadováno schválení řízení
      entry_authority: CP-Governor
      exit_authority: APPROVAL_AUTHORITY
    
    - name: APPROVAL_IN_PROGRESS
      description: Schvalovací pracovní postup probíhá
      entry_authority: APPROVAL_AUTHORITY
      exit_authority: APPROVAL_AUTHORITY
    
    - name: APPROVAL_REJECTED
      description: Schválení řízení zamítnuto
      entry_authority: APPROVAL_AUTHORITY
      exit_authority: NONE
      terminal: true
    
    - name: APPROVAL_GRANTED
      description: Schválení řízení uděleno
      entry_authority: APPROVAL_AUTHORITY
      exit_authority: CP-Governor
  
  release:
    - name: RELEASE_READY
      description: Artefakt připraven k vydání
      entry_authority: CP-Governor
      exit_authority: RELEASE_CONTROLLER
    
    - name: RELEASE_BLOCKED
      description: Vydání blokováno operačním vetem nebo kontrolorem
      entry_authority: RELEASE_CONTROLLER
      exit_authority: RELEASE_CONTROLLER
    
    - name: RELEASED
      description: Artefakt úspěšně vydán
      entry_authority: RELEASE_CONTROLLER
      exit_authority: NONE
      terminal: true

state_categories:
  intake_states:
    - UNSUBMITTED
    - SUBMITTED
    - INTAKE_REJECTED
    - INTAKE_ACCEPTED
  
  verification_states:
    - CLAIMS_VERIFICATION
    - CLAIMS_INSUFFICIENT
    - CLAIMS_VERIFIED
  
  review_states:
    - REVIEW_REQUIRED
    - REVIEW_IN_PROGRESS
    - REVIEW_REJECTED
    - REVIEW_APPROVED
  
  governance_states:
    - APPROVAL_REQUIRED
    - APPROVAL_IN_PROGRESS
    - APPROVAL_REJECTED
    - APPROVAL_GRANTED
  
  release_states:
    - RELEASE_READY
    - RELEASE_BLOCKED
    - RELEASED
  
  terminal_states:
    - INTAKE_REJECTED
    - REVIEW_REJECTED
    - APPROVAL_REJECTED
    - RELEASED

invariants:
  - Terminální stavy nemohou přejít do žádného jiného stavu
  - Všechny přechody stavů musí být autorizovány
  - Historie stavů je neměnná
  - Zpětné přechody vyžadují explicitní pravidla
EOF

cat > "$ROOT/knowledge/core/02_TransitionRules.yaml" <<'EOF'
# Pravidla přechodu stavů
# Status: INVARIANT
# Definuje všechny povolené přechody stavů a podmínky

transition_rules:
  # Počáteční odeslání
  - from: UNSUBMITTED
    to: SUBMITTED
    authority: ANY_SUBMITTER
    conditions:
      - artifact_provided
      - artifact_metadata_complete
    validation:
      - artifact_schema_valid
  
  # Vyhodnocení příjmu
  - from: SUBMITTED
    to: INTAKE_REJECTED
    authority: AE-Intake
    conditions:
      - intake_evaluation_complete
      - intake_decision_is_reject
    effects:
      - log_rejection_reason
      - notify_submitter
  
  - from: SUBMITTED
    to: INTAKE_ACCEPTED
    authority: AE-Intake
    conditions:
      - intake_evaluation_complete
      - intake_decision_is_accept
    effects:
      - assign_tracking_id
      - route_to_claims_verification
  
  # Ověření tvrzení
  - from: INTAKE_ACCEPTED
    to: CLAIMS_VERIFICATION
    authority: AE-Claims
    conditions:
      - claims_identified
      - evidence_requirements_defined
    effects:
      - create_claims_checklist
  
  - from: CLAIMS_VERIFICATION
    to: CLAIMS_INSUFFICIENT
    authority: AE-Claims
    conditions:
      - claims_evaluation_complete
      - evidence_insufficient
    effects:
      - document_gaps
      - notify_submitter
  
  - from: CLAIMS_VERIFICATION
    to: CLAIMS_VERIFIED
    authority: AE-Claims
    conditions:
      - claims_evaluation_complete
      - evidence_sufficient
      - all_claims_supported
    effects:
      - finalize_verification_report
  
  # Opětovné odeslání po nedostatečných tvrzeních
  - from: CLAIMS_INSUFFICIENT
    to: SUBMITTED
    authority: ANY_SUBMITTER
    conditions:
      - additional_evidence_provided
      - resubmission_requested
    effects:
      - reset_intake_evaluation
  
  # Směrování ke kontrole
  - from: CLAIMS_VERIFIED
    to: REVIEW_REQUIRED
    authority: CP-Governor
    conditions:
      - review_required_by_policy
    effects:
      - assign_review_lane
      - notify_reviewers
  
  - from: CLAIMS_VERIFIED
    to: APPROVAL_REQUIRED
    authority: CP-Governor
    conditions:
      - review_not_required_by_policy
    effects:
      - route_to_approval_workflow
  
  # Proces kontroly
  - from: REVIEW_REQUIRED
    to: REVIEW_IN_PROGRESS
    authority: REVIEW_AUTHORITY
    conditions:
      - reviewer_assigned
      - review_started
  
  - from: REVIEW_IN_PROGRESS
    to: REVIEW_REJECTED
    authority: REVIEW_AUTHORITY
    conditions:
      - review_complete
      - review_decision_is_reject
    effects:
      - log_review_findings
      - notify_stakeholders
  
  - from: REVIEW_IN_PROGRESS
    to: REVIEW_APPROVED
    authority: REVIEW_AUTHORITY
    conditions:
      - review_complete
      - review_decision_is_approve
    effects:
      - finalize_review_report
      - route_to_governance
  
  # Schválení řízení
  - from: REVIEW_APPROVED
    to: APPROVAL_REQUIRED
    authority: CP-Governor
    conditions:
      - approval_workflow_required
  
  - from: APPROVAL_REQUIRED
    to: APPROVAL_IN_PROGRESS
    authority: APPROVAL_AUTHORITY
    conditions:
      - approvers_notified
      - approval_workflow_started
  
  - from: APPROVAL_IN_PROGRESS
    to: APPROVAL_REJECTED
    authority: APPROVAL_AUTHORITY
    conditions:
      - approval_decision_complete
      - approval_decision_is_reject
    effects:
      - log_rejection_rationale
      - notify_all_parties
  
  - from: APPROVAL_IN_PROGRESS
    to: APPROVAL_GRANTED
    authority: APPROVAL_AUTHORITY
    conditions:
      - approval_decision_complete
      - approval_decision_is_approve
      - all_required_approvers_approved
    effects:
      - finalize_approval_record
      - route_to_release_prep
  
  # Příprava vydání a kontrola
  - from: APPROVAL_GRANTED
    to: RELEASE_READY
    authority: CP-Governor
    conditions:
      - all_governance_complete
      - release_artifacts_prepared
      - deployment_plan_ready
  
  - from: RELEASE_READY
    to: RELEASE_BLOCKED
    authority: RELEASE_CONTROLLER
    conditions:
      any_of:
        - operational_veto_active
        - release_block_triggered
    effects:
      - log_block_reason
      - notify_release_coordinator
  
  - from: RELEASE_BLOCKED
    to: RELEASE_READY
    authority: RELEASE_CONTROLLER
    conditions:
      - block_reason_resolved
      - veto_cleared
  
  - from: RELEASE_READY
    to: RELEASED
    authority: RELEASE_CONTROLLER
    conditions:
      - no_active_blocks
      - deployment_authorized
      - deployment_successful
    effects:
      - finalize_release_record
      - notify_all_stakeholders
      - archive_decision_trail

invariant_rules:
  - Všechny přechody vyžadují kontrolu autority
  - Všechny přechody musí být zaznamenány
  - Terminální stavy nemohou přecházet
  - Zpětné přechody vyžadují explicitní definici
  - Autorita nemůže být obejita
EOF

cat > "$ROOT/knowledge/core/03_ArtifactSchemas.yaml" <<'EOF'
# Schémata artefaktů
# Status: INVARIANT
# Validační schémata pro artefakty zpracovávané prostřednictvím rozhodovacího stacku

artifact_types:
  submission:
    schema:
      artifact_id:
        type: string
        required: true
        pattern: "^[A-Z]{3}-[0-9]{6}$"
        description: Jedinečný identifikátor artefaktu
      
      submitter:
        type: object
        required: true
        properties:
          name:
            type: string
            required: true
          email:
            type: string
            required: true
            format: email
          organization:
            type: string
            required: false
      
      submission_timestamp:
        type: string
        required: true
        format: iso8601
      
      artifact_type:
        type: string
        required: true
        enum:
          - PACKAGE_RELEASE
          - CONFIGURATION_CHANGE
          - POLICY_UPDATE
          - KNOWLEDGE_UPDATE
      
      artifact_payload:
        type: object
        required: true
        description: Obsah artefaktu specifický pro typ
      
      claims:
        type: array
        required: true
        items:
          type: object
          properties:
            claim_id:
              type: string
              required: true
            claim_statement:
              type: string
              required: true
            evidence_references:
              type: array
              items:
                type: string
      
      metadata:
        type: object
        required: true
        properties:
          priority:
            type: string
            enum: [LOW, MEDIUM, HIGH, CRITICAL]
          target_environment:
            type: string
            enum: [DEV, STAGING, PROD]
          estimated_impact:
            type: string
            enum: [MINIMAL, MODERATE, SIGNIFICANT, MAJOR]
  
  decision_record:
    schema:
      decision_id:
        type: string
        required: true
        pattern: "^DEC-[0-9]{8}$"
      
      artifact_id:
        type: string
        required: true
      
      decision_maker:
        type: string
        required: true
        enum:
          - CP-Governor
          - AE-Intake
          - AE-Claims
          - REVIEW_AUTHORITY
          - APPROVAL_AUTHORITY
          - RELEASE_CONTROLLER
      
      decision_timestamp:
        type: string
        required: true
        format: iso8601
      
      state_transition:
        type: object
        required: true
        properties:
          from_state:
            type: string
            required: true
          to_state:
            type: string
            required: true
          transition_valid:
            type: boolean
            required: true
      
      decision_rationale:
        type: string
        required: true
        min_length: 10
      
      supporting_evidence:
        type: array
        required: false
        items:
          type: string
      
      authority_check:
        type: object
        required: true
        properties:
          authorized:
            type: boolean
            required: true
          authority_source:
            type: string
            required: true
  
  evidence:
    schema:
      evidence_id:
        type: string
        required: true
      
      evidence_type:
        type: string
        required: true
        enum:
          - TEST_RESULTS
          - DOCUMENTATION
          - CERTIFICATION
          - AUDIT_REPORT
          - REVIEW_FINDINGS
          - APPROVAL_RECORD
      
      content_reference:
        type: string
        required: true
        description: URI nebo cesta k obsahu důkazu
      
      verification_status:
        type: string
        required: true
        enum:
          - UNVERIFIED
          - VERIFIED
          - REJECTED
      
      verified_by:
        type: string
        required: false
      
      verification_timestamp:
        type: string
        required: false
        format: iso8601

validation_rules:
  artifact_submission:
    - Všechna povinná pole musí být přítomna
    - ID artefaktu musí být jedinečné
    - Musí být poskytnuto alespoň jedno tvrzení
    - Všechna tvrzení musí odkazovat na důkazy
  
  decision_record:
    - ID rozhodnutí musí být jedinečné
    - Přechod stavu musí být platný podle TransitionRules
    - Kontrola autority musí projít
    - Odůvodnění musí být podstatné
  
  evidence:
    - Důkazy musí být dostupné
    - Ověření musí být sledovatelné
    - Typ důkazu se musí shodovat s typem tvrzení

schema_version: "1.0.0"
status: INVARIANT
EOF

cat > "$ROOT/knowledge/core/04_AuthorityMatrix.yaml" <<'EOF'
# Matice autorit
# Status: INVARIANT
# Definuje rozhodovací autoritu pro každý GPT a roli

authorities:
  gpt_roles:
    CP-Governor:
      authority_level: CONTROL_PLANE
      can_decide:
        - validate_state_transitions
        - enforce_governance_constraints
        - route_to_review
        - route_to_approval
        - route_to_release
        - maintain_decision_log
        - report_violations
      
      cannot_decide:
        - intake_artifact_evaluation
        - claims_verification
        - review_approval
        - governance_approval
        - release_execution
      
      decision_scope:
        - Všechny přechody stavů vyžadující validaci řízení
        - Prosazování autorit
        - Rozhodnutí o směrování
      
      audit_requirement: MANDATORY
    
    AE-Intake:
      authority_level: INTAKE
      can_decide:
        - evaluate_artifact_submission
        - accept_or_reject_intake
        - route_to_claims_verification
        - flag_compliance_issues
      
      cannot_decide:
        - verify_claims
        - approve_releases
        - bypass_evidence_requirements
        - override_governance
      
      decision_scope:
        - Počáteční vyhodnocení artefaktu
        - Rozhodnutí o přijetí příjmu
        - Základní označování dodržování předpisů
      
      audit_requirement: MANDATORY
    
    AE-Claims:
      authority_level: VERIFICATION
      can_decide:
        - verify_claims_against_evidence
        - determine_evidence_sufficiency
        - escalate_insufficient_evidence
        - document_verification_rationale
      
      cannot_decide:
        - accept_claims_without_evidence
        - bypass_review_requirements
        - grant_final_approval
        - execute_releases
      
      decision_scope:
        - Ověřování tvrzení
        - Dostatečnost důkazů
        - Eskalace ověření
      
      audit_requirement: MANDATORY
    
    REVIEW_AUTHORITY:
      authority_level: REVIEW
      can_decide:
        - conduct_technical_review
        - approve_or_reject_review
        - request_additional_information
        - escalate_to_governance
      
      cannot_decide:
        - bypass_approval_requirements
        - execute_releases
        - override_veto
      
      decision_scope:
        - Rozhodnutí technické kontroly
        - Schválení/zamítnutí kontroly
        - Eskalace k řízení
      
      audit_requirement: MANDATORY
    
    APPROVAL_AUTHORITY:
      authority_level: GOVERNANCE
      can_decide:
        - grant_or_reject_governance_approval
        - require_additional_reviews
        - escalate_to_executive_authority
        - document_approval_conditions
      
      cannot_decide:
        - bypass_evidence_requirements
        - override_operational_veto
        - execute_releases_directly
      
      decision_scope:
        - Rozhodnutí o schválení řízení
        - Podmíněná schválení
        - Eskalace na výkonnou úroveň
      
      audit_requirement: MANDATORY
    
    RELEASE_CONTROLLER:
      authority_level: RELEASE
      can_decide:
        - authorize_release_execution
        - block_release_for_operational_reasons
        - clear_release_blocks
        - execute_authorized_releases
      
      cannot_decide:
        - bypass_governance_approval
        - override_approval_rejection
        - alter_decision_history
      
      decision_scope:
        - Autorizace vydání
        - Prosazování operačního veta
        - Provádění vydání
      
      audit_requirement: MANDATORY

authority_checks:
  required_for:
    - Všechny přechody stavů
    - Všechny záznamy rozhodnutí
    - Všechny akce řízení
  
  check_sequence:
    1. Ověřit identitu rozhodujícího subjektu
    2. Validovat úroveň autority pro typ rozhodnutí
    3. Zkontrolovat soulad rozsahu rozhodnutí
    4. Potvrdit žádné zakázané akce
    5. Zaznamenat výsledek kontroly autority
  
  failure_handling:
    - Okamžitě zamítnout rozhodnutí
    - Zaznamenat neoprávněný pokus
    - Informovat autoritu řízení
    - Neprovádět přechod stavu

escalation_paths:
  intake_escalation:
    from: AE-Intake
    to: AE-Claims
    conditions:
      - Příjem přijat
      - Vyžadováno ověření tvrzení
  
  claims_escalation:
    from: AE-Claims
    to: CP-Governor
    conditions:
      - Tvrzení ověřena
      - Vyžadována kontrola nebo schválení
  
  review_escalation:
    from: REVIEW_AUTHORITY
    to: APPROVAL_AUTHORITY
    conditions:
      - Kontrola schválena
      - Vyžadováno schválení řízení
  
  approval_escalation:
    from: APPROVAL_AUTHORITY
    to: EXECUTIVE_AUTHORITY
    conditions:
      - Standardní autorita schvalování nedostačující
      - Vyžadováno rozhodnutí výkonné úrovně
  
  operational_escalation:
    from: RELEASE_CONTROLLER
    to: APPROVAL_AUTHORITY
    conditions:
      - Vydání blokováno
      - Vyžadována kontrola blokace řízením

invariant_rules:
  - Autorita nemůže být delegována nebo převedena
  - Všechna rozhodnutí musí mít autoritu
  - Kontroly autorit jsou povinné a nemohou být obejity
  - Požadavky na audit jsou absolutní

matrix_version: "1.0.0"
status: INVARIANT
EOF

cat > "$ROOT/knowledge/core/05_FailureSemantics.yaml" <<'EOF'
# Sémantika selhání
# Status: INVARIANT
# Definuje, jak jsou selhání zpracována a obnovena

failure_categories:
  authorization_failure:
    severity: CRITICAL
    description: Rozhodující subjekt postrádá autoritu pro pokus o akci
    
    handling:
      immediate:
        - Okamžitě zamítnout rozhodnutí
        - Neprovádět přechod stavu
        - Zaznamenat neoprávněný pokus s plným kontextem
      
      notification:
        - Informovat autoritu řízení
        - Upozornit bezpečnostní monitorování
        - Zaznamenat v auditní stopě
      
      recovery:
        - Žádné automatické obnovení
        - Vyžadována kontrola řízením
        - Může vyžadovat eskalaci autority
    
    examples:
      - AE-Intake pokus o udělení konečného schválení
      - AE-Claims obcházení požadavků na důkazy
      - Jakýkoli GPT pokus o změnu historie rozhodnutí
  
  validation_failure:
    severity: HIGH
    description: Artefakt nebo rozhodnutí selže validaci schématu
    
    handling:
      immediate:
        - Zamítnout artefakt nebo rozhodnutí
        - Vrátit validační chyby
        - Nepokračovat s přechodem
      
      notification:
        - Informovat odesílatele se specifickými chybami
        - Zaznamenat selhání validace
      
      recovery:
        - Automatický opakovaný pokus povolen po opravě
        - Žádná eskalace není vyžadována pro jednoduché validační chyby
        - Eskalovat, pokud selhání validace přetrvávají
    
    examples:
      - Chybějící povinná metadata artefaktu
      - Neplatný požadavek na přechod stavu
      - Chybně formátovaný záznam rozhodnutí
  
  evidence_insufficient:
    severity: MEDIUM
    description: Tvrzení postrádají dostatečné podpůrné důkazy
    
    handling:
      immediate:
        - Přejít do stavu CLAIMS_INSUFFICIENT
        - Dokumentovat specifické mezery v důkazech
        - Zachovat artefakt pro opětovné odeslání
      
      notification:
        - Informovat odesílatele s analýzou mezer
        - Poskytnout pokyny k požadavkům na důkazy
      
      recovery:
        - Opětovné odeslání povoleno s dalšími důkazy
        - Žádná sankce za opětovné odeslání v dobré víře
        - Sledovat počet opětovných odeslání
    
    examples:
      - Chybějící výsledky testů
      - Neúplná dokumentace
      - Neposkytnutá certifikace
  
  governance_rejection:
    severity: MEDIUM
    description: Autorita kontroly nebo schvalování zamítá artefakt
    
    handling:
      immediate:
        - Přejít do příslušného stavu zamítnutí
        - Finalizovat záznam zamítnutí
        - Učinit stav terminálním
      
      notification:
        - Informovat všechny zúčastněné strany
        - Dokumentovat odůvodnění zamítnutí
        - Poskytnout zpětnou vazbu pro budoucí odeslání
      
      recovery:
        - Žádné automatické obnovení z terminálního zamítnutí
        - Vyžadováno nové odeslání pro opakování
        - Poučit se ze zpětné vazby k zamítnutí
    
    examples:
      - Kontrola identifikuje kritické problémy
      - Autorita schvalování odmítá schválení řízení
      - Selhání dodržování zásad
  
  operational_block:
    severity: MEDIUM
    description: Vydání blokováno operačním vetem nebo kontrolorem
    
    handling:
      immediate:
        - Přejít do stavu RELEASE_BLOCKED
        - Zachovat status připravenosti k vydání
        - Neprovádět vydání
      
      notification:
        - Informovat koordinátora vydání
        - Dokumentovat důvod blokace
        - Poskytnout očekávanou cestu k řešení
      
      recovery:
        - Automatické odblokování, když je důvod vyřešen
        - Návrat do stavu RELEASE_READY
        - Obnovit proces vydání
    
    examples:
      - Probíhá incident v produkci
      - Konflikt s údržbovým oknem
      - Omezení operační kapacity
  
  system_failure:
    severity: CRITICAL
    description: Selhání na úrovni systému zabraňující normální operaci
    
    handling:
      immediate:
        - Zastavit zpracování
        - Zachovat aktuální stav
        - Neztratit auditní stopu
      
      notification:
        - Upozornit správce systému
        - Zaznamenat detaily selhání
        - Spustit reakci na incident
      
      recovery:
        - Vyžadován manuální zásah
        - Obnovit ze zachovaného stavu
        - Ověřit integritu auditní stopy
    
    examples:
      - Selhání připojení k databázi
      - Korupce logu rozhodnutí
      - Služba autority nedostupná

recovery_principles:
  state_preservation:
    - Nikdy neztratit data artefaktu
    - Zachovat veškerou historii rozhodnutí
    - Udržovat integritu auditní stopy
  
  graceful_degradation:
    - Selhat bezpečně, ne pokračovat
    - Zamítnout spíše než pokračovat nesprávně
    - Zachovat omezení řízení
  
  audit_continuity:
    - Všechna selhání jsou zaznamenána
    - Obnovovací akce jsou zaznamenány
    - Žádné mezery v auditní stopě
  
  no_silent_failures:
    - Všechna selhání generují oznámení
    - Zúčastněné strany jsou informovány
    - Selhání jsou vhodně eskalována

retry_policies:
  validation_failure:
    automatic_retry: false
    manual_retry: allowed
    retry_limit: none
    backoff: not_applicable
  
  evidence_insufficient:
    automatic_retry: false
    manual_retry: allowed
    retry_limit: 3_resubmissions
    backoff: not_applicable
  
  operational_block:
    automatic_retry: true
    manual_retry: allowed
    retry_limit: none
    backoff: 5_minutes
  
  system_failure:
    automatic_retry: true
    manual_retry: allowed
    retry_limit: 3_attempts
    backoff: exponential

invariant_rules:
  - Selhání nikdy neobcházejí řízení
  - Selhání nikdy nepřeskakují zaznamenávání auditu
  - Obnovení nikdy nekompromituje autoritu
  - Terminální stavy zůstávají terminální

semantics_version: "1.0.0"
status: INVARIANT
EOF

cat > "$ROOT/knowledge/core/06_DecisionLogSchema.yaml" <<'EOF'
# Schéma logu rozhodnutí
# Status: INVARIANT
# Struktura pro auditní stopu rozhodnutí

decision_log_entry:
  schema:
    log_entry_id:
      type: string
      required: true
      pattern: "^LOG-[0-9]{10}$"
      description: Jedinečný identifikátor položky logu
    
    timestamp:
      type: string
      required: true
      format: iso8601_with_milliseconds
      description: Přesné časové razítko položky logu
    
    artifact_id:
      type: string
      required: true
      description: Zpracovávaný artefakt
    
    decision_record:
      type: object
      required: true
      properties:
        decision_id:
          type: string
          required: true
        
        decision_maker:
          type: string
          required: true
          description: Role GPT nebo autorita činící rozhodnutí
        
        decision_type:
          type: string
          required: true
          enum:
            - STATE_TRANSITION
            - AUTHORITY_CHECK
            - VALIDATION
            - GOVERNANCE_ACTION
            - RELEASE_ACTION
        
        decision_outcome:
          type: string
          required: true
          enum:
            - APPROVED
            - REJECTED
            - BLOCKED
            - ESCALATED
            - FAILED
        
        rationale:
          type: string
          required: true
          min_length: 10
    
    state_context:
      type: object
      required: true
      properties:
        previous_state:
          type: string
          required: true
        
        attempted_state:
          type: string
          required: true
        
        resulting_state:
          type: string
          required: true
        
        transition_valid:
          type: boolean
          required: true
    
    authority_context:
      type: object
      required: true
      properties:
        authority_required:
          type: string
          required: true
        
        authority_held:
          type: string
          required: true
        
        authority_check_passed:
          type: boolean
          required: true
        
        authority_source:
          type: string
          required: true
    
    input_context:
      type: object
      required: true
      description: Plný kontext poskytnutý rozhodujícímu subjektu
      properties:
        artifacts:
          type: array
        
        evidence:
          type: array
        
        prior_decisions:
          type: array
        
        governance_constraints:
          type: object
    
    supporting_data:
      type: object
      required: false
      description: Dodatečná data podporující rozhodnutí
    
    audit_metadata:
      type: object
      required: true
      properties:
        log_schema_version:
          type: string
          required: true
        
        log_integrity_hash:
          type: string
          required: true
          description: Hash položky logu pro detekci manipulace
        
        previous_entry_hash:
          type: string
          required: false
          description: Hash předchozí položky logu pro integritu řetězce
        
        correlation_id:
          type: string
          required: true
          description: Korelační ID pro související rozhodnutí

log_chain_properties:
  immutability:
    - Položky logu nemohou být po vytvoření upraveny
    - Položky logu nemohou být smazány
    - Integrita řetězce logu je kryptograficky ověřena
  
  completeness:
    - Všechna rozhodnutí musí být zaznamenána
    - Žádné mezery v sekvenci rozhodnutí
    - Neúspěšná rozhodnutí jsou zaznamenána
  
  integrity:
    - Každá položka hashuje předchozí položku
    - Integrita řetězce je ověřitelná
    - Manipulace je detekovatelná
  
  accessibility:
    - Logy jsou dotazovatelné podle artifact_id
    - Logy jsou dotazovatelné podle časového razítka
    - Logy jsou dotazovatelné podle decision_maker
    - Plná auditní stopa je přístupná

query_interfaces:
  by_artifact:
    input: artifact_id
    output: Všechny položky logu pro artefakt v chronologickém pořadí
  
  by_decision_maker:
    input: decision_maker_id
    output: Všechna rozhodnutí učiněná specifickou autoritou
  
  by_time_range:
    input: start_timestamp, end_timestamp
    output: Všechny položky logu v časovém rozmezí
  
  by_state_transition:
    input: from_state, to_state
    output: Všechny přechody odpovídající kritériím
  
  integrity_check:
    input: log_entry_id
    output: Výsledek ověření integrity řetězce

retention_policy:
  minimum_retention: 7_years
  archive_after: 1_year
  deletion_policy: NEVER
  backup_frequency: CONTINUOUS

invariant_rules:
  - Všechna rozhodnutí musí být zaznamenána před provedením
  - Položky logu jsou neměnné
  - Integrita řetězce logu je povinná
  - Žádná rozhodnutí bez auditní stopy

schema_version: "1.0.0"
status: INVARIANT
EOF

echo "Created core knowledge files:"
printf '  - %s\n' \
  "$ROOT/knowledge/core/00_ControlPlane_Charter.md" \
  "$ROOT/knowledge/core/01_CanonicalStates.yaml" \
  "$ROOT/knowledge/core/02_TransitionRules.yaml" \
  "$ROOT/knowledge/core/03_ArtifactSchemas.yaml" \
  "$ROOT/knowledge/core/04_AuthorityMatrix.yaml" \
  "$ROOT/knowledge/core/05_FailureSemantics.yaml" \
  "$ROOT/knowledge/core/06_DecisionLogSchema.yaml"

cat > "$ROOT/knowledge/domains/default/10_DomainOntology.md" <<'EOF'
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
EOF

cat > "$ROOT/knowledge/domains/default/11_FramingRules.yaml" <<'EOF'
# Pravidla Rámcování - Výchozí Doména
# Status: ADAPTIVE
# Definuje, jak by GPT měly rámcovat své rozhodování

gpt_framing:
  CP-Governor:
    role_framing: >
      Jste Správce Kontrolní Roviny. Vaším účelem je prosazovat omezení správy
      a validovat stavové přechody. Pracujete na úrovni kontrolní roviny
      a zajišťujete, že všechna rozhodnutí vyhovují požadavkům na autoritu a audit.
      Jste neutrální a procedurální.
    
    decision_framing:
      - Vždy ověřte autoritu před povolením stavových přechodů
      - Prosazujte požadavky na audit bez výjimky
      - Směrujte artefakty podle definovaných pravidel
      - Nikdy neobcházejte omezení správy
      - Dokumentujte všechna porušení a eskalace
    
    output_format:
      - Výsledky validace stavových přechodů
      - Výsledky kontroly autority
      - Rozhodnutí o směrování s odůvodněním
      - Zprávy o porušení
    
    prohibited_behaviors:
      - Činění obchodních nebo technických úsudků
      - Obcházení kontrol autority
      - Úprava auditních stop
      - Oslabování pravidel správy
  
  AE-Intake:
    role_framing: >
      Jste Hodnotitel Artefaktů pro Příjem. Vaším účelem je provádět
      počáteční hodnocení předložených artefaktů. Posuzujete úplnost,
      základní soulad a směrujete k ověření tvrzení. Jste důkladní,
      ale neděláte konečná rozhodnutí o schválení.
    
    decision_framing:
      - Vyhodnoťte úplnost artefaktu a základní kvalitu
      - Kontrolujte zjevné problémy se sladěním
      - Rozhodněte o přijetí nebo odmítnutí pro příjem
      - Směrujte přijaté artefakty k ověření tvrzení
      - Poskytněte jasnou zpětnou vazbu k odmítnutím
    
    output_format:
      - Rozhodnutí o příjmu (ACCEPT/REJECT)
      - Zjištění hodnocení
      - Příznaky souladu
      - Instrukce pro směrování
    
    prohibited_behaviors:
      - Udělování konečných schválení
      - Ověřování tvrzení a důkazů
      - Obcházení požadavků na důkazy
      - Činění technických nebo bezpečnostních úsudků mimo rozsah příjmu
  
  AE-Claims:
    role_framing: >
      Jste Hodnotitel Artefaktů pro Ověření Tvrzení. Vaším účelem je
      ověřit, že všechna tvrzení o artefaktu jsou podpořena
      dostatečnými důkazy. Jste rigorózní a objektivní v posuzování
      kvality a úplnosti důkazů.
    
    decision_framing:
      - Identifikujte všechna tvrzení učiněná o artefaktu
      - Pro každé tvrzení vyhodnoťte podpůrné důkazy
      - Určete, zda jsou důkazy dostatečné a věrohodné
      - Eskalujte, když jsou důkazy nedostatečné
      - Jasně dokumentujte odůvodnění ověření
    
    output_format:
      - Výsledky ověření tvrzení
      - Posouzení dostatečnosti důkazů
      - Identifikované mezery (pokud existují)
      - Zpráva o ověření
    
    prohibited_behaviors:
      - Přijímání tvrzení bez důkazů
      - Udělování konečných schválení
      - Obcházení požadavků na kontrolu
      - Činění technických úsudků mimo posouzení důkazů

behavioral_constraints:
  all_gpts:
    must_always:
      - Pracujte v rámci přidělené autority
      - Zaznamenávejte všechna rozhodnutí s odůvodněním
      - Poskytujte jasné, konkrétní odůvodnění
      - Používejte definovaný slovník stavů a přechodů
      - Požadujte lidský zásah v případě nejistoty
    
    must_never:
      - Obcházejte kontroly autority
      - Přeskakujte auditní záznamy
      - Rozhodujte mimo rozsah autority
      - Oslabujte omezení správy
      - Pokračujte, když jsou informace UNKNOWN

  decision_quality:
    rationale_requirements:
      - Minimálně 10 slov
      - Konkrétní, ne obecné
      - Odkazuje na důkazy nebo pravidla
      - Jasně vysvětluje úvahu
    
    uncertainty_handling:
      - Explicitně uveďte UNKNOWN, když informace nejsou k dispozici
      - Nedomýšlejte ani nepředpokládejte
      - Eskalujte, když mezery v informacích brání rozhodnutí
      - Dokumentujte, jaké informace jsou potřeba

  tone_and_style:
    - Profesionální a neutrální
    - Jasný a konkrétní
    - Založený na důkazech
    - Procedurální, ne subjektivní
    - Vhodný pro auditní stopu

context_awareness:
  artifact_context:
    always_consider:
      - Typ artefaktu
      - Cílové prostředí
      - Priorita a dopad
      - Požadavky na soulad
      - Historie předchozích rozhodnutí
  
  state_context:
    always_consider:
      - Aktuální stav
      - Platné další stavy
      - Požadovaná autorita
      - Omezení správy
  
  governance_context:
    always_consider:
      - Mapy vlastnictví a schválení
      - Stav provozního veta
      - Omezení kontroloru vydání

interaction_patterns:
  with_submitters:
    - Poskytněte jasnou, proveditelnou zpětnou vazbu
    - Konkrétně vysvětlete důvody odmítnutí
    - Veďte ohledně požadavků na důkazy
    - Podporujte opětovné podání s opravami
  
  with_reviewers:
    - Směrujte s plným kontextem
    - Poskytněte shrnutí artefaktu
    - Zvýrazněte příznaky souladu
    - Podporujte informovaná rozhodnutí o kontrole
  
  with_governance:
    - Eskalujte vhodně
    - Poskytněte úplné informace
    - Dokumentujte obavy ohledně správy
    - Podporujte audit a dohled

adaptation_notes:
  domains_may_customize:
    - Rámcování rolí pro kontext domény
    - Specifika rámcování rozhodování
    - Detaily výstupního formátu
    - Vzorce interakce
  
  domains_must_preserve:
    - Omezení autority
    - Požadavky na audit
    - Zakázané chování
    - Zacházení s nejistotou

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/12_PrimitiveCatalog.yaml" <<'EOF'
# Katalog Primitiv - Výchozí Doména
# Status: ADAPTIVE
# Definuje dostupné operace a primitiva pro GPT

primitives:
  state_operations:
    get_current_state:
      description: Načíst aktuální stav artefaktu
      inputs:
        - artifact_id
      outputs:
        - current_state
        - state_timestamp
      authority_required: ANY
    
    validate_transition:
      description: Zkontrolovat, zda je stavový přechod platný
      inputs:
        - artifact_id
        - from_state
        - to_state
      outputs:
        - transition_valid
        - validation_errors
      authority_required: CP-Governor
    
    execute_transition:
      description: Provést validovaný stavový přechod
      inputs:
        - artifact_id
        - to_state
        - decision_rationale
      outputs:
        - transition_result
        - new_state
      authority_required: TRANSITION_AUTHORITY
      audit_required: true
  
  artifact_operations:
    retrieve_artifact:
      description: Načíst detaily artefaktu
      inputs:
        - artifact_id
      outputs:
        - artifact_metadata
        - artifact_payload
        - claims
      authority_required: ANY
    
    evaluate_completeness:
      description: Zkontrolovat, zda je artefakt úplný
      inputs:
        - artifact_id
      outputs:
        - completeness_status
        - missing_elements
      authority_required: AE-Intake
    
    extract_claims:
      description: Extrahovat tvrzení z artefaktu
      inputs:
        - artifact_id
      outputs:
        - claims_list
        - evidence_requirements
      authority_required: AE-Claims
  
  evidence_operations:
    retrieve_evidence:
      description: Načíst důkaz pro tvrzení
      inputs:
        - evidence_id
      outputs:
        - evidence_content
        - evidence_metadata
      authority_required: AE-Claims
    
    verify_evidence:
      description: Ověřit, že důkaz podporuje tvrzení
      inputs:
        - claim_id
        - evidence_id
      outputs:
        - verification_result
        - sufficiency_assessment
      authority_required: AE-Claims
      audit_required: true
    
    assess_evidence_quality:
      description: Posoudit celkovou kvalitu důkazů
      inputs:
        - artifact_id
      outputs:
        - quality_score
        - gaps_identified
      authority_required: AE-Claims
  
  decision_operations:
    make_decision:
      description: Učinit a zaznamenat rozhodnutí
      inputs:
        - artifact_id
        - decision_type
        - decision_outcome
        - rationale
      outputs:
        - decision_id
        - log_entry_id
      authority_required: DECISION_MAKER
      audit_required: true
    
    check_authority:
      description: Ověřit, že tvůrce rozhodnutí má autoritu
      inputs:
        - decision_maker
        - decision_type
        - artifact_context
      outputs:
        - authority_check_result
        - authority_source
      authority_required: CP-Governor
    
    log_decision:
      description: Vytvořit auditní záznam
      inputs:
        - decision_record
        - state_context
        - authority_context
      outputs:
        - log_entry_id
        - log_integrity_hash
      authority_required: ANY
      audit_required: MANDATORY
  
  routing_operations:
    assign_review_lane:
      description: Určit vhodnou kontrolní linii
      inputs:
        - artifact_id
        - artifact_type
        - impact_level
      outputs:
        - review_lane
        - assigned_reviewers
      authority_required: CP-Governor
    
    route_to_approval:
      description: Směrovat do schvalovacího workflow
      inputs:
        - artifact_id
        - approval_requirements
      outputs:
        - approval_workflow_id
        - required_approvers
      authority_required: CP-Governor
    
    escalate:
      description: Eskalovat k vyšší autoritě
      inputs:
        - artifact_id
        - escalation_reason
        - current_authority
      outputs:
        - escalation_target
        - escalation_id
      authority_required: ANY
  
  governance_operations:
    check_veto_status:
      description: Zkontrolovat, zda je aktivní provozní veto
      inputs:
        - artifact_id
      outputs:
        - veto_active
        - veto_reason
      authority_required: RELEASE_CONTROLLER
    
    enforce_block:
      description: Blokovat vydání z provozních důvodů
      inputs:
        - artifact_id
        - block_reason
      outputs:
        - block_id
        - block_status
      authority_required: RELEASE_CONTROLLER
      audit_required: true
    
    clear_block:
      description: Zrušit blokování vydání
      inputs:
        - block_id
        - resolution_notes
      outputs:
        - clear_result
      authority_required: RELEASE_CONTROLLER
      audit_required: true

primitive_constraints:
  authority_enforcement:
    - Všechna primitiva kontrolují autoritu před provedením
    - Porušení autority okamžitě vyvolá chyby
    - Žádné primitivum nemůže obejít kontroly autority
  
  audit_logging:
    - Primitiva vyžadující audit vždy zaznamenávají
    - Záznam vytvořen před mutací stavu
    - Neúspěšné operace jsou také zaznamenány
  
  error_handling:
    - Primitiva vracejí chyby, ne výjimky
    - Chyby zahrnují specifické kódy důvodu
    - Částečné provedení není povoleno

composition_rules:
  allowed:
    - Volně řetězit operace čtení
    - Skládat validační operace
    - Stavět složité dotazy z jednoduchých
  
  prohibited:
    - Obcházet autoritu pomocí kompozice
    - Přeskakovat audit rozdělenou operací
    - Obcházet správu nepřímým přístupem

extension_guidelines:
  domains_may_add:
    - Doménově specifická primitiva
    - Vlastní validační operace
    - Specializovanou logiku směrování
    - Doménové operace s důkazy
  
  domains_must_not:
    - Přidávat primitiva, která obcházejí autoritu
    - Vytvářet mutační operace bez auditu
    - Oslabovat zpracování chyb
    - Porušovat pravidla kompozice

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/13_DeliveryTopologyRules.yaml" <<'EOF'
# Pravidla Topologie Dodání - Výchozí Doména
# Status: ADAPTIVE
# Definuje topologii nasazení a omezení prostředí

environments:
  local:
    purpose: Lokální vývoj a strukturální validace
    characteristics:
      - Žádná integrace backendu
      - Pouze souborová validace
      - Kontrola úplnosti
      - Validace schématu
    
    deployment_allowed_if:
      - Skripty bootstrap se provedou úspěšně
      - Všechny požadované soubory existují
      - Syntaxe YAML je platná
      - Reference manifestu se řeší
    
    deployment_blocked_if: []
    
    testing_scope:
      - Kontroly existence souborů
      - Validace schématu
      - Konzistence manifestu
      - Žádné testování běhu
  
  dev:
    purpose: První skutečné integrační prostředí
    characteristics:
      - Backend služby integrované
      - Konfigurace GPT nasazená
      - Vynucovací služby aktivní
      - Kouřové testování povoleno
    
    deployment_allowed_if:
      - local_gate == PASS
      - Backend build existuje
      - Auth binding definován
      - Mapování endpointu kompletní
      - Binding konfigurace GPT připravený
    
    deployment_blocked_if:
      - openapi_not_bound_to_concrete_backend
      - auth_binding_missing
      - endpoint_owner_mapping_missing
      - gpt_action_binding_missing
    
    testing_scope:
      - Kontroly stavu backendu
      - Validace auth
      - Kouřové testy zřízení GPT
      - Testy připojení protokolu rozhodnutí
      - Základní end-to-end toky
  
  staging:
    purpose: Plné cvičení reality správy
    characteristics:
      - Topologie podobná produkci
      - Plné vynucování správy
      - Akceptační testování
      - Aktivní schvalovací workflow
      - Povoleno provozní veto
    
    deployment_allowed_if:
      - dev_gate == PASS
      - knowledge_file_completeness == PASS
      - fixture_completeness == PASS
      - qa_artifact_exists
      - ownership_map_exists
      - approval_map_exists
      - veto_map_exists
    
    deployment_blocked_if:
      - knowledge_file_completeness != PASS
      - fixture_completeness != PASS
      - qa_artifact_missing
      - ownership_map_missing
      - approval_map_missing
      - veto_map_missing
    
    testing_scope:
      - Plná sada akceptačních testů
      - Validace schvalovacího workflow
      - Testování vynucení veta
      - Testování blokování vydání
      - Detekce falešného pokračování
      - Testování výkonu
  
  prod:
    purpose: Produkční nasazení
    characteristics:
      - Živý uživatelský provoz
      - Plné auditní záznamy
      - Vynucování správy
      - Monitorování a upozorňování
      - Schopnost návratu
    
    deployment_allowed_if:
      - staging_gate == PASS
      - final_qa_artifact == PASS
      - ownership_map_approved
      - approval_map_approved
      - veto_map_approved
      - authoritative_release_notes_approved
      - rollback_plan_exists
      - monitoring_alerting_exist
    
    deployment_blocked_if:
      - staging_gate != PASS
      - final_qa_artifact != PASS
      - knowledge_file_completeness != PASS
      - fixture_completeness != PASS
      - ownership_map_not_approved
      - approval_map_not_approved
      - veto_map_not_approved
      - authoritative_release_notes_missing
    
    testing_scope:
      - Produkční kouřové testy
      - Validace auditního záznamu
      - Ověření monitorování
      - Připravenost návratu
      - Monitorování výkonu

promotion_paths:
  local_to_dev:
    requirements:
      - Všechny strukturální validace projdou
      - Infrastruktura backendu připravena
      - Bindingy konfigurace kompletní
    
    validation:
      - Úplnost manifestu
      - Platnost schématu
      - Existence souborů
      - Konektivita backendu
  
  dev_to_staging:
    requirements:
      - Dev kouřové testy projdou
      - Znalostní soubory kompletní
      - Testovací fixtury kompletní
      - Mapy správy existují
    
    validation:
      - Potvrzený stav backendu
      - Ověřeno zřízení GPT
      - Splněny předpoklady správy
  
  staging_to_prod:
    requirements:
      - Všechny akceptační testy projdou
      - Získáno schválení správy
      - Potvrzena provozní připravenost
      - Validován plán návratu
    
    validation:
      - Schválen QA artefakt
      - Všechny mapy správy schváleny
      - Schváleny poznámky k vydání
      - Provozní monitorování

rollback_requirements:
  dev:
    rollback_trigger:
      - Selhání stavu backendu
      - Kritické selhání kouřového testu
    rollback_target: previous_working_dev_version
    rollback_time: under_5_minutes
  
  staging:
    rollback_trigger:
      - Selhání akceptačního testu
      - Zjištěno porušení správy
    rollback_target: previous_working_staging_version
    rollback_time: under_10_minutes
  
  prod:
    rollback_trigger:
      - Selhání produkčního kouřového testu
      - Kritický incident
      - Provozní veto
    rollback_target: last_known_good_production
    rollback_time: under_2_minutes
    approval_required: true

topology_constraints:
  data_flow:
    - Všechna prostředí používají stejné schéma protokolu rozhodnutí
    - Žádná produkční data v dev/staging
    - Auditní stopy jsou specifické pro prostředí
    - Testovací fixtury nepronikají do produkce
  
  access_control:
    - Dev: Přístup vývojového týmu
    - Staging: Přístup QA a týmu správy
    - Prod: Pouze autorizovaný provozní tým
    - Auditní záznamy: Pouze pro čtení pro většinu, pouze pro připojení pro systém
  
  resource_isolation:
    - Každé prostředí má vyhrazené zdroje
    - Žádné závislosti mezi prostředími
    - Stav je specifický pro prostředí
    - Protokoly rozhodnutí jsou per-prostředí

adaptation_guidelines:
  domains_may_customize:
    - Charakteristiky prostředí
    - Podmínky nasazení
    - Rozsah testování per prostředí
    - Požadavky na povýšení
    - Postupy návratu
  
  domains_must_preserve:
    - Progresivní model nasazení
    - Povýšení založené na bránách
    - Integrita auditní stopy
    - Schopnost návratu
    - Izolace zdrojů

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/14_RiskComplianceTriggers.yaml" <<'EOF'
# Spouštěče Rizika a Souladu - Výchozí Doména
# Status: ADAPTIVE
# Definuje podmínky, které spouštějí dodatečnou kontrolu nebo požadavky

risk_levels:
  minimal:
    criteria:
      - Pouze změny dokumentace
      - Neprodukční prostředí
      - Žádný dopad na uživatele
      - Plně reverzibilní
    
    additional_requirements: []
    
    approval_level: STANDARD
  
  moderate:
    criteria:
      - Změny konfigurace
      - Dev nebo staging prostředí
      - Omezený dopad na uživatele
      - Reverzibilní s úsilím
    
    additional_requirements:
      - Vyžadován plán návratu
      - Vyžadováno posouzení dopadu
    
    approval_level: STANDARD
  
  significant:
    criteria:
      - Změny kódu nebo balíčku
      - Staging prostředí
      - Mírný dopad na uživatele
      - Složitý návrat
    
    additional_requirements:
      - Vyžadováno komplexní testování
      - Vyžadován plán návratu a validace
      - Vyžadována bezpečnostní kontrola
    
    approval_level: ELEVATED
  
  major:
    criteria:
      - Produkční nasazení
      - Vysoký dopad na uživatele
      - Zapojená migrace dat
      - Obtížný návrat
    
    additional_requirements:
      - Vyžadována plná sada akceptačních testů
      - Vyžadována bezpečnostní a compliance kontrola
      - Vyžadováno výkonné schválení
      - Vyžadován plán postupného zavádění
      - Vyžadováno 24/7 pokrytí podpory
    
    approval_level: EXECUTIVE

compliance_triggers:
  security_review_required:
    conditions:
      - Změny autentizace nebo autorizace
      - Kryptografické změny
      - Bezpečnostně citlivá konfigurace
      - Integrace externích služeb
      - Změny zpracování uživatelských dat
    
    review_authority: SECURITY_TEAM
    
    evidence_required:
      - Výsledky bezpečnostního skenu
      - Výsledky penetračního testu (pro prod)
      - Kontrola bezpečnostní architektury
  
  legal_review_required:
    conditions:
      - Změny zásad ochrany osobních údajů
      - Změny podmínek služby
      - Změny zásad uchovávání dat
      - Přenos dat přes hranice
      - Dopad na regulační soulad
    
    review_authority: LEGAL_TEAM
    
    evidence_required:
      - Právní kontrolní memorandum
      - Kontrolní seznam souladu
      - Posouzení dopadu na soukromí
  
  compliance_review_required:
    conditions:
      - Změny auditní stopy
      - Změny procesů správy
      - Změny regulačních kontrol
      - Soulad s průmyslovými standardy
    
    review_authority: COMPLIANCE_TEAM
    
    evidence_required:
      - Posouzení souladu
      - Výsledky validace kontrol
      - Ověření auditní stopy
  
  architecture_review_required:
    conditions:
      - Zavedení nové služby
      - Změna architektonického vzoru
      - Obavy o škálovatelnost
      - Změny kritické pro výkon
    
    review_authority: ARCHITECTURE_TEAM
    
    evidence_required:
      - Záznam architektonického rozhodnutí
      - Analýza škálovatelnosti
      - Výsledky testů výkonu

escalation_triggers:
  automatic_escalation:
    conditions:
      - Risk level == MAJOR
      - Produkční prostředí
      - Kritická priorita
      - Aktivní spouštěč souladu
      - Historie předchozího selhání
    
    escalation_target: EXECUTIVE_APPROVAL
    
    escalation_requirements:
      - Připraven výkonný briefing
      - Dokumentován plán zmírnění rizika
      - Validovány postupy návratu
  
  manual_escalation_available:
    conditions:
      - Kontrolor požaduje eskalaci
      - Schvalovatel požaduje výkonný vstup
      - Zúčastněná strana vyjadřuje obavy
      - Nejistota ohledně autority
    
    escalation_process:
      - Dokumentujte důvod eskalace
      - Poskytněte plný kontext
      - Čekejte na výkonné rozhodnutí

veto_triggers:
  operational_veto_conditions:
    - Probíhá produkční incident
    - Konflikt údržbového okna
    - Omezení kapacity zdrojů
    - Degradovaný monitorovací systém
      - Nedostupný pohotovostní tým
    - Nedávné produkční selhání
  
  veto_authority: OPERATIONAL_TEAM
  
  veto_process:
    - Důvod veta musí být dokumentován
    - Poskytnut očekávaný čas řešení
    - Artefakt se přesune do RELEASE_BLOCKED
    - Veto může být zrušeno, když se podmínka vyřeší

release_block_triggers:
  automatic_block:
    conditions:
      - Staging gate != PASS
      - Úplnost znalostí != PASS
      - Úplnost fixtur != PASS
      - Jakýkoli terminální stav odmítnutí
      - Aktivní bezpečnostní incident
    
    block_authority: RELEASE_CONTROLLER
    
    unblock_requirements:
      - Podmínka blokování plně vyřešena
      - Dokončena re-validace
      - Získáno schválení správy
  
  manual_block:
    conditions:
      - Výkonné rozhodnutí
      - Naléhavá provozní potřeba
      - Externí regulační požadavek
    
    block_authority: EXECUTIVE_AUTHORITY
    
    unblock_requirements:
      - Explicitní výkonné schválení
      - Dokumentované řešení
      - Záznam auditní stopy

monitoring_requirements:
  by_risk_level:
    minimal:
      monitoring: STANDARD
      alerting: NONE
      on_call: NOT_REQUIRED
    
    moderate:
      monitoring: STANDARD
      alerting: BASIC
      on_call: BUSINESS_HOURS
    
    significant:
      monitoring: ENHANCED
      alerting: COMPREHENSIVE
      on_call: EXTENDED_HOURS
    
    major:
      monitoring: INTENSIVE
      alerting: CRITICAL_PATH
      on_call: 24x7

adaptation_guidelines:
  domains_may_customize:
    - Kritéria úrovně rizika
    - Podmínky spouštěče souladu
    - Definice kontrolních autorit
    - Prahy eskalace
    - Požadavky na monitorování
  
  domains_must_preserve:
    - Progresivní řízení rizik
    - Vynucování souladu
    - Schopnost eskalace
    - Mechanismus veta
    - Auditní stopa spouštěčů

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/15_CommercialPackagingRules.yaml" <<'EOF'
# Pravidla Komerčního Balení - Výchozí Doména
# Status: ADAPTIVE
# Definuje, jak jsou artefakty baleny pro komerční distribuci

packaging_types:
  internal_use:
    description: Artefakty pouze pro interní organizační použití
    
    requirements:
      licensing: NOT_REQUIRED
      third_party_notices: RECOMMENDED
      distribution_rights: INTERNAL_ONLY
      support_commitment: BEST_EFFORT
    
    validation:
      - Postačuje interní schválení
      - Není vyžadována kontrola exportních kontrol
      - Vyžadováno standardní testování
    
    distribution_channels:
      - Interní úložiště artefaktů
      - Interní systémy nasazení
  
  open_source:
    description: Artefakty vydané pod open source licencí
    
    requirements:
      licensing: REQUIRED
      license_type: OSI_APPROVED
      third_party_notices: REQUIRED
      source_code: MUST_INCLUDE
      distribution_rights: PUBLIC
      support_commitment: COMMUNITY
    
    validation:
      - Vyžadována kontrola kompatibility licence
      - Vyžadována kontrola závislostí třetích stran
      - Vyžadována kontrola úplnosti zdrojového kódu
      - Vyžadována kontrola dokumentačních standardů
    
    distribution_channels:
      - Veřejné úložiště balíčků
      - Veřejná správa zdrojového kódu
      - Oficiální stránky pro stažení
  
  commercial:
    description: Artefakty pro komerční prodej nebo licencování
    
    requirements:
      licensing: REQUIRED
      license_type: PROPRIETARY_OR_COMMERCIAL
      third_party_notices: REQUIRED
      licensing_terms: MUST_DEFINE
      distribution_rights: LICENSED
      support_commitment: CONTRACTUAL
      warranty_terms: MUST_DEFINE
    
    validation:
      - Vyžadována kontrola licence
      - Vyžadováno právní schválení
      - Vyčištěno licencování třetích stran
      - Validován plán podpory
      - Zkontrolovány podmínky záruky
    
    distribution_channels:
      - Úložiště licencovaných zákazníků
      - Komerční distribuční platformy
      - Dodávka specifická pro zákazníka

licensing_constraints:
  third_party_dependencies:
    allowed_licenses:
      permissive:
        - MIT
        - Apache-2.0
        - BSD-2-Clause
        - BSD-3-Clause
      
      copyleft_weak:
        - LGPL-2.1
        - LGPL-3.0
        - MPL-2.0
      
      copyleft_strong:
        - GPL-2.0
        - GPL-3.0
        - AGPL-3.0
    
    compatibility_rules:
      - Permisivní licence kompatibilní se všemi typy balení
      - Slabý copyleft vyžaduje distribuci zdrojů pro knihovnu
      - Silný copyleft vyžaduje plnou distribuci zdrojů
      - AGPL vyžaduje poskytnutí zdrojů pro síťové použití
  
  license_verification:
    required_for: ALL_PACKAGING_TYPES
    
    verification_steps:
      - Vypočítat všechny závislosti
      - Identifikovat licenci pro každou závislost
      - Zkontrolovat kompatibilitu s typem balení
      - Ověřit zahrnutí textu licence
      - Vygenerovat soubor oznámení třetích stran

distribution_restrictions:
  export_control:
    check_required:
      - Komerční balení
      - Open source s šifrováním
      - Přeshraniční distribuce
    
    validation:
      - Klasifikace exportních kontrol
      - Kontrola omezených zemí
      - Kontrola registrace šifrování
  
  geographic_restrictions:
    by_packaging_type:
      internal_use:
        restrictions: ORGANIZATIONAL_BOUNDARIES
      
      open_source:
        restrictions: EXPORT_CONTROL_ONLY
      
      commercial:
        restrictions: PER_LICENSE_AGREEMENT

versioning_requirements:
  semantic_versioning:
    required_for: ALL_PACKAGING_TYPES
    
    format: MAJOR.MINOR.PATCH
    
    increment_rules:
      major: Kritické změny nebo hlavní funkce
      minor: Nové funkce, zpětně kompatibilní
      patch: Opravy chyb, zpětně kompatibilní
  
  version_metadata:
    required_fields:
      - version_number
      - release_date
      - package_type
      - license_identifier
      - support_level
  
  changelog:
    required_for: ALL_PACKAGING_TYPES
    
    required_sections:
      - Added: Nové funkce
      - Changed: Změny v existující funkcionalitě
      - Deprecated: Brzy odstraněné funkce
      - Removed: Odstraněné funkce
      - Fixed: Opravy chyb
      - Security: Změny související s bezpečností

support_commitments:
  by_packaging_type:
    internal_use:
      support_level: BEST_EFFORT
      sla: NONE
      support_channels:
        - Interní ticketovací systém
        - Týmové komunikační kanály
    
    open_source:
      support_level: COMMUNITY
      sla: NONE
      support_channels:
        - Veřejný tracker problémů
        - Komunitní fóra
        - Dokumentace
      
      expectations:
        - Vítány hlášení chyb
        - Pull requesty zváženy
        - Žádná garantovaná doba odezvy
    
    commercial:
      support_level: CONTRACTUAL
      sla: PER_CONTRACT
      support_channels:
        - Dedikovaný portál podpory
        - Emailová podpora
        - Telefonní podpora (pro premium)
      
      expectations:
        - Doba odezvy podle SLA
        - Řešení problémů podle SLA
        - Závazek bezpečnostních záplat

documentation_requirements:
  all_packaging_types:
    required:
      - README s přehledem
      - Instrukce pro instalaci
      - Základní příklady použití
      - Informace o licenci
      - Oznámení třetích stran
  
  open_source_additional:
    required:
      - Pokyny pro přispívání
      - Kodex chování
      - Průvodce nastavením vývoje
      - Dokumentace architektury
  
  commercial_additional:
    required:
      - Komplexní uživatelská příručka
      - Reference API
      - Průvodce odstraňováním problémů
      - Kontaktní informace podpory
      - Dokumentace SLA

adaptation_guidelines:
  domains_may_customize:
    - Typy balení
    - Licenční politiky
    - Distribuční kanály
    - Závazky podpory
    - Požadavky na dokumentaci
  
  domains_must_preserve:
    - Vynucování souladu s licencí
    - Požadavky na oznámení třetích stran
    - Soulad s exportními kontrolami
    - Sledovatelnost verze

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/16_ClaimsEvidencePolicy.yaml" <<'EOF'
# Politika Tvrzení a Důkazů - Výchozí Doména
# Status: ADAPTIVE
# Definuje, která tvrzení vyžadují jaké důkazy

claim_categories:
  functional_correctness:
    description: Tvrzení o funkčním chování a správnosti
    
    claim_types:
      - Funkce funguje podle specifikace
      - Chyba je opravena
      - Požadavky jsou splněny
      - Kritéria akceptace splněna
    
    required_evidence:
      - automated_test_results:
          description: Výsledky automatizované testovací sady
          sufficiency: Testovací pokrytí > 80% pro změněný kód
          verification: AE-Claims validuje provedení testu
      
      - manual_test_results:
          description: Záznamy manuálního provedení testů
          sufficiency: Všechny kritické cesty testovány
          verification: AE-Claims validuje úplnost testu
      
      - acceptance_test_results:
          description: Výsledky uživatelských akceptačních testů
          sufficiency: Všechna kritéria akceptace projdou
          verification: AE-Claims validuje oproti požadavkům
  
  quality_assurance:
    description: Tvrzení o kvalitě kódu a udržovatelnosti
    
    claim_types:
      - Kód splňuje standardy kvality
      - Technický dluh je přijatelný
      - Výkon je adekvátní
      - Udržovatelnost je dobrá
    
    required_evidence:
      - code_review_results:
          description: Zjištění a schválení kontroly kódu
          sufficiency: Minimálně jedno schválení kontrolora
          verification: AE-Claims validuje autoritu kontrolora
      
      - static_analysis_results:
          description: Výsledky statické analýzy kódu
          sufficiency: Žádné kritické nebo vysoce závažné problémy
          verification: AE-Claims validuje provedení analýzy
      
      - performance_test_results:
          description: Výsledky výkonnostních benchmarků
          sufficiency: Splňuje definované výkonnostní prahy
          verification: AE-Claims validuje oproti základním hodnotám
  
  security:
    description: Tvrzení o bezpečnostních vlastnostech
    
    claim_types:
      - Nebyly zavedeny žádné bezpečnostní zranitelnosti
      - Bezpečnostní kontroly jsou efektivní
      - Autentizace/autorizace správná
      - Ochrana dat adekvátní
    
    required_evidence:
      - security_scan_results:
          description: Výsledky automatizovaného bezpečnostního skenu
          sufficiency: Žádné kritické nebo vysoké zranitelnosti
          verification: AE-Claims validuje pokrytí skenu
      
      - security_review_findings:
          description: Výsledky kontroly bezpečnostního týmu
          sufficiency: Získáno schválení bezpečnostního týmu
          verification: AE-Claims validuje autoritu kontrolora
      
      - penetration_test_results:
          description: Výsledky penetračního testování (pouze prod)
          sufficiency: Nenalezeny žádné zneužitelné zranitelnosti
          verification: AE-Claims validuje rozsah testu
  
  compliance:
    description: Tvrzení o regulačním a politickém souladu
    
    claim_types:
      - Splňuje regulační požadavky
      - Vyhovuje interním politikám
      - Auditní stopa je úplná
      - Požadavky na soukromí splněny
    
    required_evidence:
      - compliance_checklist:
          description: Dokončený kontrolní seznam souladu
          sufficiency: Všechny položky zkontrolovány a validovány
          verification: AE-Claims validuje úplnost kontrolního seznamu
      
      - compliance_review_approval:
          description: Kontrola a schválení týmem souladu
          sufficiency: Formální schválení dokumentováno
          verification: AE-Claims validuje autoritu schvalovatele
      
      - audit_trail_validation:
          description: Ověření úplnosti auditní stopy
          sufficiency: Všechny požadované události zaznamenány
          verification: AE-Claims validuje integritu záznamu
  
  operational_readiness:
    description: Tvrzení o produkční připravenosti
    
    claim_types:
      - Monitorování je na místě
      - Plán návratu je validován
      - Dokumentace je úplná
      - Podpora je připravena
    
    required_evidence:
      - monitoring_validation:
          description: Konfigurace monitorování a upozorňování
          sufficiency: Všechny kritické cesty monitorovány
          verification: AE-Claims validuje pokrytí
      
      - rollback_plan:
          description: Dokumentovaný a testovaný postup návratu
          sufficiency: Návrat testován ve staging
          verification: AE-Claims validuje výsledky testů
      
      - documentation:
          description: Uživatelská a provozní dokumentace
          sufficiency: Všechny požadované sekce úplné
          verification: AE-Claims validuje úplnost
      
      - support_readiness:
          description: Tým podpory připraven
          sufficiency: Školení dokončeno, pokrytí pohotovosti
          verification: AE-Claims validuje připravenost

evidence_sufficiency_rules:
  minimum_requirements:
    all_claims:
      - Minimálně jeden důkaz na tvrzení
      - Důkaz musí být ověřitelný
      - Důkaz musí být aktuální (ne zastaralý)
      - Důkaz musí být z autoritativního zdroje
  
  high_risk_artifacts:
    - Vyžadovány více nezávislých zdrojů důkazů
    - Může být vyžadováno ověření třetí stranou
    - Může být vyžadováno výkonné schválení
  
  low_risk_artifacts:
    - Jeden zdroj důkazu může být dostatečný
    - Sebeověření může být přijatelné
    - Standardní schvalovací proces

evidence_freshness:
  automated_test_results:
    maximum_age: 24_hours
    must_be_from: Aktuální verze artefaktu
  
  security_scans:
    maximum_age: 7_days
    must_be_from: Aktuální verze artefaktu
  
  manual_reviews:
    maximum_age: 30_days
    must_be_from: Aktuální nebo kompatibilní verze
  
  compliance_approvals:
    maximum_age: 90_days
    must_be_from: Aktuální verze politiky

evidence_quality:
  trustworthiness:
    high_trust:
      - Automatizované testovací systémy
      - Certifikované skenovací nástroje
      - Schválené kontrolní autority
    
    medium_trust:
      - Záznamy manuálních testů
      - Samohlášené metriky
      - Vzájemné kontroly
    
    low_trust:
      - Neověřená tvrzení
      - Zastaralé důkazy
      - Neautorizované zdroje
  
  completeness:
    complete:
      - Všechna tvrzení mají důkazy
      - Všechny důkazy jsou ověřitelné
      - Žádné mezery v pokrytí
    
    incomplete:
      - Některá tvrzení postrádají důkazy
      - Některé důkazy nejsou ověřitelné
      - Existují mezery v pokrytí
    
    insufficient:
      - Většina tvrzení postrádá důkazy
      - Špatná kvalita důkazů
      - Velké mezery v pokrytí

verification_process:
  for_each_claim:
    steps:
      1. Identifikovat prohlášení tvrzení
      2. Určit požadovaný typ důkazu
      3. Lokalizovat a načíst důkaz
      4. Ověřit autenticitu důkazu
      5. Posoudit aktuálnost důkazu
      6. Vyhodnotit kvalitu důkazu
      7. Určit dostatečnost
      8. Dokumentovat výsledek ověření
  
  verification_outcomes:
    verified:
      condition: Dostatečný vysoce kvalitní důkaz
      next_state: CLAIMS_VERIFIED
    
    insufficient:
      condition: Důkaz chybí nebo je nedostatečný
      next_state: CLAIMS_INSUFFICIENT
      action: Dokumentovat mezery, požádat o dodatečné důkazy
    
    rejected:
      condition: Důkaz je v rozporu s tvrzením
      next_state: INTAKE_REJECTED
      action: Odmítnout artefakt, dokumentovat důvod

special_cases:
  no_evidence_available:
    handling: >
      Pokud nelze poskytnout důkaz z legitimních omezení,
      eskalujte k příslušné autoritě pro rozhodnutí o výjimce.
      Dokumentujte důvod a získejte explicitní schválení.
    
    must_not: Přijímat tvrzení bez důkazu nebo schválení
  
  conflicting_evidence:
    handling: >
      Pokud se zdroje důkazů rozcházejí, eskalujte ke kontrolní autoritě
      pro vyšetření a řešení. Nepokračujte, dokud nebude vyřešeno.
    
    must_not: Ignorovat rozporné důkazy nebo vybírat selektivně
  
  unknown_claim_type:
    handling: >
      Pokud typ tvrzení není definován v této politice, eskalujte
      ke správě pro vyjasnění nebo rozšíření politiky.
    
    must_not: Pokračovat bez definovaných požadavků na důkazy

adaptation_guidelines:
  domains_may_customize:
    - Kategorie tvrzení
    - Požadavky na důkazy
    - Prahy dostatečnosti
    - Požadavky na aktuálnost
    - Kritéria kvality
  
  domains_must_preserve:
    - Důkaz je vyžadován pro všechna tvrzení
    - Ověřovací proces je povinný
    - Posouzení kvality je vyžadováno
    - Eskalační cesty existují pro výjimky

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/17_ReviewLaneRules.yaml" <<'EOF'
# Pravidla Kontrolních Linií - Výchozí Doména
# Status: ADAPTIVE
# Definuje, jak jsou artefakty směrovány do příslušných kontrolních linií

review_lanes:
  technical:
    description: Kontrola technické správnosti a kvality kódu
    
    triggers:
      - artifact_type in [PACKAGE_RELEASE, CONFIGURATION_CHANGE]
      - code_changes_present
      - technical_risk >= MODERATE
    
    reviewer_qualifications:
      - Technická expertiza v relevantní oblasti
      - Znalost kódové základny
      - Porozumění architektuře
    
    review_focus:
      - Kvalita kódu a udržovatelnost
      - Sladění s architekturou
      - Dopad technického dluhu
      - Úvahy o výkonu
      - Robustnost zpracování chyb
    
    approval_criteria:
      - Kód splňuje standardy kvality
      - Dodrženy principy architektury
      - Technická rizika přijatelná
      - Žádné kritické technické problémy
    
    typical_duration: 2_to_4_hours
  
  security:
    description: Posouzení bezpečnosti a zranitelností
    
    triggers:
      - artifact_type in [PACKAGE_RELEASE, CONFIGURATION_CHANGE]
      - security_sensitive_changes
      - target_environment == PROD
      - authentication_or_authorization_changes
      - cryptographic_changes
      - external_integration_changes
    
    reviewer_qualifications:
      - Expertiza v bezpečnosti
      - Zkušenosti s modelováním hrozeb
      - Schopnosti posouzení zranitelností
    
    review_focus:
      - Bezpečnostní zranitelnosti
      - Autentizace a autorizace
      - Ochrana dat
      - Kryptografická správnost
      - Validace vstupů
      - Osvědčené bezpečnostní postupy
    
    approval_criteria:
      - Žádné kritické nebo vysoké zranitelnosti
      - Efektivní bezpečnostní kontroly
      - Aktualizován model hrozeb
      - Dodrženy osvědčené bezpečnostní postupy
    
    typical_duration: 4_to_8_hours
  
  compliance:
    description: Kontrola souladu s regulacemi a politikami
    
    triggers:
      - compliance_flags_present
      - privacy_impact
      - regulatory_requirements_affected
      - audit_trail_changes
      - policy_changes
    
    reviewer_qualifications:
      - Expertiza v souladu
      - Znalost regulací
      - Schopnosti interpretace politik
    
    review_focus:
      - Regulační soulad
      - Dodržování politik
      - Požadavky na soukromí
      - Úplnost auditní stopy
      - Uchovávání záznamů
    
    approval_criteria:
      - Splněny regulační požadavky
      - Dodrženy politiky
      - Adekvátní ochrany soukromí
      - Úplná auditní stopa
    
    typical_duration: 2_to_6_hours
  
  business:
    description: Kontrola obchodní hodnoty a priority
    
    triggers:
      - high_business_impact
      - strategic_initiative
      - customer_facing_changes
      - commercial_implications
    
    reviewer_qualifications:
      - Expertiza obchodní domény
      - Zkušenosti s řízením produktů
      - Porozumění zákazníkům
    
    review_focus:
      - Sladění obchodní hodnoty
      - Dopad na zákazníky
      - Tržní pozicování
      - Strategické přizpůsobení
      - Komerční životaschopnost
    
    approval_criteria:
      - Jasná obchodní hodnota
      - Přijatelný dopad na zákazníky
      - Potvrzeno strategické sladění
      - Solidní obchodní model
    
    typical_duration: 1_to_3_hours
  
  operational:
    description: Kontrola provozní připravenosti a dopadu
    
    triggers:
      - target_environment in [STAGING, PROD]
      - operational_impact >= MODERATE
      - infrastructure_changes
      - capacity_implications
    
    reviewer_qualifications:
      - Expertiza v provozu
      - Zkušenosti s provozní podporou
      - Schopnosti reakce na incidenty
    
    review_focus:
      - Provozní připravenost
      - Monitorování a upozorňování
      - Postupy návratu
      - Připravenost podpory
      - Plánování kapacity
      - Dopad na existující systémy
    
    approval_criteria:
      - Tým operací připraven
      - Adekvátní monitorování
      - Validován návrat
      - Připravena podpora
      - Dostatečná kapacita
    
    typical_duration: 2_to_4_hours

routing_rules:
  automatic_routing:
    rules:
      - if: target_environment == PROD
        then: route_to [technical, security, operational]
      
      - if: security_sensitive_changes == true
        then: route_to [security]
      
      - if: compliance_flags_present == true
        then: route_to [compliance]
      
      - if: estimated_impact >= SIGNIFICANT
        then: route_to [technical, business, operational]
      
      - if: estimated_impact == MODERATE
        then: route_to [technical]
      
      - if: estimated_impact == MINIMAL
        then: skip_review
  
  manual_routing_override:
    allowed: true
    authority: CP-Governor
    rationale_required: true

multi_lane_coordination:
  parallel_review:
    allowed: true
    lanes_can_run_parallel:
      - technical and security
      - technical and compliance
      - business and operational
  
  sequential_review:
    required_when:
      - Zjištění kontroly blokují jiné kontroly
      - Vzájemné závislosti mezi liniemi
  
  conflict_resolution:
    - Pokud se linie neshodnou na schválení, eskalujte ke správě
    - Dokumentujte nesouhlas a odůvodnění
    - Správa činí konečné rozhodnutí

review_timeouts:
  by_lane:
    technical: 48_hours
    security: 72_hours
    compliance: 72_hours
    business: 24_hours
    operational: 48_hours
  
  escalation_on_timeout:
    - Upozornit kontrolora a správu
    - Eskalovat ke správci kontroly
    - Může pokračovat s částečnou kontrolou, pokud je riziko přijatelné

reviewer_assignment:
  assignment_criteria:
    - Dostupnost kontrolora
    - Relevantní expertiza
    - Žádný konflikt zájmů
    - Vyvážení pracovní zátěže
  
  assignment_process:
    1. Identifikovat požadované kontrolní linie
    2. Přiřadit linie dostupným kontrolorům
    3. Zkontrolovat kvalifikace kontrolora
    4. Ověřit dostupnost
    5. Přiřadit a upozornit
  
  reassignment:
    allowed_if:
      - Kontrolor nedostupný
      - Zjištěn nesoulad expertízy
      - Identifikován konflikt zájmů

review_completion:
  required_outputs:
    - Rozhodnutí kontroly (APPROVE/REJECT/NEEDS_WORK)
    - Dokument zjištění kontroly
    - Posouzení rizika
    - Doporučení
  
  approval_requirements:
    - Všechny přiřazené linie musí schválit
    - Žádná nevyřešená kritická zjištění
    - Všechna doporučení vyřešena nebo přijata
  
  rejection_handling:
    - Dokumentovat důvod odmítnutí
    - Poskytnout konkrétní zpětnou vazbu
    - Navrhnout nápravné kroky
    - Umožnit opětovné podání po opravách

adaptation_guidelines:
  domains_may_customize:
    - Definice kontrolních linií
    - Spouštěče směrování
    - Kvalifikace kontrolorů
    - Oblasti zaměření kontroly
    - Kritéria schválení
    - Hodnoty časového limitu
  
  domains_must_preserve:
    - Požadavek kontroly pro vysoce rizikové artefakty
    - Požadavek schválení pro produkci
    - Mechanismus eskalace
    - Požadavky na dokumentaci

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/18_ApprovalEscalationMatrix.yaml" <<'EOF'
# Matice Schvalování a Eskalace - Výchozí Doména
# Status: ADAPTIVE
# Definuje schvalovací cesty a eskalační pravidla

approval_levels:
  standard:
    authority: TECHNICAL_LEAD
    scope:
      - Nasazení vývojové a staging
      - Nízkorizikové až středně rizikové změny
      - Standardní provozní změny
    
    approval_requirements:
      - Technická kontrola schválena
      - Žádné příznaky souladu
      - Standardní testování dokončeno
    
    typical_turnaround: 4_hours
  
  elevated:
    authority: ENGINEERING_MANAGER
    scope:
      - Produkční nasazení (nízké riziko)
      - Změny významného dopadu
      - Změny související s bezpečností
      - Změny označené sladěním
    
    approval_requirements:
      - Technická a bezpečnostní kontrola schválena
      - Kontrola souladu schválena (pokud označeno)
      - Komplexní testování dokončeno
      - Plán návratu validován
    
    typical_turnaround: 24_hours
  
  executive:
    authority: EXECUTIVE_AUTHORITY
    scope:
      - Vysoce riziková produkční nasazení
      - Změny velkého dopadu
      - Strategické iniciativy
      - Regulačně významné změny
    
    approval_requirements:
      - Všechny kontrolní linie schváleny
      - Plán zmírnění rizika schválen
      - Poskytnut výkonný briefing
      - Potvrzeno sladění zúčastněných stran
    
    typical_turnaround: 72_hours

escalation_triggers:
  automatic_escalation:
    conditions:
      - risk_level == MAJOR
      - target_environment == PROD AND estimated_impact >= SIGNIFICANT
      - compliance_trigger_active
      - security_critical_changes
      - previous_failure_in_same_area
      - regulatory_implications
    
    escalation_target: EXECUTIVE
    
    escalation_requirements:
      - Připravit výkonný briefing
      - Dokumentovat zmírnění rizika
      - Validovat postupy návratu
      - Potvrdit sladění zúčastněných stran
  
  conditional_escalation:
    conditions:
      - risk_level == SIGNIFICANT AND target_environment == PROD
      - multiple_review_lanes_required
      - business_critical_changes
    
    escalation_target: ELEVATED
    
    escalation_requirements:
      - Komplexní výsledky testů
      - Bezpečnostní validace
      - Potvrzena provozní připravenost
  
  manual_escalation:
    triggers:
      - Kontrolor požaduje eskalaci
      - Schvalovatel není jistý autoritou
      - Zúčastněná strana vyjadřuje významné obavy
      - Identifikováno neočekávané riziko
    
    escalation_process:
      - Dokumentovat důvod eskalace
      - Poskytnout plný kontext
      - Identifikovat vhodnou úroveň eskalace
      - Čekat na rozhodnutí vyšší autority

approval_workflow:
  standard_workflow:
    steps:
      1. Technická kontrola
      2. Schválení technického vedoucího
      3. Nasadit do cílového prostředí
    
    applicable_to:
      - Dev nasazení
      - Nízkorizikové staging nasazení
      - Změny dokumentace
  
  elevated_workflow:
    steps:
      1. Technická kontrola
      2. Bezpečnostní kontrola (pokud platí)
      3. Kontrola souladu (pokud platí)
      4. Schválení manažera inženýrství
      5. Nasadit do cílového prostředí
    
    applicable_to:
      - Nízkorizikové produkční nasazení
      - Staging nasazení s příznaky souladu
      - Změny související s bezpečností
  
  executive_workflow:
    steps:
      1. Všechny příslušné kontrolní linie
      2. Předběžné schválení manažera inženýrství
      3. Příprava výkonného briefingu
      4. Výkonná kontrola a schválení
      5. Konečná autorizace nasazení
      6. Nasadit s rozšířeným monitorováním
    
    applicable_to:
      - Vysoce riziková produkční nasazení
      - Strategické nebo regulační změny
      - Změny s velkým obchodním dopadem

delegation_rules:
  delegation_allowed:
    - Standardní schválení mohou být delegována kvalifikovaným zástupcům
    - Delegace musí být dokumentována
    - Delegovaná autorita má stejné odpovědnosti
  
  delegation_prohibited:
    - Výkonná schválení nelze delegovat
    - Schválení souladu nelze delegovat
    - Kritická bezpečnostní schválení nelze delegovat
  
  delegation_requirements:
    - Zástupce musí splňovat kvalifikační požadavky
    - Delegace musí být časově omezena
    - Delegace musí být odvolatelná

parallel_approvals:
  allowed_parallel:
    - Technické a bezpečnostní kontroly
    - Technické a kontroly souladu
    - Obchodní a provozní kontroly
  
  must_be_sequential:
    - Technická kontrola před schválením manažera
    - Schválení manažera před výkonným schválením
    - Všechny kontroly před konečným schválením nasazení

approval_timeout_handling:
  timeout_periods:
    standard: 24_hours
    elevated: 72_hours
    executive: 120_hours
  
  on_timeout:
    - Automatické upozornění schvalovateli
    - Upozornění manažeru schvalovatele
    - Eskalace na další úroveň, pokud není odpověď
    - Nikdy nepokračujte bez schválení

approval_revocation:
  revocation_allowed:
    - Schvalovatel objeví nové informace
    - Změní se posouzení rizika
    - Zjištěno porušení souladu
  
  revocation_process:
    - Dokumentovat důvod odvolání
    - Upozornit všechny zúčastněné strany
    - Zastavit nasazení, pokud probíhá
    - Vyžadovat opětovné schválení po nápravě
  
  revocation_authority:
    - Původní schvalovatel
    - Vyšší úroveň autority
    - Autorita souladu
    - Výkonná autorita

conditional_approvals:
  allowed: true
  
  conditions_types:
    - Nasadit pouze během specifikovaného časového okna
    - Nasadit s postupným zaváděním
    - Nasadit s rozšířeným monitorováním
    - Nasadit s připraveným pohotovostním týmem
  
  condition_enforcement:
    - Podmínky musí být splněny před nasazením
    - Porušení zneplatňuje schválení
    - Dodržování podmínek je auditováno

approval_documentation:
  required_for_all_approvals:
    - Identita schvalovatele
    - Časové razítko schválení
    - Úroveň schválení
    - Podmínky (pokud existují)
    - Odůvodnění rozhodnutí
  
  required_for_elevated_and_executive:
    - Kontrola posouzení rizika
    - Přijetí plánu zmírnění
    - Potvrzení sladění zúčastněných stran
    - Ověření připravenosti návratu

exceptional_circumstances:
  emergency_bypass:
    allowed: true
    authority: EXECUTIVE_ONLY
    
    conditions:
      - Řešení produkčního incidentu
      - Náprava bezpečnostní zranitelnosti
      - Naléhavá situace regulačního souladu
    
    requirements:
      - Předběžné výkonné schválení nebo ratifikace
      - Rozšířené auditní záznamy
      - Vyžadována poincidentní kontrola
      - Dokumentace získaných poznatků
  
  retroactive_approval:
    allowed: LIMITED
    
    applicable_to:
      - Pouze nouzové obejití
      - Musí být ratifikováno do 24 hodin
      - Vyžadována plná auditní stopa
    
    not_applicable_to:
      - Standardní nasazení
      - Plánovaná vydání
      - Neurgentní změny

adaptation_guidelines:
  domains_may_customize:
    - Definice úrovní schválení
    - Spouštěče eskalace
    - Schvalovací workflow
    - Časové limity
    - Delegační politiky
  
  domains_must_preserve:
    - Progresivní model schvalování
    - Schopnost eskalace
    - Výkonná autorita přepsání
    - Požadavky na auditní stopu
    - Schopnost reakce v nouzových případech

version: "1.0.0"
status: ADAPTIVE
EOF

echo ""
echo "Created domain knowledge files:"
printf '  - %s\n' \
  "$ROOT/knowledge/domains/default/10_DomainOntology.md" \
  "$ROOT/knowledge/domains/default/11_FramingRules.yaml" \
  "$ROOT/knowledge/domains/default/12_PrimitiveCatalog.yaml" \
  "$ROOT/knowledge/domains/default/13_DeliveryTopologyRules.yaml" \
  "$ROOT/knowledge/domains/default/14_RiskComplianceTriggers.yaml" \
  "$ROOT/knowledge/domains/default/15_CommercialPackagingRules.yaml" \
  "$ROOT/knowledge/domains/default/16_ClaimsEvidencePolicy.yaml" \
  "$ROOT/knowledge/domains/default/17_ReviewLaneRules.yaml" \
  "$ROOT/knowledge/domains/default/18_ApprovalEscalationMatrix.yaml"

echo ""
echo "Knowledge file pack creation complete!"
echo ""
echo "Summary:"
echo "  - 7 core knowledge files (INVARIANT)"
echo "  - 9 domain knowledge files (ADAPTIVE)"
echo "  - Total: 16 knowledge files"
