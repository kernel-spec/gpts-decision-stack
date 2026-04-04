#!/usr/bin/env bash

set -u

BASE_URL="${BASE_URL:-}"
API_KEY="${API_KEY:-}"
CF_ENV="${CF_ENV:-dev}"
D1_DATABASE_NAME="${D1_DATABASE_NAME:-gpts-decision-stack-db-dev}"
WORKER_DIR="${WORKER_DIR:-/workspaces/gpts-decision-stack/backend/worker}"
AGENT_ID="${AGENT_ID:-operator-001}"

PASS_COUNT=0
FAIL_COUNT=0

SESSION_ID=""
SESSION_ID_FAIL=""
ARTIFACT_ID_FIRST=""

HTTP_STATUS=""
HTTP_BODY=""
D1_RC=0
D1_OUT=""

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'FATAL: required command not found: %s\n' "$1" >&2
    exit 2
  fi
}

fail() {
  printf 'FAIL: %s\n' "$1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

pass() {
  printf 'PASS: %s\n' "$1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

check_eq() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label (expected=$expected actual=$actual)"
  else
    fail "$label (expected=$expected actual=$actual)"
  fi
}

check_nonempty() {
  local label="$1"
  local value="$2"
  if [[ -n "$value" && "$value" != "null" && "$value" != "undefined" ]]; then
    pass "$label"
  else
    fail "$label (value is empty)"
  fi
}

check_http_status() {
  local label="$1"
  local expected="$2"
  check_eq "$label" "$HTTP_STATUS" "$expected"
}

json_get() {
  local path="$1"
  local input="${2:-$HTTP_BODY}"
  JSON_PATH="$path" JSON_INPUT="$input" node <<'NODE'
const path = process.env.JSON_PATH;
const input = process.env.JSON_INPUT;
const data = JSON.parse(input);
const parts = path.split('.');
let current = data;
for (const part of parts) {
  if (current === null || current === undefined) {
    process.exit(1);
  }
  if (/^\d+$/.test(part)) {
    current = current[Number(part)];
  } else {
    current = current[part];
  }
}
if (current === undefined || current === null) {
  process.exit(1);
}
if (typeof current === 'object') {
  process.stdout.write(JSON.stringify(current));
} else {
  process.stdout.write(String(current));
}
NODE
}

api_call() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local tmp
  tmp="$(mktemp)"
  if [[ -n "$body" ]]; then
    HTTP_STATUS="$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "$BASE_URL$path" -H 'Content-Type: application/json' -H "X-API-Key: $API_KEY" -d "$body")"
  else
    HTTP_STATUS="$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "$BASE_URL$path" -H "X-API-Key: $API_KEY")"
  fi
  HTTP_BODY="$(cat "$tmp")"
  rm -f "$tmp"
  printf '\n=== HTTP %s %s -> %s ===\n' "$method" "$path" "$HTTP_STATUS"
  printf '%s\n' "$HTTP_BODY"
}

d1_exec() {
  local sql="$1"
  set +e
  D1_OUT="$(cd "$WORKER_DIR" && wrangler d1 execute "$D1_DATABASE_NAME" --env "$CF_ENV" --command "$sql" --json 2>&1)"
  D1_RC=$?
  set -e
  printf '\n=== D1 SQL ===\n%s\n' "$sql"
  printf '%s\n' "$D1_OUT"
}

d1_value() {
  local sql="$1"
  local column="$2"
  d1_exec "$sql"
  if [[ $D1_RC -ne 0 ]]; then
    return 1
  fi
  D1_COLUMN="$column" D1_JSON="$D1_OUT" node <<'NODE'
const column = process.env.D1_COLUMN;
const raw = process.env.D1_JSON;
const data = JSON.parse(raw);

function extractRows(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractRows(item);
      if (nested) return nested;
    }
    return null;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (Array.isArray(value.results)) {
    return value.results;
  }
  if (Array.isArray(value.result)) {
    for (const item of value.result) {
      const nested = extractRows(item);
      if (nested) return nested;
    }
  }
  for (const nestedValue of Object.values(value)) {
    const nested = extractRows(nestedValue);
    if (nested) return nested;
  }
  return null;
}

