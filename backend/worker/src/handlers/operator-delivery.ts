import type { Env } from "../types/index.js";
import { errorResponse } from "../router.js";
import * as operatorDeliveryService from "../services/operator-delivery.js";

export async function handleGetRunDeliverySummary(
  session_id: string,
  env: Env
): Promise<Response> {
  const summary = await operatorDeliveryService.getRunDeliverySummary(
    env.DECISIONS_DB,
    session_id
  );
  if (!summary) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }
  return Response.json({ ok: true, data: summary });
}

export async function handleGetRunDeliveryHistory(
  session_id: string,
  env: Env
): Promise<Response> {
  const history = await operatorDeliveryService.getRunDeliveryHistory(
    env.DECISIONS_DB,
    session_id
  );
  if (!history) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }
  return Response.json({ ok: true, data: history });
}

export async function handleGetRunNextAction(
  session_id: string,
  env: Env
): Promise<Response> {
  const result = await operatorDeliveryService.getRunNextAction(
    env.DECISIONS_DB,
    session_id
  );
  if (!result) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }
  return Response.json({ ok: true, data: result });
}
