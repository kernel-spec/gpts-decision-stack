import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("OpenAI Builder action contract", () => {
  it("includes the founder endpoints implemented by the worker", () => {
    const schema = readRepoFile("actions/openapi.openai.yaml");

    expect(schema).toContain("/founder/project/{project_id}/status:");
    expect(schema).toContain("operationId: get_project_status");
    expect(schema).toContain("/founder/project/{project_id}/next-action:");
    expect(schema).toContain("operationId: get_next_action");
    expect(schema).toContain("/founder/project/{project_id}/artifact:");
    expect(schema).toContain("operationId: save_artifact");
    expect(schema).toContain("/founder/project/{project_id}/model-output:");
    expect(schema).toContain("operationId: record_model_output");
  });

  it("keeps health public and points GPT deployment at the builder-safe schema", () => {
    const schema = readRepoFile("actions/openapi.openai.yaml");
    const deploymentTarget = readRepoFile("release/deployment_target.yaml");
    const healthBlock = schema.split("  /session:")[0];

    expect(healthBlock).toContain("/health:");
    expect(healthBlock).not.toContain("security:");
    expect(deploymentTarget).toContain("action_schema: actions/openapi.openai.yaml");
  });
});
