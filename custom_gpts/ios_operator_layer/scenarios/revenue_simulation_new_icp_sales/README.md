# Revenue Simulation – New ICP Sales

Scenario cards for the default iOS operator lane.

## Included scenarios

1. `01_discovery.md`
2. `02_icp_shortlist.md`
3. `03_positioning_claims.md`
4. `04_asset_generation.md`
5. `05_launch_safety.md`
6. `06_post_batch_decision.md`

## Usage

Use one scenario at a time.

Recommended operating sequence:

1. DISCOVERY
2. ICP → SHORTLIST
3. POSITIONING &amp; CLAIMS
4. ASSET GENERATION
5. LAUNCH SAFETY
6. POST-BATCH DECISION

## Rules

- Do not parallelize scenarios
- Do not bypass STACK_DEV_LAYER
- Do not close any step without PASS / BLOCKED / STOP
- Do not open new workstreams if the current scenario is BLOCKED
