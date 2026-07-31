import type { SidecarRequest, SidecarResponse, SidecarTransport } from "./sidecarTypes";

export function createHealthRequest(): SidecarRequest {
  return {
    id: crypto.randomUUID(),
    method: "health",
    params: {}
  };
}

export function encodeSidecarRequest(request: SidecarRequest): string {
  return JSON.stringify(request);
}

export function decodeSidecarResponse<T>(payload: string): SidecarResponse<T> {
  return JSON.parse(payload) as SidecarResponse<T>;
}

export async function sendSidecarRequest<T>(
  request: SidecarRequest,
  transport: SidecarTransport
): Promise<SidecarResponse<T>> {
  const payload = await transport(encodeSidecarRequest(request));
  return decodeSidecarResponse<T>(payload);
}