const rows = extractRows(data) ?? [];
if (!rows.length) {
  process.exit(1);
}
const row = rows[0] ?? {};
const value = row[column];
if (value === undefined || value === null) {
  process.exit(1);
}
process.stdout.write(String(value));
NODE
}

print_section() {
  printf '\n%s\n' "$1"
}

need_cmd curl
need_cmd node
need_cmd wrangler

if [[ -z "$BASE_URL" || -z "$API_KEY" ]]; then
  printf 'FATAL: set BASE_URL and API_KEY before running this script.\n' >&2
  exit 2
fi

if [[ ! -d "$WORKER_DIR" ]]; then
  printf 'FATAL: WORKER_DIR does not exist: %s\n' "$WORKER_DIR" >&2
  exit 2
fi

set -e

print_section '1. Create session'
api_call POST /session '{"requestor_type":"founder-led"}'
check_http_status 'create session returns 201' '201'
SESSION_ID="$(json_get ok >/dev/null 2>&1 && json_get data.session_id || true)"
check_nonempty 'session_id returned' "$SESSION_ID"

if [[ -n "$SESSION_ID" ]]; then
  SESSION_STATE="$(json_get data.pipeline_state || true)"
  check_eq 'session starts in intake' "$SESSION_STATE" 'intake'

  if SESSION_DB_STATE="$(d1_value "SELECT pipeline_state AS value FROM sessions WHERE session_id = '$SESSION_ID';" value 2>/dev/null)"; then
    check_eq 'sessions row exists with intake state' "$SESSION_DB_STATE" 'intake'
  else
    fail 'sessions lookup after create session'
  fi

  if SESSION_DB_DECISION="$(d1_value "SELECT decision_status AS value FROM sessions WHERE session_id = '$SESSION_ID';" value 2>/dev/null)"; then
    check_eq 'session decision_status starts unresolved' "$SESSION_DB_DECISION" 'unresolved'
  else
    fail 'session decision_status lookup after create session'
  fi
fi

print_section '2. Submit non-transition artifact in intake'
api_call POST "/session/$SESSION_ID/artifact" '{
  "artifact_type": "FramingAssessment",
  "payload": {
    "summary": "testing non-transition artifact"
  },
  "agent_id": "operator-001",
  "parser_verdict": {
    "schema_valid": true,
    "required_sections_present": true,
    "stage_matches_expected": true,
    "reentry_ready": true
  }
}'
check_http_status 'non-transition artifact returns 201' '201'
ARTIFACT_ID_FIRST="$(json_get data.id || true)"
check_nonempty 'non-transition artifact id returned' "$ARTIFACT_ID_FIRST"

HANDOFF_COUNT_AFTER_NON_TRANSITION=""
if HANDOFF_COUNT_AFTER_NON_TRANSITION="$(d1_value "SELECT COUNT(*) AS value FROM handoff_events WHERE session_id = '$SESSION_ID';" value 2>/dev/null)"; then
  check_eq 'non-transition artifact does not create handoff row' "$HANDOFF_COUNT_AFTER_NON_TRANSITION" '0'
else
  fail 'handoff_events query after non-transition artifact'
fi

if FIRST_ATTEMPT="$(d1_value "SELECT attempt AS value FROM artifact_lineage WHERE run_id = '$SESSION_ID' AND artifact_id = '$ARTIFACT_ID_FIRST';" value 2>/dev/null)"; then
  check_eq 'first lineage attempt is 1' "$FIRST_ATTEMPT" '1'
else
  fail 'artifact_lineage first attempt lookup'
fi

if FIRST_REASON="$(d1_value "SELECT COALESCE(replacement_reason, 'NULL') AS value FROM artifact_lineage WHERE run_id = '$SESSION_ID' AND artifact_id = '$ARTIFACT_ID_FIRST';" value 2>/dev/null)"; then
  check_eq 'first lineage replacement_reason is NULL' "$FIRST_REASON" 'NULL'
else
  fail 'artifact_lineage replacement_reason lookup for first attempt'
fi

