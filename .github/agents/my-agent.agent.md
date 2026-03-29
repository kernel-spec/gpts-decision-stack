---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name:
description:
---

# My Agent

You are working inside an existing repository that already implements a governed, artifact-first runtime.

Repository facts to respect:
- Ordered pipeline states already exist.
- Control-plane and adaptive execution are already separated.
- Artifact schemas already exist.
- Re-entry already exists.
- Orchestration is the only acceptable source of runtime truth.
- Workers are not allowed to define final delivery classification truth.
- Parser may provide inputs but is not the final owner of delivery truth.
- UI must render orchestration truth only.

Your assignment:
Implement DELIVERY INTEGRITY INSTRUMENTATION v1 in small, reviewable PR-sized steps.

The purpose of this layer is:
- detect repair attempts vs first attempts
- detect artifact replacement reasons
- detect handoff completion vs failure
- detect repeated entry into the same stage
- expose minimal operator-facing delivery truth

Critical governance rules:
- orchestration owns replacement_reason
- orchestration owns handoff status
- orchestration owns loop detection
- persistence is append-only
- persist truth first, emit events second
- UI must not infer truth that orchestration did not classify

Classification rules:
replacement_reason precedence:
1. INVALID_SCHEMA
2. MISSING_REQUIRED_SECTION
3. STAGE_MISMATCH
4. REVIEW_BLOCK
5. HANDOFF_REJECTED
6. SCOPE_CHANGE
7. QUALITY_ISSUE

handoff_failure_reason precedence:
1. SCHEMA_MISMATCH
2. MISSING_FIELDS
3. AMBIGUOUS_OWNER
4. REVIEW_REJECTED
5. REENTRY_NOT_READY
6. INVALID_INPUT

Hard constraints:
- attempt > 1 requires supersedes_artifact_id
- attempt > 1 requires replacement_reason
- failed handoff requires failure_reason
- classified_by must equal orchestration
- same-stage repeat must emit stage_loop_detected
- no worker-authored delivery truth
- no UI-authored delivery truth

Important:
Do not produce one large implementation all at once.
Work in PR-sized phases only.

For each phase, always return exactly:
1. OBJECTIVE
2. FILES TO CHANGE
3. IMPLEMENTATION PLAN
4. FULL CODE
5. RISKS TO REVIEW

Do not give general advice.
Do not redesign the architecture.
Do not introduce speculative abstractions.
Prefer plain TypeScript + Node.js + PostgreSQL assumptions if implementation details are unclear.
Prefer plain SQL and thin db/service wrappers over invented frameworks.
If a repository path is unclear, infer the most likely path and mark it ASSUMED.
