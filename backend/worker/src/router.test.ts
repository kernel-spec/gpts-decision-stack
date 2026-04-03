import { describe, expect, it } from "vitest";
import { errorResponse, requireJson, route } from "./router.js";
import type { Env } from "./types/index.js";

// ---------- errorResponse ----------

describe("errorResponse", () => {
  it("returns a JSON response with ok=false, error, and code", async () => {
    const res = errorResponse("Something went wrong", "INTERNAL_ERROR");
    const body = await res.json() as { ok: boolean; error: string; code: string };

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Something went wrong");
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("uses the provided status code", async () => {
    const res = errorResponse("Not found", "NOT_FOUND", 404);

    expect(res.status).toBe(404);
  });

  it("defaults to status 500 when no status is provided", async () => {
    const res = errorResponse("Boom", "BOOM");

    expect(res.status).toBe(500);
  });

  it("returns status 400 for bad request errors", async () => {
    const res = errorResponse("Invalid input", "INVALID_REQUEST", 400);

    expect(res.status).toBe(400);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it("returns status 401 for auth errors", async () => {
    const res = errorResponse("Unauthorized", "UNAUTHORIZED", 401);

    expect(res.status).toBe(401);
  });
});

// ---------- requireJson ----------

describe("requireJson", () => {
  it("parses and returns a valid JSON body", async () => {
    const request = new Request("https://example.com/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    });

    const result = await requireJson<{ foo: string }>(request);

    expect(result).toEqual({ foo: "bar" });
  });

  it("throws TypeError for invalid JSON", async () => {
    const request = new Request("https://example.com/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });

    await expect(requireJson(request)).rejects.toThrow(TypeError);
  });

  it("throws TypeError with descriptive message for empty body", async () => {
    const request = new Request("https://example.com/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });

    await expect(requireJson(request)).rejects.toThrow("Invalid JSON body");
  });
});

// ---------- route ----------

// Minimal mock env - we only need enough for the router to call handlers
function makeEnv(): Env {
  const sessions = new Map<string, unknown>();

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM sessions s")) {
                const session_id = params[0] as string;
                return (sessions.get(session_id) as T) ?? (null as T);
              }
              return null as T;
            },
            async run() { return { success: true }; },
            async all<T>() { return { results: [] as T[] }; },
          };
        },
      };
    },
  };

  return {
    DECISIONS_DB: db as unknown as Env["DECISIONS_DB"],
    ARTIFACTS_BUCKET: {} as Env["ARTIFACTS_BUCKET"],
    POLICY_STORE: {} as Env["POLICY_STORE"],
    API_KEY_SECRET: "test-secret",
  };
}

describe("route — GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await route(new Request("https://example.com/health"), makeEnv());

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { status: string } };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("ok");
  });

  it("returns 405 for non-GET methods on /health", async () => {
    const res = await route(
      new Request("https://example.com/health", { method: "POST" }),
      makeEnv()
    );

    expect(res.status).toBe(405);
  });
});

describe("route — unknown paths", () => {
  it("returns 404 for an unknown path", async () => {
    const res = await route(new Request("https://example.com/not-a-real-path"), makeEnv());

    expect(res.status).toBe(404);
    const body = await res.json() as { ok: boolean; code: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("NOT_FOUND");
  });
});

describe("route — method not allowed", () => {
  it("returns 405 when DELETE is used on /session", async () => {
    const res = await route(
      new Request("https://example.com/session", { method: "DELETE" }),
      makeEnv()
    );

    expect(res.status).toBe(405);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("returns 405 when POST is used on GET-only route /session/{id}", async () => {
    const res = await route(
      new Request("https://example.com/session/some-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      makeEnv()
    );

    expect(res.status).toBe(405);
  });

  it("returns 405 when GET is used on POST-only route /session/{id}/artifact", async () => {
    const res = await route(
      new Request("https://example.com/session/some-id/artifact"),
      makeEnv()
    );

    expect(res.status).toBe(405);
  });
});

describe("route — /session/{id} routing", () => {
  it("returns 404 when session does not exist on GET /session/{id}", async () => {
    const res = await route(
      new Request("https://example.com/session/nonexistent-id"),
      makeEnv()
    );

    expect(res.status).toBe(404);
  });
});

describe("route — /veto routing", () => {
  it("returns 405 when DELETE is used on /veto/{id}/status", async () => {
    const res = await route(
      new Request("https://example.com/veto/sess-001/status", { method: "DELETE" }),
      makeEnv()
    );

    expect(res.status).toBe(405);
  });

  it("returns 405 when GET is used on /veto/{id}/activate", async () => {
    const res = await route(
      new Request("https://example.com/veto/sess-001/activate"),
      makeEnv()
    );

    expect(res.status).toBe(405);
  });

  it("returns 405 when GET is used on /veto/{id}/release", async () => {
    const res = await route(
      new Request("https://example.com/veto/sess-001/release"),
      makeEnv()
    );

    expect(res.status).toBe(405);
  });
});

describe("route — /approval routing", () => {
  it("returns 405 when POST is used on GET-only /approval/{id}", async () => {
    const res = await route(
      new Request("https://example.com/approval/sess-001", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      makeEnv()
    );

    expect(res.status).toBe(405);
  });

  it("returns 405 when GET is used on POST-only /approval/{id}/submit", async () => {
    const res = await route(
      new Request("https://example.com/approval/sess-001/submit"),
      makeEnv()
    );

    expect(res.status).toBe(405);
  });
});

describe("route — /operator routing", () => {
  it("returns 405 when POST is used on GET-only operator endpoints", async () => {
    const res = await route(
      new Request("https://example.com/operator/session/sess-001/delivery-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      makeEnv()
    );

    expect(res.status).toBe(405);
  });
});
