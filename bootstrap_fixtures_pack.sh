#!/usr/bin/env bash
set -euo pipefail

# Bootstrap script for test fixtures
# Generates contrasting scenario fixtures for acceptance testing

ROOT="${1:-gpts-decision-stack}"

echo "Generating test fixtures in $ROOT/tests/fixtures/"

# Create directory structure
mkdir -p \
  "$ROOT/tests/fixtures/founder-led" \
  "$ROOT/tests/fixtures/enterprise" \
  "$ROOT/tests/fixtures/regulated" \
  "$ROOT/tests/fixtures/enablement"

# Fixture 1: Invalid GPT framing
cat > "$ROOT/tests/fixtures/founder-led/framing-invalid.yaml" <<'EOF'
# Fixture: Neplatné rámcování GPT
# Účel: Testuje scénář, kdy artefakt obsahuje neplatné rámcování chování GPT
# Očekávaný výsledek: INTAKE_REJECTED z důvodu porušení pravidel rámcování

artifact:
  id: artifact-framing-001
  type: PACKAGE_RELEASE
  submitted_by: founder-team
  submission_timestamp: "2026-03-14T10:00:00Z"

framing:
  gpt_role: CP-Governor
  # INVALID: GPT role s explicitně zakázaným chováním
  prohibited_behavior_violation: true
  behaviors:
    - Obcházení kontrol autority  # Explicitně zakázáno v 11_FramingRules.yaml
    - Úprava auditních stop      # Explicitně zakázáno

claims:
  functional_correctness:
    - "Změna funguje podle specifikace"

evidence:
  automated_test_results:
    status: PASS
    coverage: 85

metadata:
  domain: founder-led
  priority: standard
  expected_gate_result: INTAKE_REJECTED
  reason: "Porušení pravidel rámcování - použití zakázaného chování"
EOF

# Fixture 2: Claims verification failure
cat > "$ROOT/tests/fixtures/founder-led/claims-fail.yaml" <<'EOF'
# Fixture: Selhání ověření tvrzení
# Účel: Testuje scénář, kdy tvrzení nejsou dostatečně podpořena důkazy
# Očekávaný výsledek: CLAIMS_INSUFFICIENT

artifact:
  id: artifact-claims-001
  type: PACKAGE_RELEASE
  submitted_by: founder-team
  submission_timestamp: "2026-03-14T10:00:00Z"

claims:
  functional_correctness:
    - "Nová funkce funguje podle specifikace"
    - "Všechna kritéria akceptace jsou splněna"
  
  quality_assurance:
    - "Kód splňuje standardy kvality"

evidence:
  # NEDOSTATEČNÉ: Pokrytí testů pod požadovanými 80%
  automated_test_results:
    status: PASS
    coverage: 45  # Pod požadovanými 80% dle 16_ClaimsEvidencePolicy.yaml
  
  # CHYBÍ: manual_test_results vyžadováno pro funkční správnost
  # CHYBÍ: code_review_results vyžadováno pro zajištění kvality

metadata:
  domain: founder-led
  priority: standard
  expected_state: CLAIMS_INSUFFICIENT
  reason: "Nedostatečné pokrytí testů a chybějící důkazy kontroly kódu"
EOF

# Fixture 3: Wrong primitive usage
cat > "$ROOT/tests/fixtures/founder-led/wrong-primitive.yaml" <<'EOF'
# Fixture: Nesprávné primitivum
# Účel: Testuje scénář, kdy se používá neexistující nebo nesprávné primitivum
# Očekávaný výsledek: INTAKE_REJECTED z důvodu neplatné operace

artifact:
  id: artifact-primitive-001
  type: CONFIGURATION_CHANGE
  submitted_by: founder-team
  submission_timestamp: "2026-03-14T10:00:00Z"

requested_operations:
  # NEPLATNÉ: Primitiva, která neexistují v 12_PrimitiveCatalog.yaml
  - operation: bypass_governance_check  # Neexistuje
    parameters:
      target_state: REVIEW_APPROVED
  
  - operation: force_state_transition  # Neexistuje
    from: SUBMITTED
    to: CLAIMS_VERIFIED

claims:
  functional_correctness:
    - "Konfigurace je správná"

evidence:
  manual_test_results:
    status: PASS

