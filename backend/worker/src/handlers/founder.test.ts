import { describe, expect, it } from "vitest";
import { handleSaveArtifact } from "./founder.js";
import * as founderService from "../services/founder.js";
import type { Env, Session } from "../types/index.js";

type MockSessionRow = {
  session_id: string;
  requestor_type: Session["requestor_type"];
  pipeline_state: Session["pipeline_state"];
  decision_status: Session["decision_status"];
  created_at: string;
  updated_at: string;
  veto_active: number;
};

function createMockDb(session: MockSessionRow) {
  const sessions = new Map<string, MockSessionRow>([[session.session_id, { ...session }]]);
  const founderArtifacts: Array<Record<string, unknown>> = [];
  const artifacts: Array<Record<string, unknown>> = [];
  const decisionLog: Array<Record<string, unknown>> = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("SELECT s.session_id")) {
                const session_id = params[0] as string;
                return (sessions.get(session_id) ?? null) as T | null;
              }

              if (sql.includes("SELECT COALESCE(MAX(version), 0) AS latest_version")) {
                const [project_id, run_id, artifact_type] = params as [string, string, string];
                const latestVersion = founderArtifacts
                  .filter(
                    (artifact) =>
                      artifact.project_id === project_id &&
                      artifact.run_id === run_id &&
                      artifact.artifact_type === artifact_type
                  )
                  .reduce(
                    (max, artifact) => Math.max(max, Number(artifact.version ?? 0)),
                    0
                  );

                return { latest_version: latestVersion } as T;
              }

              return null;
            },
            async all<T>() {
              if (sql.includes("SELECT DISTINCT artifact_type FROM artifacts")) {
                const session_id = params[0] as string;
                const results = artifacts
                  .filter((artifact) => artifact.session_id === session_id)
                  .map((artifact) => ({ artifact_type: artifact.artifact_type as string }));
                return { results } as { results: T[] };
              }

              if (sql.includes("SELECT DISTINCT artifact_type FROM founder_artifacts")) {
                const project_id = params[0] as string;
                const results = founderArtifacts
                  .filter((artifact) => artifact.project_id === project_id)
                  .map((artifact) => ({ artifact_type: artifact.artifact_type as string }));
                return { results } as { results: T[] };
              }

              return { results: [] as T[] };
            },
            async run() {
              if (sql.includes("INSERT INTO founder_artifacts")) {
                const [
                  artifact_id,
                  project_id,
                  run_id,
                  artifact_type,
                  source_surface,
                  source_role,
                  status,
                  version,
                  created_at,
                  storage_path,
                  linked_decision_id,
                ] = params;
                founderArtifacts.push({
                  artifact_id,
                  project_id,
                  run_id,
                  artifact_type,
                  source_surface,
                  source_role,
                  status,
                  version,
                  created_at,
                  storage_path,
                  linked_decision_id,
                });
              }

              if (sql.includes("INSERT INTO artifacts")) {
                const [id, session_id, artifact_type, r2_key, submitted_at] = params;
                artifacts.push({ id, session_id, artifact_type, r2_key, submitted_at });
              }

              if (sql.includes("INSERT INTO decision_log")) {
                const [
                  id,
                  session_id,
                  agent_id,
                  action,
                  pipeline_state,
                  decision_status,
                  notes,
                  logged_at,
                ] = params;
                decisionLog.push({
                  id,
                  session_id,
                  agent_id,
                  action,
                  pipeline_state,
                  decision_status,
                  notes,
                  logged_at,
                });
              }

              if (sql.includes("UPDATE sessions SET pipeline_state = ?, decision_status = ?, updated_at = ?")) {
                const [pipeline_state, decision_status, updated_at, session_id] = params as [
                  Session["pipeline_state"],
                  Session["decision_status"],
                  string,
                  string,
                ];
                const existing = sessions.get(session_id);
                if (existing) {
                  sessions.set(session_id, {
                    ...existing,
                    pipeline_state,
                    decision_status,
                    updated_at,
                  });
                }
              }

              return { success: true };
            },
          };
        },
      };
    },
  };

  return {
    db: db as unknown as Env["DECISIONS_DB"],
    founderArtifacts,
    artifacts,
    decisionLog,
    sessions,
  };
}

