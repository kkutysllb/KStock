export interface WorkspaceInfo {
  appDataDir: string;
  activeUserId: string;
  qilinHome: string;
  qilinDataDir: string;
  runtimeConfigPath: string;
  productDbPath: string;
  skillRoot: string;
  developmentFallback: boolean;
}

export interface ThreadCreateResult {
  threadId: string;
  userId: string;
  title?: string | null;
  createdAt: string;
  paths: {
    workspace: string;
    uploads: string;
    outputs: string;
    hostThreadDir: string;
  };
}

export interface ArtifactListResult {
  threadId: string;
  count: number;
  artifacts: Array<{
    id: string;
    filename: string;
    virtualPath: string;
    hostPath: string;
    mimeType: string;
    size: number;
  }>;
}
