# Domain Template Library — Commercial Layer

## Purpose

This document stores the **canonical domain prompt framework** for the Top 10
commercial GPT rollout under `custom_gpts/commercial_layer/`.

It is the authoritative source material for **authoring and QA** of role-specific
knowledge overlays, domain-to-role mappings, and deployment configurations.

> **IMPORTANT:** This file is a **knowledge skeleton artifact for authoring and QA only.**
> It is **not** a runtime execution artifact and must **not** be loaded into or referenced
> by the governed execution engine (control plane, adaptive engine prompts, artifact schemas,
> or promotion gates). It is explicitly separated from the governed execution engine layer.

---

## Separation Statement

The `custom_gpts/commercial_layer/` tree is a **repo-separated authoring and QA
foundation** for the Top 10 commercial GPT rollout. It does not modify, override,
or interact with:

- `knowledge/core/` — INVARIANT governed execution knowledge
- `knowledge/domains/default/` — ADAPTIVE governed domain knowledge
- `prompts/` — governed system prompts
- `schemas/` — artifact schemas
- `operations/` — governance maps and promotion gates
- `qa/` — QA gate reports
- `backend/` — backend runtime code

---

## Canonical Domain Framework

The commercial layer uses **6 active domains** drawn from the full 10-domain ontology.
Each domain entry defines scope, primary use cases, risk profile, and output guidance
used as source material when authoring role-specific overlays.

Domain IDs (`domain_1`, `domain_3`, etc.) are stable identifiers that map directly
to keys in `domain-to-role-mapping.yaml`.

---

### Domain 1 — Content Creation

**Domain ID:** `domain_1`
**Purpose:** content design, copy structure, tone, format

**Description:**
Writing and structuring content for commercial use — outreach copy, landing pages,
social posts, email sequences, articles, and any asset where tone, clarity,
and message structure drive conversion.

**Primary Use Cases:**
- Outreach copy (DM, email, LinkedIn)
- One-screen offer pages
- Social media content
- Articles and blog posts
- Asset rewriting and optimization

**Output Format Guidance:** labeled asset blocks with channel tag, single CTA per asset,
change logs for rewrites, testing variable suggestions

**Risk Profile:** low–medium (brand and claim risk; no fake proof, no invented logos,
no multi-CTA output)

**Web Search Relevance:** low (content is created from provided inputs, not from web scans)

**Roles that primarily use this domain:**
- ASSET_ENGINE (primary)
- REWRITE_ENGINE (primary)
- SUGGESTION_ENGINE (primary)

---

### Domain 3 — Project Management & Planning

**Domain ID:** `domain_3`
**Purpose:** planning, sequencing, milestones, delivery structure

**Description:**
Operational and delivery planning — turning an offer into a structured delivery
pipeline with onboarding, checklists, client touchpoints, and scope enforcement.

**Primary Use Cases:**
- Delivery pipeline design
- Onboarding plans and intake checklists
- Milestone and progress tracking
- SOP and process templates
- Scope and definition-of-done enforcement

**Output Format Guidance:** phased delivery overviews, checklist blocks,
client touchpoint maps, acceptance criteria tables, scope enforcement language

**Risk Profile:** low (process accuracy risk; no regulated content)

**Web Search Relevance:** low (delivery structure is derived from offer inputs,
not web research)

**Roles that primarily use this domain:**
- DELIVERY_SOP_ENGINE (primary)
- STRUCTURAL_ENGINE (secondary)

---

### Domain 4 — Marketing & Growth

**Domain ID:** `domain_4`
**Purpose:** messaging, growth strategy, campaign logic, funnel thinking

**Description:**
Marketing strategy and growth logic — ICP definition, positioning, campaign framing,
funnel analysis, and outbound channel planning. The demand-generation lens for the
commercial layer.

**Primary Use Cases:**
- ICP and buyer persona definition
- Brand positioning and single source of truth
- Campaign and outbound channel planning
- Funnel and conversion analysis
- Claims and drift audits

**Output Format Guidance:** positioning blocks, ICP profiles, campaign outlines,
approved/banned claims vocabulary, channel plans with kill criteria

**Risk Profile:** medium (ICP drift risk, claim drift risk; requires source-cited
market assertions)

**Web Search Relevance:** high (MARKET_SCOUT_OUTBOUND requires web for real market offers,
pricing patterns, and ICP validation)

**Roles that primarily use this domain:**
- POSITIONING_POLICE (primary)
- ASSET_ENGINE (primary)
- MARKET_SCOUT_OUTBOUND (primary)
- SUGGESTION_ENGINE (primary)

---

### Domain 5 — Product & Services

**Domain ID:** `domain_5`
**Purpose:** offer design, customer need, MVP logic, service structure

**Description:**
Offer and service design — translating a vague idea into a monetizable system with
a defined ICP, output contract, scope lock, validation metric, and kill criteria.
The core structural lens of the commercial layer.

**Primary Use Cases:**
- Problem and ICP definition
- Output contract creation
- Scope lock and boundary setting
- MVP and service structure
- Pricing package design (with Business & Strategy)

**Output Format Guidance:** problem/ICP/transformation blocks, output contracts,
scope lock statements, monetization models, validation metrics, kill criteria

