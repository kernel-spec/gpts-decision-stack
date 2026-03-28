import { describe, expect, it } from "vitest";
import type { Env } from "../types/index.js";
import { recordModelOutput, saveArtifact } from "./founder-write.js";

type PreparedResult = {
  bind: (...params: unknown[]) => {
    first: <T>() => Promise<T | null>;
    run: () => Promise<unknown>;
  };
};

function createMockDb() {
  const founderArtifacts: Array<{
    artifact_id: string;
    project_id: string;
    run_id: string;
    artifact_type: string;
    source_surface: string;
    source_role: string;
    status: string;
    version: number;
    created_at: string;
    storage_path: string;
    linked_decision_id: string | null;
  }> = [];
  const founderModelOutputs: Array<{
    record_id: string;
    project_id: string;
    run_id: string;
    source_surface: string;
    source_role: string;
    role_name: string;
    output_type: string;
    status: string;
    storage_path: string;
    operator_notes: string | null;
    created_at: string;
  }> = [];

  const db = {
    prepare(sql: string): PreparedResult {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("SELECT COALESCE(MAX(version), 0) AS latest_version")) {
                const [project_id, run_id, artifact_type] = params as [string, string, string];
                const latestVersion = founderArtifacts
                  .filter(
                    (artifact) =>
                      artifact.project_id === project_id &&
                      artifact.run_id === run_id &&
                      artifact.artifact_type === artifact_type
                  )
                  .reduce((max, artifact) => Math.max(max, artifact.version), 0);

                return { latest_version: latestVersion } as T;
              }

              return null;
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
                ] = params as [
                  string,
                  string,
                  string,
                  string,
                  string,
                  string,
                  string,
                  number,
                  string,
                  string,
                  string | null,
                ];

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

              if (sql.includes("INSERT INTO founder_model_outputs")) {
                const [
                  record_id,
                  project_id,
                  run_id,
                  source_surface,
                  source_role,
                  role_name,
                  output_type,
                  status,
                  storage_path,
                  operator_notes,
                  created_at,
                ] = params as [
                  string,
                  string,
                  string,
                  string,
                  string,
                  string,
                  string,
                  string,
                  string,
                  string | null,
                  string,
                ];

                founderModelOutputs.push({
                  record_id,
                  project_id,
                  run_id,
                  source_surface,
                  source_role,
                  role_name,
                  output_type,
                  status,
                  storage_path,
                  operator_notes,
                  created_at,
                });
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
    founderModelOutputs,
  };
}

function createMockBucket() {
  const writes: Array<{
    key: string;
    value: string;
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
      customMetadata?: Record<string, string>;
    };
  }> = [];

  const bucket = {
    async put(
      key: string,
      value: string,
      options?: {
        httpMetadata?: {
          contentType?: string;
        };
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

describe("founder write service", () => {
  it("saves founder artifacts with incremented versions and R2 storage paths", async () => {
    const { db, founderArtifacts } = createMockDb();
    const { bucket, writes } = createMockBucket();

    const first = await saveArtifact(db, bucket, "project-123", {
      artifact_type: "Problem Brief",
      metadata: {
        run_id: "run-001",
      },
      content: { body: "first" },
      submitted_by: "founder-console",
      linked_decision_id: "decision-1",
    });

    const second = await saveArtifact(db, bucket, "project-123", {
      artifact_type: "Problem Brief",
      metadata: {
        run_id: "run-001",
      },
      content: "second-version",
      submitted_by: "founder-console",
    });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(first.linked_decision_id).toBe("decision-1");
    expect(second.storage_path).toContain(
      "founder/projects/project-123/runs/run-001/artifacts/problem-brief/v2/"
    );
    expect(second.storage_path.endsWith(".txt")).toBe(true);
    expect(writes).toHaveLength(2);
    expect(writes[0].options?.httpMetadata?.contentType).toBe("application/json");
    expect(writes[1].options?.httpMetadata?.contentType).toBe(
      "text/plain; charset=utf-8"
    );
    expect(founderArtifacts).toHaveLength(2);
    expect(founderArtifacts[0]).toMatchObject({
      project_id: "project-123",
      run_id: "run-001",
      source_surface: "founder_console",
      source_role: "founder-console",
      status: "saved",
      version: 1,
    });
  });

  it("records model output as founder-console evidence with explicit provenance", async () => {
    const { db, founderModelOutputs } = createMockDb();
    const { bucket, writes } = createMockBucket();

    const result = await recordModelOutput(db, bucket, "project-789", {
      run_id: "run-abc",
      role_name: "POSITIONING_POLICE",
      output_type: "analysis_trace",
      raw_output: "raw model output",
      operator_notes: "keep for review",
    });

    expect(result).toMatchObject({
      status: "recorded",
      linked_run_id: "run-abc",
      suggested_artifact_update: null,
      founder_decision_required: false,
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].key).toContain(
      "founder/projects/project-789/runs/run-abc/model-outputs/positioning_police/analysis_trace/"
    );
    expect(founderModelOutputs).toHaveLength(1);
    expect(founderModelOutputs[0]).toMatchObject({
      project_id: "project-789",
      run_id: "run-abc",
      source_surface: "founder_console",
      source_role: "POSITIONING_POLICE",
      role_name: "POSITIONING_POLICE",
      output_type: "analysis_trace",
      status: "recorded",
      operator_notes: "keep for review",
    });
  });
});
