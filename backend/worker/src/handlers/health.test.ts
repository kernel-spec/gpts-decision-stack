import { describe, expect, it } from "vitest";
import { handleHealth } from "./health.js";

describe("handleHealth", () => {
  it("returns a 200 response", () => {
    const res = handleHealth();
    expect(res.status).toBe(200);
  });

  it("returns ok=true with service name and status", async () => {
    const res = handleHealth();
    const body = await res.json() as { ok: boolean; data: { status: string; service: string; timestamp: string } };

    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.data.service).toBe("gpts-decision-stack-worker");
    expect(body.data.timestamp).toBeTruthy();
  });

  it("includes a valid ISO timestamp", () => {
    const res = handleHealth();
    res.json().then((body: unknown) => {
      const data = (body as { data: { timestamp: string } }).data;
      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });
});