metadata:
  domain: founder-led
  priority: standard
  expected_gate_result: INTAKE_REJECTED
  reason: "Použití neexistujících primitiv - porušení katalogu operací"
EOF

# Fixture 4: Active operational veto
cat > "$ROOT/tests/fixtures/enterprise/active-risk-veto.yaml" <<'EOF'
# Fixture: Aktivní provozní veto
# Účel: Testuje scénář, kdy provozní tým uplatňuje veto
# Očekávaný výsledek: RELEASE_BLOCKED z důvodu provozních podmínek

artifact:
  id: artifact-veto-001
  type: PACKAGE_RELEASE
  submitted_by: enterprise-team
  submission_timestamp: "2026-03-14T10:00:00Z"
  target_environment: prod

claims:
  functional_correctness:
    - "Balíček prošel všemi testy"
  
  operational_readiness:
    - "Systém je připraven k nasazení"

evidence:
  automated_test_results:
    status: PASS
    coverage: 92
  
  acceptance_test_results:
    status: PASS
    all_criteria_met: true
  
  code_review_results:
    status: APPROVED
    reviewer: senior-engineer

operational_context:
  # SPOUŠTĚČ VETA: Probíhá produkční incident dle 14_RiskComplianceTriggers.yaml
  active_production_incident:
    incident_id: INC-2026-001
    severity: critical
    status: investigating
    started: "2026-03-14T09:00:00Z"
  
  # SPOUŠTĚČ VETA: Nedávné produkční selhání
  recent_production_failure:
    timestamp: "2026-03-13T22:00:00Z"
    component: payment-service
    resolved: false

veto:
  applied: true
  authority: OPERATIONAL_TEAM
  reason: "Probíhající kritický incident a nedávné selhání produkce"
  expected_resolution: "2026-03-15T00:00:00Z"

metadata:
  domain: enterprise
  risk_level: MAJOR
  expected_state: RELEASE_BLOCKED
  reason: "Provozní veto z důvodu aktivního incidentu"
EOF

# Fixture 5: Missing claims evidence
cat > "$ROOT/tests/fixtures/founder-led/missing-claims-evidence.yaml" <<'EOF'
# Fixture: Chybějící důkazy tvrzení
# Účel: Testuje scénář, kdy tvrzení jsou uvedena, ale zcela chybí důkazy
# Očekávaný výsledek: CLAIMS_INSUFFICIENT

artifact:
  id: artifact-missing-evidence-001
  type: PACKAGE_RELEASE
  submitted_by: founder-team
  submission_timestamp: "2026-03-14T10:00:00Z"

claims:
  functional_correctness:
    - "Nová funkce je plně implementována"
    - "Všechny požadavky jsou splněny"
    - "Kritéria akceptace projdou"
  
  quality_assurance:
    - "Kód je udržovatelný"
    - "Výkon je adekvátní"
  
  security:
    - "Bezpečnostní kontroly projdou"

# CHYBÍ: Veškeré důkazy (evidence sekce zcela chybí nebo je prázdná)
evidence: {}

metadata:
  domain: founder-led
  priority: standard
  expected_state: CLAIMS_INSUFFICIENT
  reason: "Tvrzení uvedena, ale žádné důkazy poskytnuty"
EOF

# Fixture 6: Unsupported claims
cat > "$ROOT/tests/fixtures/founder-led/unsupported-claims.yaml" <<'EOF'
# Fixture: Nepodporovaná tvrzení
# Účel: Testuje scénář, kdy jsou uvedena tvrzení mimo definované kategorie
# Očekávaný výsledek: INTAKE_REJECTED

artifact:
  id: artifact-unsupported-001
  type: PACKAGE_RELEASE
  submitted_by: founder-team
  submission_timestamp: "2026-03-14T10:00:00Z"

claims:
  # NEPLATNÉ: Kategorie tvrzení, která neexistuje v 16_ClaimsEvidencePolicy.yaml
  marketing_effectiveness:
    - "Zvýší konverzi o 50%"
    - "Uživatelé to budou milovat"
  
  # NEPLATNÉ: Další nepodporovaná kategorie
  competitive_advantage:
    - "Lepší než konkurence"
  
  # Platné tvrzení, ale nedostatečné pro celek
  functional_correctness:
    - "Kód se kompiluje"

evidence:
  automated_test_results:
    status: PASS
    coverage: 85

