import type { SidecarRequest, SidecarResponse } from "./sidecarTypes";

export function createHealthRequest(): SidecarRequest {
  return {
    id: crypto.randomUUID(),
    method: "health",
    params: {}
  };
}

export async function sendSidecarRequest(
  request: SidecarRequest
): Promise<SidecarResponse> {
  return {
    id: request.id,
    ok: true,
    result: { method: request.method }
  };
}
