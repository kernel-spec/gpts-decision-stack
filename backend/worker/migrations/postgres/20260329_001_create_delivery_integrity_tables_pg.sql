begin;

create table if not exists artifact_lineage (
    lineage_id text primary key,
    run_id text not null,
    artifact_id text not null unique,
    artifact_type text not null,
    stage text not null,
    attempt integer not null check (attempt >= 1),
    supersedes_artifact_id text null,
    created_at timestamptz not null default now(),
    created_by_role text not null,
    classified_by text not null default 'orchestration',
    replacement_reason text null,
    replacement_reason_source text null,
    is_repair_attempt boolean not null,
    is_first_attempt_in_stage boolean not null,
    override_flag boolean not null default false,
    constraint uq_artifact_lineage_run_stage_attempt unique (run_id, stage, attempt),
    constraint chk_artifact_lineage_first_attempt
        check (
            (attempt = 1 and supersedes_artifact_id is null and is_first_attempt_in_stage = true)
            or
            (attempt > 1 and supersedes_artifact_id is not null and is_first_attempt_in_stage = false)
        ),
    constraint chk_artifact_lineage_reason_required
        check (
            (attempt = 1 and replacement_reason is null and replacement_reason_source is null)
            or
            (attempt > 1 and replacement_reason is not null and replacement_reason_source is not null)
        ),
    constraint chk_artifact_lineage_classified_by
        check (classified_by = 'orchestration')
);

create index if not exists ix_artifact_lineage_run_stage_created_at
    on artifact_lineage (run_id, stage, created_at desc);

create index if not exists ix_artifact_lineage_run_created_at
    on artifact_lineage (run_id, created_at desc);

create index if not exists ix_artifact_lineage_stage_reason
    on artifact_lineage (stage, replacement_reason);

create table if not exists handoff_events (
    handoff_id text primary key,
    run_id text not null,
    from_stage text not null,
    to_stage text not null,
    from_artifact_id text not null,
    to_artifact_id text null,
    status text not null check (status in ('COMPLETED', 'FAILED')),
    failure_reason text null,
    classified_by text not null default 'orchestration',
    override_flag boolean not null default false,
    created_at timestamptz not null default now(),
    constraint chk_handoff_failure_reason
        check (
            (status = 'FAILED' and failure_reason is not null)
            or
            (status = 'COMPLETED' and failure_reason is null)
        ),
    constraint chk_handoff_classified_by
        check (classified_by = 'orchestration')
);

create index if not exists ix_handoff_events_run_created_at
    on handoff_events (run_id, created_at desc);

create index if not exists ix_handoff_events_transition
    on handoff_events (run_id, from_stage, to_stage, created_at desc);

create index if not exists ix_handoff_events_status
    on handoff_events (status, failure_reason);

create table if not exists stage_entries (
    entry_id text primary key,
    run_id text not null,
    stage text not null,
    entered_by text not null default 'orchestration',
    entered_at timestamptz not null default now()
);

create index if not exists ix_stage_entries_run_stage_entered_at
    on stage_entries (run_id, stage, entered_at desc);

create index if not exists ix_stage_entries_run_entered_at
    on stage_entries (run_id, entered_at desc);

create table if not exists stage_loop_signals (
    loop_signal_id text primary key,
    run_id text not null,
    stage text not null,
    loop_type text not null check (loop_type in ('SAME_STAGE_REPEAT', 'TWO_NODE_LOOP')),
    entry_count integer not null check (entry_count >= 2),
    classified_by text not null default 'orchestration',
    detected_at timestamptz not null default now(),
    constraint chk_stage_loop_classified_by
        check (classified_by = 'orchestration')
);

create index if not exists ix_stage_loop_signals_run_detected_at
    on stage_loop_signals (run_id, detected_at desc);

create index if not exists ix_stage_loop_signals_stage
    on stage_loop_signals (stage, loop_type);

commit;
