import type { Env } from "./types/index.js";
import { route, errorResponse } from "./router.js";

// ---------- Auth middleware ----------

function validateApiKey(request: Request, env: Env): boolean {
  const key = request.headers.get("X-API-Key");
  if (!key) return false;
  // Constant-time comparison to prevent timing attacks
  const expected = env.API_KEY_SECRET;
  if (key.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) {
    diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// /health is exempt from auth
function isPublicPath(url: URL): boolean {
  return url.pathname === "/health";
}

// ---------- Worker entry ----------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (!isPublicPath(url) && !validateApiKey(request, env)) {
        return errorResponse("Unauthorized", "UNAUTHORIZED", 401);
      }

      return await route(request, env);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Internal server error";
      console.error("[worker] unhandled error:", message);
      return errorResponse(message, "INTERNAL_ERROR", 500);
    }
  },
} satisfies ExportedHandler<Env>;