metadata:
  domain: founder-led
  priority: standard
  expected_gate_result: INTAKE_REJECTED
  reason: "Použití nepodporovaných kategorií tvrzení"
EOF

# Fixture 7: Legal review required
cat > "$ROOT/tests/fixtures/enterprise/procurement-legal-required.yaml" <<'EOF'
# Fixture: Vyžadována právní kontrola
# Účel: Testuje scénář spouštěče právní kontroly pro podnikové nasazení
# Očekávaný výsledek: REVIEW_REQUIRED s právní kontrolou

artifact:
  id: artifact-legal-001
  type: PACKAGE_RELEASE
  submitted_by: enterprise-team
  submission_timestamp: "2026-03-14T10:00:00Z"
  target_environment: prod

changes:
  # SPOUŠTĚČ: Změny zásad ochrany osobních údajů dle 14_RiskComplianceTriggers.yaml
  privacy_policy_changes:
    - "Aktualizace doby uchovávání dat uživatele"
    - "Nová politika sdílení dat s třetími stranami"
  
  # SPOUŠTĚČ: Přenos dat přes hranice
  data_transfer:
    regions:
      - EU
      - US
    cross_border: true
    data_types:
      - personal_information
      - transaction_history

claims:
  functional_correctness:
    - "Změny implementovány správně"
  
  legal_compliance:
    - "Splňuje GDPR požadavky"
    - "Dodržuje místní předpisy"

evidence:
  automated_test_results:
    status: PASS
    coverage: 88
  
  code_review_results:
    status: APPROVED
    reviewer: senior-engineer
  
  # CHYBÍ: legal_review_memo vyžadováno pro právní kontrolu

compliance_triggers:
  legal_review_required: true
  reason: "Změny zásad ochrany osobních údajů a přenos dat přes hranice"
  review_authority: LEGAL_TEAM

metadata:
  domain: enterprise
  risk_level: SIGNIFICANT
  expected_state: REVIEW_REQUIRED
  required_reviews:
    - LEGAL_TEAM
  reason: "Právní kontrola vyžadována pro změny ochrany osobních údajů"
EOF

# Fixture 8: Mandatory approval matrix
cat > "$ROOT/tests/fixtures/regulated/mandatory-approval-matrix.yaml" <<'EOF'
# Fixture: Povinná schvalovací matice
# Účel: Testuje scénář vyžadující výkonné schválení pro regulované prostředí
# Očekávaný výsledek: APPROVAL_REQUIRED na úrovni EXECUTIVE

artifact:
  id: artifact-regulated-001
  type: PACKAGE_RELEASE
  submitted_by: regulated-team
  submission_timestamp: "2026-03-14T10:00:00Z"
  target_environment: prod
  industry: healthcare

risk_assessment:
  # Risk level MAJOR vyžaduje výkonné schválení dle 14_RiskComplianceTriggers.yaml
  risk_level: MAJOR
  criteria_met:
    - Produkční nasazení
    - Vysoký dopad na uživatele
    - Zapojená migrace dat
    - Obtížný návrat

changes:
  data_migration:
    scope: patient_records
    record_count: 1500000
    reversibility: difficult
  
  system_impact:
    affected_users: 50000
    downtime_required: true
    critical_path: true

claims:
  functional_correctness:
    - "Migrace dat testována"
    - "Plán návratu validován"
  
  regulatory_compliance:
    - "Splňuje HIPAA požadavky"
    - "Auditní stopa zachována"

evidence:
  automated_test_results:
    status: PASS
    coverage: 95
  
  acceptance_test_results:
    status: PASS
    all_criteria_met: true
  
  security_review_results:
    status: APPROVED
    reviewer: security-team
  
  compliance_review_results:
    status: APPROVED
    reviewer: compliance-officer

required_approvals:
  # 18_ApprovalEscalationMatrix.yaml - EXECUTIVE level vyžadováno
  approval_level: EXECUTIVE
  escalation_trigger: MAJOR_risk_level
  required_reviewers:
    - SECURITY_TEAM
    - COMPLIANCE_TEAM
    - LEGAL_TEAM
  
  additional_requirements:
    - Plán postupného zavádění
    - 24/7 pokrytí podpory
    - Výkonný briefing připraven

