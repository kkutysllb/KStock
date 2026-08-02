import { artifactUrl } from "./turnsClient";
import type { WorkspaceChangeFile } from "./turnsClient";
import { GATEWAY_URL } from "./gatewayUrl";

export type DeliveryFile = {
  key: string;
  name: string;
  url?: string;
  size?: number;
  status: string;
};

/** 引擎可能同时上报虚拟路径(/outputs/…)与真实路径(/mnt/user-data/outputs/…)，
 * 二者指向同一文件；统一归一化为虚拟路径，用于交付面板去重。 */
export function normalizeVirtualPath(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  const prefix = "mnt/user-data/outputs/";
  if (trimmed.startsWith(prefix)) {
    return `/outputs/${trimmed.slice(prefix.length)}`;
  }
  return path;
}

export function toAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, GATEWAY_URL).toString();
}

/** 合并引擎 artifacts（虚拟/真实路径可能并存）与 workspace 变更文件，
 * 按归一化虚拟路径去重：同一文件只保留一条，URL 优先取 artifacts 显式值。 */
export function mergeDeliveryFiles(
  threadId: string | undefined,
  artifacts: unknown[] | undefined,
  workspaceFiles: WorkspaceChangeFile[]
): DeliveryFile[] {
  const byPath = new Map<string, DeliveryFile>();
  for (const raw of artifacts ?? []) {
    const item =
      typeof raw === "string" ? { path: raw } : raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    if (!item) continue;
    const rawPath = typeof item.path === "string" ? item.path : typeof item.virtual_path === "string" ? item.virtual_path : "";
    const explicitUrl = typeof item.artifact_url === "string" ? item.artifact_url : undefined;
    if (!rawPath && !explicitUrl) continue;
    const path = rawPath ? normalizeVirtualPath(rawPath) : "";
    const key = path || explicitUrl!;
    const name = (path || explicitUrl!).split("/").pop() || "交付文件";
    byPath.set(key, {
      key,
      name,
      url: threadId ? (explicitUrl ? toAbsoluteUrl(explicitUrl) : artifactUrl(threadId, path)) : undefined,
      status: "created",
    });
  }
  for (const file of workspaceFiles) {
    if (file.status === "deleted" || (file.root && file.root !== "outputs")) continue;
    const path = normalizeVirtualPath(file.path);
    const name = path.split("/").pop() || path;
    const existing = byPath.get(path);
    byPath.set(path, {
      key: path,
      name,
      url: existing?.url ?? (threadId ? artifactUrl(threadId, path) : undefined),
      size: file.size_after ?? undefined,
      status: file.status,
    });
  }
  return [...byPath.values()];
}
