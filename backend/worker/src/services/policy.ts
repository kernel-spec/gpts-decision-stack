import type { Env } from "../types/index.js";

export interface PolicyEntry {
  key: string;
  value: unknown;
}

export async function getPolicyEntry(
  kv: Env["POLICY_STORE"],
  key: string
): Promise<PolicyEntry | null> {
  const raw = await kv.get(key, { type: "json" });
  if (raw === null) return null;
  return { key, value: raw };
}

export async function listPolicyKeys(
  kv: Env["POLICY_STORE"]
): Promise<string[]> {
  const list = await kv.list();
  return list.keys.map((k) => k.name);
}
