import type { SidecarRequest, SidecarResponse, SidecarTransport } from "./sidecarTypes";

export function createHealthRequest(): SidecarRequest {
  return {
    id: crypto.randomUUID(),
    method: "health",
    params: {}
  };
}

export function createWorkspaceInfoRequest(): SidecarRequest {
  return {
    id: crypto.randomUUID(),
    method: "workspace.info",
    params: {}
  };
}

export function createThreadCreateRequest(title?: string, projectId?: string): SidecarRequest {
  return {
    id: crypto.randomUUID(),
    method: "thread.create",
    params: {
      ...(title ? { title } : {}),
      ...(projectId ? { projectId } : {})
    }
  };
}

export function createArtifactListRequest(threadId: string, projectId?: string): SidecarRequest {
  return {
    id: crypto.randomUUID(),
    method: "artifact.list",
    params: {
      threadId,
      ...(projectId ? { projectId } : {})
    }
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
