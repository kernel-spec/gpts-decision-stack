export function handleHealth(): Response {
  return Response.json({
    ok: true,
    data: {
      status: "ok",
      service: "gpts-decision-stack-worker",
      timestamp: new Date().toISOString(),
    },
  });
}