print_section '3. Submit repair attempt in same stage'
api_call POST "/session/$SESSION_ID/artifact" '{
  "artifact_type": "FramingAssessment",
  "payload": {
    "summary": "testing repair attempt in same stage"
  },
  "agent_id": "operator-001",
  "parser_verdict": {
    "schema_valid": true,
    "required_sections_present": true,
    "stage_matches_expected": true,
    "reentry_ready": true
  }
}'
check_http_status 'repair attempt artifact returns 201' '201'
ARTIFACT_ID_SECOND="$(json_get data.id || true)"
check_nonempty 'repair attempt artifact id returned' "$ARTIFACT_ID_SECOND"

if SECOND_ATTEMPT="$(d1_value "SELECT attempt AS value FROM artifact_lineage WHERE run_id = '$SESSION_ID' AND artifact_id = '$ARTIFACT_ID_SECOND';" value 2>/dev/null)"; then
  check_eq 'repair attempt increments attempt to 2' "$SECOND_ATTEMPT" '2'
else
  fail 'artifact_lineage second attempt lookup'
fi

if SECOND_SUPERSEDES="$(d1_value "SELECT COALESCE(supersedes_artifact_id, 'NULL') AS value FROM artifact_lineage WHERE run_id = '$SESSION_ID' AND artifact_id = '$ARTIFACT_ID_SECOND';" value 2>/dev/null)"; then
  if [[ "$SECOND_SUPERSEDES" != 'NULL' ]]; then
    pass 'repair attempt sets supersedes_artifact_id'
  else
    fail 'repair attempt sets supersedes_artifact_id'
  fi
else
  fail 'artifact_lineage supersedes lookup for repair attempt'
fi

if SECOND_REASON="$(d1_value "SELECT COALESCE(replacement_reason, 'NULL') AS value FROM artifact_lineage WHERE run_id = '$SESSION_ID' AND artifact_id = '$ARTIFACT_ID_SECOND';" value 2>/dev/null)"; then
  if [[ "$SECOND_REASON" != 'NULL' ]]; then
    pass 'repair attempt sets replacement_reason'
  else
    fail 'repair attempt sets replacement_reason'
  fi
else
  fail 'artifact_lineage replacement_reason lookup for repair attempt'
fi

print_section '4. Submit transition artifact'
api_call POST "/session/$SESSION_ID/artifact" '{
  "artifact_type": "ProblemBrief",
  "payload": {
    "title": "Need to validate early customer demand"
  },
  "agent_id": "operator-001",
  "parser_verdict": {
    "schema_valid": true,
    "required_sections_present": true,
    "stage_matches_expected": true,
    "reentry_ready": true
  }
}'
check_http_status 'transition artifact returns 201' '201'

if POST_TRANSITION_STATE="$(d1_value "SELECT pipeline_state AS value FROM sessions WHERE session_id = '$SESSION_ID';" value 2>/dev/null)"; then
  check_eq 'session transitions to problem_framing' "$POST_TRANSITION_STATE" 'problem_framing'
else
  fail 'session state lookup after transition artifact'
fi

if TRANSITION_HANDOFF_COUNT="$(d1_value "SELECT COUNT(*) AS value FROM handoff_events WHERE session_id = '$SESSION_ID';" value 2>/dev/null)"; then
  if [[ "$TRANSITION_HANDOFF_COUNT" -ge 1 ]]; then
    pass 'transition artifact created at least one handoff row'
  else
    fail 'transition artifact created at least one handoff row'
  fi
else
  fail 'handoff_events lookup after transition artifact'
fi

print_section '5. Failed transition scenario'
api_call POST /session '{"requestor_type":"founder-led"}'
check_http_status 'failed-flow session returns 201' '201'
SESSION_ID_FAIL="$(json_get data.session_id || true)"
check_nonempty 'failed-flow session_id returned' "$SESSION_ID_FAIL"

api_call POST "/session/$SESSION_ID_FAIL/artifact" '{
  "artifact_type": "ProblemBrief",
  "payload": {
    "title": "broken schema case"
  },
  "agent_id": "operator-001",
  "parser_verdict": {
    "schema_valid": false,
    "required_sections_present": true,
    "stage_matches_expected": true,
    "reentry_ready": true
  }
}'
check_http_status 'failed transition artifact request returns 201 or classified response' '201'