metadata:
  domain: regulated
  industry: healthcare
  risk_level: MAJOR
  expected_state: APPROVAL_REQUIRED
  approval_level: EXECUTIVE
  reason: "MAJOR risk level vyžaduje výkonné schválení pro produkci"
EOF

# Fixture 9: Non-sales internal
cat > "$ROOT/tests/fixtures/enablement/non-sales-internal.yaml" <<'EOF'
# Fixture: Interní bez prodeje
# Účel: Testuje scénář interního enablementu bez komerčních dopadů
# Očekávaný výsledek: MINIMAL risk, STANDARD approval

artifact:
  id: artifact-enablement-001
  type: CONFIGURATION_CHANGE
  submitted_by: enablement-team
  submission_timestamp: "2026-03-14T10:00:00Z"
  target_environment: dev

changes:
  documentation_updates:
    - "Aktualizace interní wiki"
    - "Nové příklady použití API"
  
  configuration:
    environment: dev
    scope: internal_tooling
    user_impact: none

risk_assessment:
  # Risk level MINIMAL dle 14_RiskComplianceTriggers.yaml
  risk_level: MINIMAL
  criteria_met:
    - Pouze změny dokumentace
    - Neprodukční prostředí
    - Žádný dopad na uživatele
    - Plně reverzibilní

claims:
  functional_correctness:
    - "Dokumentace je přesná"
    - "Příklady jsou funkční"

evidence:
  manual_test_results:
    status: PASS
    examples_verified: true
  
  peer_review:
    status: APPROVED
    reviewer: team-lead

packaging:
  # Žádné komerční balení - interní použití
  commercial: false
  internal_only: true
  distribution: team_access

required_approvals:
  approval_level: STANDARD
  additional_requirements: []

metadata:
  domain: enablement
  risk_level: MINIMAL
  environment: dev
  expected_state: REVIEW_APPROVED
  approval_level: STANDARD
  reason: "Minimální riziko pro interní změny bez prodeje"
EOF

# Fixture 10: Partial intake submission
cat > "$ROOT/tests/fixtures/founder-led/partial-intake.yaml" <<'EOF'
# Fixture: Částečný příjem
# Účel: Testuje scénář neúplného odeslání při příjmu
# Očekávaný výsledek: INTAKE_REJECTED z důvodu neúplnosti

artifact:
  id: artifact-partial-001
  type: PACKAGE_RELEASE
  submitted_by: founder-team
  submission_timestamp: "2026-03-14T10:00:00Z"

# NEÚPLNÉ: Chybí základní povinné pole podle 03_ArtifactSchemas.yaml
# claims: {}  # Chybí celá sekce tvrzení

# NEÚPLNÉ: Částečné informace o změnách
changes:
  description: "Nějaké změny byly provedeny"
  # CHYBÍ: Specifické detaily změn
  # CHYBÍ: Dotčené komponenty
  # CHYBÍ: Analýza dopadů

# NEÚPLNÉ: Žádné důkazy
# evidence: {}  # Chybí

# NEÚPLNÉ: Základní metadata chybí
metadata:
  domain: founder-led
  # CHYBÍ: priority
  # CHYBÍ: target_environment
  # CHYBÍ: submitter_details
  expected_gate_result: INTAKE_REJECTED
  reason: "Neúplné odeslání - chybí tvrzení, důkazy a základní metadata"

completeness_check:
  required_fields_present:
    artifact_id: true
    artifact_type: true
    submitted_by: true
    claims: false  # CHYBÍ
    evidence: false  # CHYBÍ
    changes_detail: false  # NEÚPLNÉ
    metadata_complete: false  # NEÚPLNÉ
  
  overall_completeness: 40  # Pod minimální prahovou hodnotou
EOF

echo ""
echo "✓ Created 10 fixture files:"
echo "  - founder-led: 6 fixtures"
echo "  - enterprise: 2 fixtures"
echo "  - regulated: 1 fixture"
echo "  - enablement: 1 fixture"
echo ""

# Validate YAML syntax
echo "Validating YAML syntax..."
for fixture in "$ROOT"/tests/fixtures/**/*.yaml; do
  if [ -f "$fixture" ]; then
    python3 -c "import yaml; yaml.safe_load(open('$fixture'))" && echo "  ✓ $(basename $fixture)" || echo "  ✗ $(basename $fixture) FAILED"
  fi
done

echo ""
echo "Fixture pack generation complete!"
