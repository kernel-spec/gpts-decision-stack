import { describe, expect, it } from "vitest";
import worker from "./index.js";
import type { Env } from "./types/index.js";

// ---------- Helpers ----------

function makeEnv(apiKey = "secret-key-123"): Env {
  const db = {
    prepare() {
      return {
        bind() {
          return {
            async first<T>() { return null as T; },
            async run() { return { success: true }; },
            async all<T>() { return { results: [] as T[] }; },
          };
        },
      };
    },
  } as unknown as Env["DECISIONS_DB"];

  return {
    DECISIONS_DB: db,
    ARTIFACTS_BUCKET: {} as Env["ARTIFACTS_BUCKET"],
    POLICY_STORE: {} as Env["POLICY_STORE"],
    API_KEY_SECRET: apiKey,
  };
}

// ---------- Auth middleware ----------

describe("auth middleware — validateApiKey", () => {
  it("returns 200 for /health without an API key (public path)", async () => {
    const env = makeEnv();
    const request = new Request("https://example.com/health");

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
  });

  it("returns 401 when API key is missing on a protected path", async () => {
    const env = makeEnv();
    const request = new Request("https://example.com/session");

    const response = await worker.fetch(request, env);
    const body = await response.json() as { ok: boolean; code: string };

    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when API key is wrong", async () => {
    const env = makeEnv("correct-key");
    const request = new Request("https://example.com/session", {
      headers: { "X-API-Key": "wrong-key" },
    });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(401);
  });

  it("returns 401 when API key has wrong length (timing-safe guard)", async () => {
    const env = makeEnv("correct-key");
    const request = new Request("https://example.com/session", {
      headers: { "X-API-Key": "short" },
    });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(401);
  });

  it("passes through to router when API key is correct", async () => {
    const env = makeEnv("correct-key");
    const request = new Request("https://example.com/session/nonexistent", {
      headers: { "X-API-Key": "correct-key" },
    });

    const response = await worker.fetch(request, env);

    // 404 means auth passed (request reached the router)
    expect(response.status).toBe(404);
  });

  it("returns 500 and catches unhandled errors", async () => {
    // Corrupt env so the router throws
    const badEnv = {
      DECISIONS_DB: null,
      ARTIFACTS_BUCKET: null,
      POLICY_STORE: null,
      API_KEY_SECRET: "key",
    } as unknown as Env;

    const request = new Request("https://example.com/session/x", {
      headers: { "X-API-Key": "key" },
    });

    const response = await worker.fetch(request, badEnv);
    const body = await response.json() as { ok: boolean; code: string };

    // Should return 500, not throw
    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});

describe("auth middleware — isPublicPath", () => {
  it("/health is exempt from auth", async () => {
    const env = makeEnv("secret");
    const request = new Request("https://example.com/health"); // no X-API-Key header

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
  });

  it("non-health paths require auth", async () => {
    const env = makeEnv("secret");

    for (const path of ["/session", "/veto/s/status", "/approval/s"]) {
      const request = new Request(`https://example.com${path}`);
      const response = await worker.fetch(request, env);
      expect(response.status).toBe(401);
    }
  });
});