if FAIL_OUTCOME="$(d1_value "SELECT COALESCE(outcome, 'NULL') AS value FROM handoff_events WHERE session_id = '$SESSION_ID_FAIL' ORDER BY classified_at DESC LIMIT 1;" value 2>/dev/null)"; then
  check_eq 'failed transition creates FAILED handoff row' "$FAIL_OUTCOME" 'FAILED'
else
  fail 'handoff_events lookup for failed transition scenario'
fi

if FAIL_REASON="$(d1_value "SELECT COALESCE(failure_reason, 'NULL') AS value FROM handoff_events WHERE session_id = '$SESSION_ID_FAIL' ORDER BY classified_at DESC LIMIT 1;" value 2>/dev/null)"; then
  if [[ "$FAIL_REASON" != 'NULL' ]]; then
    pass 'failed transition stores failure_reason'
  else
    fail 'failed transition stores failure_reason'
  fi
else
  fail 'handoff failure_reason lookup for failed transition scenario'
fi

print_section '6. Reentry loop detection'
api_call POST "/session/$SESSION_ID/reentry" '{
  "from_state": "problem_framing",
  "to_state": "problem_framing",
  "reason": "retry same stage",
  "agent_id": "operator-001"
}'
check_http_status 'first reentry returns 200' '200'

api_call POST "/session/$SESSION_ID/reentry" '{
  "from_state": "problem_framing",
  "to_state": "problem_framing",
  "reason": "retry same stage again",
  "agent_id": "operator-001"
}'
check_http_status 'second reentry returns 200' '200'

if STAGE_ENTRY_COUNT="$(d1_value "SELECT entry_count AS value FROM stage_entries WHERE session_id = '$SESSION_ID' AND pipeline_state = 'problem_framing' ORDER BY created_at DESC LIMIT 1;" value 2>/dev/null)"; then
  check_eq 'same-stage reentry reaches entry_count=2' "$STAGE_ENTRY_COUNT" '2'
else
  fail 'stage_entries lookup after repeated reentry'
fi

if LOOP_TYPE="$(d1_value "SELECT loop_type AS value FROM stage_loop_signals WHERE session_id = '$SESSION_ID' ORDER BY created_at DESC LIMIT 1;" value 2>/dev/null)"; then
  check_eq 'loop signal is SAME_STAGE_REPEAT' "$LOOP_TYPE" 'SAME_STAGE_REPEAT'
else
  fail 'stage_loop_signals lookup after repeated reentry'
fi

print_section '7. Operator read model route'
api_call GET "/session/$SESSION_ID/delivery"
if [[ "$HTTP_STATUS" == '200' ]]; then
  READ_MODEL_STAGE="$(json_get data.current_stage || true)"
  READ_MODEL_ATTEMPT="$(json_get data.current_attempt || true)"
  READ_MODEL_HANDOFF="$(json_get data.handoff_status || true)"
  READ_MODEL_LOOP_FLAG="$(json_get data.loop_flag || true)"
  READ_MODEL_NEXT_ACTION="$(json_get data.next_action_code || true)"
  check_nonempty 'delivery read model returns current_stage' "$READ_MODEL_STAGE"
  check_nonempty 'delivery read model returns current_attempt' "$READ_MODEL_ATTEMPT"
  check_nonempty 'delivery read model returns handoff_status' "$READ_MODEL_HANDOFF"
  check_nonempty 'delivery read model returns loop_flag' "$READ_MODEL_LOOP_FLAG"
  check_nonempty 'delivery read model returns next_action_code' "$READ_MODEL_NEXT_ACTION"
else
  fail 'delivery read model route is available at /session/{session_id}/delivery'
fi

print_section '8. Summary'
printf 'PASS_COUNT=%s\n' "$PASS_COUNT"
printf 'FAIL_COUNT=%s\n' "$FAIL_COUNT"
printf 'SESSION_ID=%s\n' "$SESSION_ID"
printf 'SESSION_ID_FAIL=%s\n' "$SESSION_ID_FAIL"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
