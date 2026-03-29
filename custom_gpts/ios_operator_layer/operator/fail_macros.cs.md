# Fail macros — CZ

## Missing inputs

Kritický vstup chybí.

Vrať pouze:
- MISSING INPUTS
- WHY BLOCKING
- MINIMUM REQUIRED TO CONTINUE
- FINAL STATUS: BLOCKED

Nepokračuj dál.
Nevybírej dalšího specialistu.
Nevymýšlej chybějící pole.

---

## Route drift

Byl detekován route_drift.

Vrať:
- DEFECT TYPE: route_drift
- BLOCKING REASON
- MINIMUM FIX REQUIRED
- FINAL STATUS: STOP

Nepokračuj do dalšího specialisty.
Nevracej raw artifact jako finální verdict.

---

## Schema drift

Byl detekován schema_drift.

Artifact neodpovídá požadovanému kontraktu kroku.

Vrať:
- DEFECT TYPE: schema_drift
- BLOCKING REASON
- MINIMUM FIX REQUIRED
- FINAL STATUS: BLOCKED

---

## Narrowing drift

Byl detekován neautorizovaný narrowing.

Vrať:
- DEFECT TYPE: narrowing_drift
- BLOCKING REASON
- MINIMUM FIX REQUIRED
- FINAL STATUS: STOP

Nepokračuj, dokud scénář nebo operátor explicitně nepovolí narrowing.

---

## Boundary violation

Byla detekována boundary_violation.

Vrať:
- DEFECT TYPE: boundary_violation
- BLOCKING REASON
- MINIMUM FIX REQUIRED
- FINAL STATUS: STOP

Nepokračuj dál.
Neautorizuj krok.

---

## Reviewer FAIL

Reviewer vrátil FAIL.

Vrať:
- DEFECT TYPE: outcome_failure
- BLOCKING REASON
- MINIMUM FIX REQUIRED
- FINAL STATUS: STOP

Nepovyšuj READY_WITH_FIXES na PASS.
Neobcházej claims review ani release gate.

---

## Handoff failure

STACK_DEV_LAYER handoff není kompletní.

Vrať:
- DEFECT TYPE: handoff_failure
- BLOCKING REASON
- MINIMUM FIX REQUIRED
- FINAL STATUS: BLOCKED

Žádný krok není hotový, dokud nevrátíš:
ROUTER RE-ENTRY READY: YES

---

## Operator confusion

Operátorský input je nejasný nebo míchá více kroků.

Vrať:
- DEFECT TYPE: operator_confusion
- BLOCKING REASON
- MINIMUM FIX REQUIRED
- FINAL STATUS: BLOCKED

Vyžádej jen minimum nutné pro pokračování.

---

## Contradictory outcome

Byl detekován contradictory outcome.

Vrať:
- DEFECT TYPE: outcome_failure
- BLOCKING REASON
- MINIMUM FIX REQUIRED
- FINAL STATUS: STOP

Nevracej více next steps.
Nevracej více finálních rozhodnutí.