**Risk Profile:** low–medium (IP and scope risk; outputs must not overstate delivery
commitments)

**Web Search Relevance:** low (offer design is based on provided inputs and business logic)

**Roles that primarily use this domain:**
- STRUCTURAL_ENGINE (primary)
- PRICING_PACKAGER (primary)
- CALL_CLOSER (primary)
- DELIVERY_SOP_ENGINE (primary)
- MARKET_SCOUT_OUTBOUND (primary)

---

### Domain 8 — Business & Strategy

**Domain ID:** `domain_8`
**Purpose:** strategic framing, business model, scaling logic, performance thinking

**Description:**
Strategic and business-model thinking — go-to-market framing, revenue logic,
pricing strategy, competitive positioning, and routing intelligence.
The executive decision-making lens of the commercial layer.

**Primary Use Cases:**
- Business model exploration
- Go-to-market and revenue strategy
- Pricing tiers and value ladder logic
- Strategic analysis and competitive framing
- Router logic for revenue-first orchestration

**Output Format Guidance:** strategic option matrices, business model canvases,
pricing strategy tables, competitive analysis summaries, routing decisions with
single next-step outputs

**Risk Profile:** low–medium (hallucination risk in market claims; must not invent
benchmarks or guaranteed ROI figures)

**Web Search Relevance:** medium (MARKET_SCOUT_OUTBOUND uses web; other roles derive
strategy from inputs)

**Roles that primarily use this domain:**
- SYSTEM_OS_MASTER (primary)
- STRUCTURAL_ENGINE (primary)
- PRICING_PACKAGER (primary)
- MARKET_SCOUT_OUTBOUND (primary)
- CALL_CLOSER (primary)
- SUGGESTION_ENGINE (primary)

---

### Domain 10 — Communication & Presentation

**Domain ID:** `domain_10`
**Purpose:** message design, argumentation, business communication, negotiation framing

**Description:**
Message structure and business communication — argumentation logic, negotiation framing,
call flow design, business writing clarity, and presentation structure.
The communication and persuasion lens of the commercial layer.

**Primary Use Cases:**
- Call flow and discovery script design
- Argumentation and message structure
- Business communication templates
- Negotiation framing and objection handling
- Positioning vocabulary and approved-phrase libraries

**Output Format Guidance:** call flow scripts with qualification gates, question banks,
follow-up email templates, argumentation trees, vocabulary policy blocks

**Risk Profile:** low–medium (tone and pressure-tactics risk; must not include
manipulative language or multi-next-step closings)

**Web Search Relevance:** low (communication structure is derived from offer and
positioning inputs)

**Roles that primarily use this domain:**
- CALL_CLOSER (primary)
- POSITIONING_POLICE (primary)
- ASSET_ENGINE (primary)
- REWRITE_ENGINE (primary)
- DELIVERY_SOP_ENGINE (primary)
- MARKET_SCOUT_OUTBOUND (secondary)
- SYSTEM_OS_MASTER (secondary)

---

## Role Coverage Matrix

| Order | Role                   | Type              | Primary Domains                         | Web    | Char Risk |
|-------|------------------------|-------------------|-----------------------------------------|--------|-----------|
| 1     | SYSTEM_OS_MASTER       | router            | domain_8, domain_4, domain_5            | OFF    | high      |
| 2     | STRUCTURAL_ENGINE      | offer_design      | domain_5, domain_8                      | OFF    | medium    |
| 3     | PRICING_PACKAGER       | pricing           | domain_8, domain_5                      | OFF    | low       |
| 4     | POSITIONING_POLICE     | positioning_qc    | domain_4, domain_10                     | OFF    | medium    |
| 5     | ASSET_ENGINE           | asset_generation  | domain_1, domain_4, domain_10           | OFF    | medium    |
| 6     | REWRITE_ENGINE         | asset_rewrite     | domain_1, domain_10                     | OFF    | low       |
| 7     | SUGGESTION_ENGINE      | diagnostics       | domain_1, domain_4, domain_8, domain_10 | OFF    | low       |
| 8     | MARKET_SCOUT_OUTBOUND  | market_research   | domain_4, domain_8, domain_5            | **ON** | high      |
| 9     | CALL_CLOSER            | sales_conversion  | domain_10, domain_8, domain_5           | OFF    | medium    |
| 10    | DELIVERY_SOP_ENGINE    | delivery_system   | domain_3, domain_5, domain_10           | OFF    | medium    |

---

## Authoring Notes

- Domain IDs and role names in this library must match exactly across
  `domain-to-role-mapping.yaml`, `top10-role-overlays.yaml`, and
  `builder-deployment-sheet.yaml`.
- This document is the **single source of truth** for domain descriptions used
  during prompt authoring. Do not derive domain definitions from runtime artifacts.
- QA reviewers should use this document to validate overlay `keep_sections`,
  `ignore_sections`, and `output_enforcements` for domain consistency.
- `builder_compact_must_keep` in overlays must align with the Output Format Guidance
  entries in this document.
- Only `MARKET_SCOUT_OUTBOUND` (order 8) has Web ON. All other roles are Web OFF.
- Domains `domain_2`, `domain_6`, `domain_7`, and `domain_9` are reserved in the
  full 10-domain ontology but are not active in this commercial layer rollout.