function createMockBucket() {
  const writes: Array<{
    key: string;
    value: string;
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    };
  }> = [];

  const bucket = {
    async put(
      key: string,
      value: string,
      options?: {
        httpMetadata?: { contentType?: string };
        customMetadata?: Record<string, string>;
      }
    ) {
      writes.push({ key, value, options });
    },
  };

  return {
    bucket: bucket as unknown as Env["ARTIFACTS_BUCKET"],
    writes,
  };
}

function createEnv(sessionOverrides: Partial<MockSessionRow> = {}) {
  const session: MockSessionRow = {
    session_id: "project-123",
    requestor_type: "founder-led",
    pipeline_state: "intake",
    decision_status: "unresolved",
    created_at: "2026-03-28T00:00:00.000Z",
    updated_at: "2026-03-28T00:00:00.000Z",
    veto_active: 0,
    ...sessionOverrides,
  };
  const dbState = createMockDb(session);
  const bucketState = createMockBucket();

  return {
    env: {
      DECISIONS_DB: dbState.db,
      ARTIFACTS_BUCKET: bucketState.bucket,
      POLICY_STORE: {} as Env["POLICY_STORE"],
      API_KEY_SECRET: "test-secret",
    } satisfies Env,
    ...dbState,
    ...bucketState,
  };
}

