# gpts-decision-stack

Governed decision pipeline for GPT-backed workflows, implemented on Cloudflare Workers with D1, R2, KV, deployment evidence, and acceptance/runtime validation.

## What this repository is

`gpts-decision-stack` is a structured decision system for GPT-driven workflows. It combines a governed state machine, explicit artifact schemas, acceptance fixtures, a Cloudflare Workers backend, and operational ownership/approval/veto mapping.

Runtime behavior, deployment state, and governance evidence are traceable. Authoritative gate status is in `qa/final-gate-report.yaml`.

## Architecture

| Layer | Location |
|---|---|
| Control plane prompts | `prompts/core/` |
| Adaptive engine prompts | `prompts/adaptive/` |
| Backend (Cloudflare Workers, D1, R2, KV) | `backend/worker/` |
| OpenAPI contract + auth | `actions/` |
| Knowledge + rules | `knowledge/` |
| Artifact schemas | `schemas/artifacts/` |
| Acceptance tests + fixtures | `tests/` |
| Operations, evidence, gates | `operations/`, `qa/` |
| Custom GPT packaging | `custom_gpts/` |

## Local development

Prerequisites: Node.js, npm, Wrangler, Cloudflare access for bound environments.

```bash
cd backend/worker
npm ci
```