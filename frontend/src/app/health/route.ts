import type { HealthResponse } from "@dra/contracts";

export function GET() {
  return Response.json({ status: "ok" } satisfies HealthResponse);
}