describe("founder artifact handler", () => {
  it("dual-writes ProblemBrief into founder and canonical stores and advances state", async () => {
    const { env, founderArtifacts, artifacts, decisionLog, sessions, writes } = createEnv();

    const response = await handleSaveArtifact(
      new Request("https://example.com/founder/project/project-123/artifact", {
        method: "POST",
        body: JSON.stringify({
          artifact_type: "ProblemBrief",
          metadata: { run_id: "run-001" },
          content: { problem: "Founder problem brief" },
          submitted_by: "founder-console",
        }),
        headers: { "content-type": "application/json" },
      }),
      "project-123",
      env
    );

    expect(response.status).toBe(200);
    expect(founderArtifacts).toHaveLength(1);
    expect(artifacts).toHaveLength(1);
    expect(writes).toHaveLength(2);
    expect(writes[0].key).toContain(
      "founder/projects/project-123/runs/run-001/artifacts/problembrief/v1/"
    );
    expect(writes[1].key).toContain("project-123/");
    expect(artifacts[0]).toMatchObject({
      session_id: "project-123",
      artifact_type: "ProblemBrief",
    });
    expect(sessions.get("project-123")?.pipeline_state).toBe("problem_framing");
    expect(decisionLog.map((entry) => entry.action)).toEqual([
      "founder.artifact.saved",
      "artifact.submitted",
      "pipeline.transition",
    ]);

    const status = await founderService.getProjectStatus(env.DECISIONS_DB, "project-123");
    const nextAction = await founderService.getNextAction(env.DECISIONS_DB, "project-123");

    expect(status).toMatchObject({
      current_phase: "problem_framing",
      current_step: "await_problem_framing_decision",
      next_action: "save_state_decision_packet",
    });
    expect(nextAction).toMatchObject({
      next_action: "save_state_decision_packet",
      next_surface: "founder_console",
    });
  });

  it("advances from primitive_selection to architecture_validation with structured StateDecisionPacket", async () => {
    const { env, founderArtifacts, artifacts, decisionLog, sessions, writes } = createEnv({
      pipeline_state: "primitive_selection",
      decision_status: "proceed",
    });

    const response = await handleSaveArtifact(
      new Request("https://example.com/founder/project/project-123/artifact", {
        method: "POST",
        body: JSON.stringify({
          artifact_type: "StateDecisionPacket",
          metadata: { run_id: "run-002" },
          content: {
            state_id: "primitive_selection",
            outcome: "proceed",
          },
          submitted_by: "founder-console",
        }),
        headers: { "content-type": "application/json" },
      }),
      "project-123",
      env
    );

    expect(response.status).toBe(200);
    expect(founderArtifacts).toHaveLength(1);
    expect(artifacts).toHaveLength(1);
    expect(writes).toHaveLength(2);
    expect(founderArtifacts[0]).toMatchObject({
      project_id: "project-123",
      artifact_type: "StateDecisionPacket",
      run_id: "run-002",
    });
    expect(artifacts[0]).toMatchObject({
      session_id: "project-123",
      artifact_type: "StateDecisionPacket",
    });
    expect(sessions.get("project-123")).toMatchObject({
      pipeline_state: "architecture_validation",
      decision_status: "proceed",
    });
    expect(decisionLog.map((entry) => entry.action)).toEqual([
      "founder.artifact.saved",
      "artifact.submitted",
      "pipeline.transition",
    ]);

    const status = await founderService.getProjectStatus(env.DECISIONS_DB, "project-123");
    const nextAction = await founderService.getNextAction(env.DECISIONS_DB, "project-123");

    expect(status).toMatchObject({
      current_phase: "architecture_validation",
      current_step: "await_architecture_validation_decision",
      next_action: "save_state_decision_packet",
    });
    expect(nextAction).toMatchObject({
      next_action: "save_state_decision_packet",
      next_surface: "founder_console",
    });
    expect(nextAction?.copy_paste_block).toContain('"state_id": "architecture_validation"');
  });

  it("tolerates stringified StateDecisionPacket JSON for canonical founder progression", async () => {
    const { env, founderArtifacts, artifacts, decisionLog, sessions } = createEnv({
      pipeline_state: "primitive_selection",
      decision_status: "proceed",
    });

    const response = await handleSaveArtifact(
      new Request("https://example.com/founder/project/project-123/artifact", {
        method: "POST",
        body: JSON.stringify({
          artifact_type: "StateDecisionPacket",
          metadata: { run_id: "run-003" },
          content: JSON.stringify({
            state_id: "primitive_selection",
            outcome: "proceed",
          }),
          submitted_by: "founder-console",
        }),
        headers: { "content-type": "application/json" },
      }),
      "project-123",
      env
    );

    expect(response.status).toBe(200);
    expect(founderArtifacts).toHaveLength(1);
    expect(artifacts).toHaveLength(1);
    expect(decisionLog.map((entry) => entry.action)).toEqual([
      "founder.artifact.saved",
      "artifact.submitted",
      "pipeline.transition",
    ]);
    expect(sessions.get("project-123")).toMatchObject({
      pipeline_state: "architecture_validation",
      decision_status: "proceed",
    });
  });

  it("fails closed when ProblemBrief is not legal for the current state", async () => {
    const { env, founderArtifacts, artifacts, decisionLog, sessions } = createEnv({
      pipeline_state: "problem_framing",
      decision_status: "proceed",
    });

    const response = await handleSaveArtifact(
      new Request("https://example.com/founder/project/project-123/artifact", {
        method: "POST",
        body: JSON.stringify({
          artifact_type: "ProblemBrief",
          metadata: { run_id: "run-002" },
          content: { problem: "Too late" },
          submitted_by: "founder-console",
        }),
        headers: { "content-type": "application/json" },
      }),
      "project-123",
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "ILLEGAL_ARTIFACT_STATE",
    });
    expect(founderArtifacts).toHaveLength(0);
    expect(artifacts).toHaveLength(0);
    expect(decisionLog).toHaveLength(0);
    expect(sessions.get("project-123")?.pipeline_state).toBe("problem_framing");
  });

  it("fails closed when stringified StateDecisionPacket content names the wrong state", async () => {
    const { env, founderArtifacts, artifacts, decisionLog, sessions } = createEnv({
      pipeline_state: "primitive_selection",
      decision_status: "proceed",
    });

    const response = await handleSaveArtifact(
      new Request("https://example.com/founder/project/project-123/artifact", {
        method: "POST",
        body: JSON.stringify({
          artifact_type: "StateDecisionPacket",
          metadata: { run_id: "run-004" },
          content: JSON.stringify({
            state_id: "problem_framing",
            outcome: "proceed",
          }),
          submitted_by: "founder-console",
        }),
        headers: { "content-type": "application/json" },
      }),
      "project-123",
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "ILLEGAL_ARTIFACT_STATE",
      error: expect.stringContaining("StateDecisionPacket cannot be submitted canonically"),
    });
    expect(founderArtifacts).toHaveLength(0);
    expect(artifacts).toHaveLength(0);
    expect(decisionLog).toHaveLength(0);
    expect(sessions.get("project-123")).toMatchObject({
      pipeline_state: "primitive_selection",
      decision_status: "proceed",
    });
  });
});
