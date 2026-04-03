import { describe, expect, it } from "vitest";
import type { Env } from "../types/index.js";
import { getPolicyEntry, listPolicyKeys } from "./policy.js";

// ---------- Mock KV ----------

function createMockKv(seed: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(seed));

  const kv = {
    async get(key: string, _options?: { type: string }) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    async list() {
      return {
        keys: Array.from(store.keys()).map((name) => ({ name })),
        list_complete: true,
        cursor: undefined,
      };
    },
  };

  return { kv: kv as unknown as Env["POLICY_STORE"], store };
}

// ---------- getPolicyEntry ----------

describe("getPolicyEntry", () => {
  it("returns the entry when the key exists", async () => {
    const { kv } = createMockKv({ "policy:some-key": { rule: "no refunds" } });

    const entry = await getPolicyEntry(kv, "policy:some-key");

    expect(entry).not.toBeNull();
    expect(entry!.key).toBe("policy:some-key");
    expect(entry!.value).toEqual({ rule: "no refunds" });
  });

  it("returns null when the key does not exist", async () => {
    const { kv } = createMockKv();

    const entry = await getPolicyEntry(kv, "nonexistent-key");

    expect(entry).toBeNull();
  });

  it("returns the exact value stored under the key", async () => {
    const complexValue = { rules: [1, 2, 3], enabled: true };
    const { kv } = createMockKv({ "policy:complex": complexValue });

    const entry = await getPolicyEntry(kv, "policy:complex");

    expect(entry!.value).toEqual(complexValue);
  });
});

// ---------- listPolicyKeys ----------

describe("listPolicyKeys", () => {
  it("returns all key names in the store", async () => {
    const { kv } = createMockKv({
      "policy:a": 1,
      "policy:b": 2,
      "policy:c": 3,
    });

    const keys = await listPolicyKeys(kv);

    expect(keys).toHaveLength(3);
    expect(keys).toContain("policy:a");
    expect(keys).toContain("policy:b");
    expect(keys).toContain("policy:c");
  });

  it("returns an empty array when the store is empty", async () => {
    const { kv } = createMockKv();

    const keys = await listPolicyKeys(kv);

    expect(keys).toEqual([]);
  });
});
