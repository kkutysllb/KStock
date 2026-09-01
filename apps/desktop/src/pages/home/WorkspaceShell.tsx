/**
 * 工作台外壳：侧栏（工作区/账户）+ 会话流 + 输入区 + 右侧研究上下文面板。
 * 从 Home.tsx 拆出（行为不变），一并收纳历史桶列表与上下文面板子组件。
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Archive,
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock,
  Cpu,
  ExternalLink,
  FileOutput,
  FileText,
  Folder,
  FolderOpen,
  FolderTree,
  FlaskConical,
  GitBranch,
  Library,
  ListTodo,
  Loader2,
  LogOut,
  PanelRight,
  Plus,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Square,
  Star,
  Trash2,
  Upload,
  UsersRound,
  Zap,
} from "lucide-react";
import { ChatFeed, type ChatFeedHandle } from "../../components/ChatFeed";
import { AttachmentChips, AttachmentPicker } from "../../components/AttachmentPicker";
import { BrandMenu } from "../../components/BrandMenu";
import { SidebarResizeHandle } from "../../components/SidebarResizeHandle";
import { UpdateButton } from "../../components/UpdateButton";
import { WelcomeHero } from "../../components/WelcomeHero";
import { subagentRoleLabel, subagentTimeoutMinutes } from "../../lib/subagentMeta";
import { GATEWAY_URL } from "../../lib/gatewayUrl";
import { mergeDeliveryFiles, resolveArtifactFetchHref, toAbsoluteUrl } from "../../lib/deliveryFiles";
import { ArtifactLinkContext, sanitizePreviewHtml } from "../../lib/artifactLinks";
import { Markdown } from "../../lib/markdown";
import {
  groupSessionsByTaskCategory,
  ARCHIVED_GROUP_KEY,
  type TaskGroupKey
} from "../../lib/taskCategory";
import type { ChatMessage, ChatSession } from "../../lib/sessionStore";
import type { ModelConfig } from "../../lib/modelsClient";
import type { AuthUser } from "../../lib/authClient";
import type { GeneralPreferences } from "../../lib/generalSettingsClient";
import type { DataSourceConfig } from "../../lib/dataSourcesClient";
import type { ReasoningMode, UploadedFileRef, WorkspaceChangeFile } from "../../lib/turnsClient";
import { fallbackDownloadBlob, getArtifactPreviewKind, readBlobText, saveArtifactBlob } from "./artifactPreview";
import { DataSourceIndicators } from "./DataSourceIndicators";
import { toggleWindowMaximize } from "./windowChrome";
import type { ArtifactPreview } from "./types";
// ────────────────────────── 推理模式选择器 ──────────────────────────
function ReasoningModePicker({
  model,
  value,
  onChange,
}: {
  model: ModelConfig | undefined;
  value: ReasoningMode;
  onChange: (mode: ReasoningMode) => void;
}) {
  const supportsEffort = Boolean(model?.supports_thinking && model.supports_reasoning_effort);
  const effectiveValue = supportsEffort || value === "auto" || value === "off" ? value : "auto";

  return (
    <label
      className="reasoning-mode-picker"
      title={supportsEffort ? "设置本次运行的推理强度" : "当前模型仅支持自动或关闭推理"}
    >
      <Brain size={14} aria-hidden="true" />
      <span>推理</span>
      <select
        aria-label="推理模式"
        value={effectiveValue}
        disabled={!model}
        onChange={(event) => onChange(event.target.value as ReasoningMode)}
      >
        <option value="auto">自动</option>
        <option value="off">关闭</option>
        {supportsEffort && <option value="low">低</option>}
        {supportsEffort && <option value="medium">中</option>}
        {supportsEffort && <option value="high">高</option>}
      </select>
    </label>
  );
}

export function WorkspaceShell({
  activeSession,
  currentUser,
  draft,
  rightPanelOpen,
  sessions,
  archivedSessions,
  sidebarCollapsed,
  sidebarWidth,
  historyCollapsed,
  collapsedBuckets,
  archiveBusySessionIds,
  generalPreferences,
  models,
  activeModel,
  reasoningMode,
  modelsLoading,
  sessionsLoaded,
  streamingId,
  editableUserMessageIds,
  onEditResend,
  onModelChange,
  onReasoningModeChange,
  onDraftChange,
  onClarifyPick,
  onLogout,
  onNewSession,
  onOpenIntegrations,
  onOpenReports,
  onOpenStrategies,
  onOpenFactors,
  onOpenSelections,
  onOpenSettings,
  onSelectSession,
  onDeleteSession,
  onArchiveSession,
  onUnarchiveSession,
  onToggleBucket,
  onSend,
  onStop,
  pendingAttachments,
  attachmentsLoading,
  onPickFiles,
  onRemoveAttachment,
  threadUploads,
  uploadsLoading,
  workspaceChanges,
  workspaceChangesLoading,
  onToggleRightPanel,
  onToggleSidebar,
  onResizeWorkspaceSidebar,
  onToggleHistory,
  dataSources
}: {
  activeSession: ChatSession | undefined;
  currentUser: AuthUser | null;
  draft: string;
  rightPanelOpen: boolean;
  sessions: ChatSession[];
  /** 「已归档」桶任务（从后端 includeArchived=true 拉取 + 本地刚归档的）。 */
  archivedSessions: ChatSession[];
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  historyCollapsed: boolean;
  /** 各历史桶的折叠态（会话内记忆，重启重置）。 */
  collapsedBuckets: Set<TaskGroupKey>;
  /** 正在归档/取消归档中的 session id（防护重复点击）。 */
  archiveBusySessionIds: ReadonlySet<string>;
  generalPreferences: GeneralPreferences;
  models: ModelConfig[];
  activeModel: string;
  reasoningMode: ReasoningMode;
  modelsLoading: boolean;
  sessionsLoaded: boolean;
  streamingId: string | null;
  editableUserMessageIds: ReadonlySet<string>;
  onEditResend: (messageId: string, replacementText: string) => Promise<void>;
  onModelChange: (name: string) => void;
  onReasoningModeChange: (mode: ReasoningMode) => void;
  onDraftChange: (draft: string) => void;
  /** ask_clarification 选项被选中并点“回复并确认”时回调（弹出确认输入框）。 */
  onClarifyPick: (text: string, question?: string) => void;
  onLogout: () => void;
  onNewSession: () => void;
  onOpenIntegrations: () => void;
  onOpenReports: () => void;
  onOpenStrategies: () => void;
  onOpenFactors: () => void;
  onOpenSelections: () => void;
  onOpenSettings: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onUnarchiveSession: (sessionId: string) => void;
  onToggleBucket: (bucket: TaskGroupKey) => void;
  onSend: (model: string) => void;
  onStop: () => void;
  pendingAttachments: UploadedFileRef[];
  attachmentsLoading: boolean;
  onPickFiles: (files: File[]) => void;
  onRemoveAttachment: (filename: string) => void;
  threadUploads: UploadedFileRef[];
  uploadsLoading: boolean;
  workspaceChanges: WorkspaceChangeFile[];
  workspaceChangesLoading: boolean;
  onToggleRightPanel: () => void;
  onToggleSidebar: () => void;
  onResizeWorkspaceSidebar: (width: number) => void;
  onToggleHistory: () => void;
  dataSources: DataSourceConfig[];
}) {
  const messages = activeSession?.messages ?? [];
  const activeModelConfig = models.find((model) => model.name === activeModel);
  const latestUsage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.usage);
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const taskTokens = latestUsage?.usage?.total_tokens ?? 0;
  const todos = latestAssistant?.todos ?? [];
  const subagents = latestAssistant?.subagents ?? [];
  // 浮动面板只展示本任务实际读取过的技能（引擎 skill_context）。
  // 不再回退到会话/全局默认技能库，避免把“可用技能总数”误显示成“当前任务技能数”。
  const taskSkills = latestAssistant?.skills ?? [];
  const uploadPanelFiles = mergeUploadPanelFiles(threadUploads, pendingAttachments);
  const deliveryFiles = mergeDeliveryFiles(activeSession?.threadId, latestAssistant?.artifacts, workspaceChanges);
  // ChatFeed 命令式 ref + 贴底状态：驱动「回到底部」浮动按钮。
  const feedRef = useRef<ChatFeedHandle>(null);
  const [feedAtBottom, setFeedAtBottom] = useState(true);
  const scrollToBottom = () => feedRef.current?.scrollToBottom("smooth");
  // 账户操作默认收起，避免长期占用侧栏底部空间。
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  // 交付/上传文件预览：fetch + srcdoc 应用内预览（导航式打开不带会话 cookie，会触发 401）。
  // 使用 iframe srcdoc 而非 blob URL：blob 在 sandbox iframe 中产生 opaque origin，
  // 导致 module 脚本 CORS 失败、根绝对路径资源无法解析；srcdoc 直接内联 HTML，无此问题。
  const [artifactPreview, setArtifactPreview] = useState<ArtifactPreview | null>(null);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [artifactSaving, setArtifactSaving] = useState(false);
  // 打开请求序号：连续/双击链接时丢弃过期请求，关闭预览时使 pending 请求失效。
  const openSeqRef = useRef(0);
  // 线程 ID 追踪：openArtifact 需要把它拼成 gateway artifact API URL，
  // 用 ref 避免每次线程切换都重建 callback（触发 Context Provider 全量 re-render）。
  const threadIdRef = useRef<string | undefined>(undefined);
  threadIdRef.current = activeSession?.threadId;

  const openArtifact = useCallback(async (href: string, name: string) => {
    const seq = ++openSeqRef.current;
    setArtifactError(null);
    // 打包态面板传入 app://localhost/gateway/api/… 绝对地址，dev 态为
    // http(s):// 绝对地址或引擎输出的相对文件路径（/mnt/user-data/…），
    // 统一经 resolveArtifactFetchHref 解析：绝对地址直接 fetch，相对路径
    // 转 gateway artifact API URL（避免被页面 origin 解析成 SPA fallback）。
    const absoluteHref = resolveArtifactFetchHref(href, threadIdRef.current ?? "");
    try {
      const response = await fetch(absoluteHref, { credentials: "include" });
      if (!response.ok) throw new Error(`加载失败（${response.status}）`);
      const blob = await response.blob();
      if (seq !== openSeqRef.current) return; // 已关闭/已被新请求取代，丢弃
      const previewKind = getArtifactPreviewKind(name, blob.type);
      if (previewKind === "html") {
        // srcdoc iframe 仍需清洗：移除 module 脚本（sandbox 下必然失败），
        // 根绝对路径资源回源到文件所在 origin。
        const text = await readBlobText(blob);
        const cleaned = sanitizePreviewHtml(text, new URL(absoluteHref, GATEWAY_URL).origin);
        setArtifactPreview({ kind: "html", name, downloadHref: absoluteHref, htmlContent: cleaned });
      } else if (previewKind === "markdown" || previewKind === "text") {
        const text = await readBlobText(blob);
        setArtifactPreview({ kind: previewKind, name, downloadHref: absoluteHref, text });
      } else {
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(downloadUrl);
      }
    } catch (err) {
      if (seq !== openSeqRef.current) return; // 过期请求的失败不打扰当前状态
      setArtifactError(err instanceof Error ? err.message : "文件加载失败");
    }
  }, []);

  const closeArtifactPreview = useCallback(() => {
    openSeqRef.current += 1; // 使所有 pending 的打开请求失效
    setArtifactPreview(null);
  }, []);

  const saveArtifactPreview = useCallback(async () => {
    if (!artifactPreview || artifactSaving) return;
    setArtifactError(null);
    setArtifactSaving(true);
    try {
      const response = await fetch(artifactPreview.downloadHref, { credentials: "include" });
      if (!response.ok) throw new Error(`下载失败（${response.status}）`);
      const blob = await response.blob();
      const saveResult = await saveArtifactBlob(artifactPreview.name, blob);
      if (saveResult === "unsupported") {
        fallbackDownloadBlob(artifactPreview.name, blob);
      }
    } catch (err) {
      setArtifactError(err instanceof Error ? err.message : "文件下载失败");
    } finally {
      setArtifactSaving(false);
    }
  }, [artifactPreview, artifactSaving]);
  return (
    <ArtifactLinkContext.Provider value={openArtifact}>
      <div
        className={`workspace-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${rightPanelOpen ? "context-open" : ""} density-${generalPreferences.density} ${generalPreferences.reduce_motion ? "reduce-motion" : ""}`}
        style={{ "--workspace-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
      <aside className="codex-sidebar" aria-label="工作区侧边栏">
        <div className="sidebar-title">
          {!sidebarCollapsed && <BrandMenu variant="workspace" />}
        </div>
        <div className="nav-stack">
          <button className="nav-command" type="button" onClick={onNewSession}>
            <Plus size={17} />
            {!sidebarCollapsed && <span>新研究</span>}
          </button>
          <button className="nav-command" type="button" onClick={onOpenReports}>
            <Library size={17} />
            {!sidebarCollapsed && <span>报告库</span>}
          </button>
          <button className="nav-command" type="button" onClick={onOpenStrategies}>
            <GitBranch size={17} />
            {!sidebarCollapsed && <span>策略库</span>}
          </button>
          <button className="nav-command" type="button" onClick={onOpenFactors}>
            <FlaskConical size={17} />
            {!sidebarCollapsed && <span>因子库</span>}
          </button>
          <button className="nav-command" type="button" onClick={onOpenSelections}>
            <Star size={17} />
            {!sidebarCollapsed && <span>选股库</span>}
          </button>
          <button className="nav-command" type="button" onClick={onOpenIntegrations}>
            <Sparkles size={17} />
            {!sidebarCollapsed && <span>技能与插件</span>}
          </button>
        </div>
        {!sidebarCollapsed && (
          <>
            <button
              type="button"
              className="side-section-header"
              aria-expanded={!historyCollapsed}
              onClick={onToggleHistory}
            >
              <FolderTree size={16} className="side-section-icon" aria-hidden="true" />
              <span className="side-section-title">工作区</span>
              <span className="side-section-count">{sessions.length + archivedSessions.length}</span>
              <ChevronRight
                size={13}
                className={!historyCollapsed ? "chevron-expanded" : ""}
                aria-hidden="true"
              />
            </button>
            {!historyCollapsed && (
              <div className="session-strip">
                {sessions.length === 0 && archivedSessions.length === 0 ? (
                  <p className="session-empty">工作区暂无任务</p>
                ) : (
                  <WorkspaceTaskList
                    sessions={sessions}
                    archivedSessions={archivedSessions}
                    activeSessionId={activeSession?.id}
                    collapsedBuckets={collapsedBuckets}
                    archiveBusySessionIds={archiveBusySessionIds}
                    onSelectSession={onSelectSession}
                    onDeleteSession={onDeleteSession}
                    onArchiveSession={onArchiveSession}
                    onUnarchiveSession={onUnarchiveSession}
                    onToggleBucket={onToggleBucket}
                  />
                )}
              </div>
            )}
          </>
        )}
        <div className="sidebar-footer">
          <div className="sidebar-footer-row">
            <button
              className="nav-command sidebar-account-trigger"
              type="button"
              title={currentUser?.email ?? "未登录"}
              aria-expanded={accountMenuOpen}
              aria-controls="sidebar-account-actions"
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <CircleUserRound size={17} />
              {!sidebarCollapsed && (
                <>
                  <span>{currentUser?.email ?? "未登录"}</span>
                  <ChevronRight
                    className={accountMenuOpen ? "chevron-expanded" : ""}
                    size={14}
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
            <UpdateButton />
          </div>
          {accountMenuOpen && !sidebarCollapsed && (
            <div id="sidebar-account-actions" className="sidebar-account-actions">
              <button className="nav-command" type="button" onClick={onOpenSettings} aria-label="打开设置">
                <Settings size={17} />
                <span>设置</span>
              </button>
              <button className="nav-command" type="button" onClick={onLogout} aria-label="退出登录">
                <LogOut size={17} />
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>
      </aside>
      {!sidebarCollapsed && (
        <SidebarResizeHandle
          width={sidebarWidth}
          minWidth={180}
          maxWidth={360}
          label="调整工作区侧栏宽度"
          onResize={onResizeWorkspaceSidebar}
        />
      )}

      <main className="conversation-stage">
        <header
          className="workspace-topbar"
          onDoubleClick={toggleWindowMaximize}
        >
          <div>
            <button
              className="icon-ghost workspace-sidebar-toggle"
              type="button"
              onClick={onToggleSidebar}
              aria-label={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
            >
              {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
            <Folder size={17} />
            <strong title={activeSession?.title ?? "新研究会话"}>{activeSession?.title ?? "新研究会话"}</strong>
          </div>
          <div className="research-status-bar" aria-label="系统连接状态">
            <em><span className="status-pulse" />QiLin 已连接</em>
            <DataSourceIndicators dataSources={dataSources} />
          </div>
          <div className="topbar-actions">
            <span className="task-token-count" aria-label={`当前任务消耗 ${taskTokens.toLocaleString("en-US")} tokens`}>
              <Zap size={13} />
              {taskTokens.toLocaleString("en-US")} tokens
            </span>
            <button className="icon-ghost" type="button" onClick={onToggleRightPanel} aria-label="显示环境信息">
              <PanelRight size={17} />
            </button>
          </div>
        </header>

        <section className="message-canvas" aria-label="对话工作台">
          <ChatFeed
            ref={feedRef}
            messages={messages}
            streamingId={streamingId ?? undefined}
            autoScroll={generalPreferences.auto_scroll}
            showStage={generalPreferences.show_stage}
            showReasoning={generalPreferences.show_reasoning}
            showToolCalls={generalPreferences.show_tool_calls}
            editableUserMessageIds={editableUserMessageIds}
            editDisabled={Boolean(streamingId)}
            onEditResend={onEditResend}
            onAtBottomChange={setFeedAtBottom}
            onClarifyPick={onClarifyPick}
            emptySlot={<WelcomeHero />}
          />
        </section>

        <section className="composer-dock" aria-label="消息输入区">
          {!feedAtBottom && (
            <button
              type="button"
              className="scroll-to-bottom-button"
              aria-label="回到底部"
              onClick={scrollToBottom}
            >
              <ChevronDown size={18} />
            </button>
          )}
          <AttachmentChips
            attachments={pendingAttachments}
            loading={attachmentsLoading}
            onRemove={onRemoveAttachment}
          />
          <textarea
            aria-label="消息输入"
            value={draft}
            placeholder="要求 KStock 完成一个投研任务，例如：分析贵州茅台最近一季财报，并生成报告。"
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              const modifier = event.metaKey || event.ctrlKey;
              const sendByEnter = generalPreferences.send_shortcut === "enter";
              if (sendByEnter) {
                // Enter 发送；Cmd/Ctrl+Enter（macOS 用 ⌘、Win/Linux 用 Ctrl）或
                // Shift+Enter 插入换行（不拦截，走 textarea 默认行为）。
                if (event.key !== "Enter" || modifier || event.shiftKey) return;
              } else {
                // mod_enter：Enter 换行；Cmd/Ctrl+Enter 发送。
                if (event.key !== "Enter" || !modifier || event.shiftKey) return;
              }
              if (!draft.trim() || streamingId || !activeModel || !sessionsLoaded) return;
              event.preventDefault();
              onSend(activeModel);
            }}
          />
          <div className="composer-toolbar">
            <AttachmentPicker
              loading={attachmentsLoading}
              disabled={!!streamingId}
              onPickFiles={onPickFiles}
            />
            {modelsLoading ? (
              <span className="model-picker loading">模型加载中…</span>
            ) : models.length === 0 ? (
              <span className="model-picker empty">未配置模型（请到设置页添加）</span>
            ) : (
              <label className="model-picker">
                <Cpu size={15} />
                <select aria-label="模型选择" value={activeModel} onChange={(e) => onModelChange(e.target.value)}>
                  {models.map((m) => (
                    <option key={m.name} value={m.name}>{m.display_name || m.name}</option>
                  ))}
                </select>
              </label>
            )}
            <ReasoningModePicker
              model={activeModelConfig}
              value={reasoningMode}
              onChange={onReasoningModeChange}
            />
            {streamingId ? (
              <button className="send-button stop" type="button" onClick={onStop} aria-label="停止生成">
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button className="send-button" type="button" onClick={() => onSend(activeModel)} disabled={!activeModel || !sessionsLoaded} aria-label="发送消息">
                <Send size={18} />
              </button>
            )}
          </div>
        </section>
      </main>

      <aside className={`floating-context-panel ${rightPanelOpen ? "open" : ""}`} aria-label="研究上下文">
        <div className="floating-header">
          <strong>研究上下文</strong>
        </div>
        <ContextSection icon={Activity} title="任务摘要" count={latestAssistant?.summaryText ? 1 : 0}>
          {latestAssistant?.summaryText ? (
            <div className="context-summary-text">{latestAssistant.summaryText}</div>
          ) : (
            <ContextEmpty>
              {latestAssistant ? "当前对话尚未生成摘要（未触发自动压缩）" : "暂无任务"}
            </ContextEmpty>
          )}
        </ContextSection>

        <ContextSection icon={Cpu} title="运行状态" count={latestAssistant ? 1 : 0}>
          <ContextLine icon={Activity} label="任务状态" value={taskStatusLabel(latestAssistant?.status)} />
          <ContextLine icon={Cpu} label="QiLin 引擎" value="已连接" />
          {taskSkills.length > 0 && <ContextLine icon={Sparkles} label="技能" value={`${taskSkills.length} 个`} />}
          {latestAssistant?.stage && <ContextLine icon={FileText} label="当前阶段" value={latestAssistant.stage} />}
        </ContextSection>

        <ContextSection icon={ListTodo} title="Todo" count={todos.length}>
          {todos.length === 0 ? (
            <ContextEmpty>当前任务未创建 Todo</ContextEmpty>
          ) : (
            <div className="context-todo-list">
              {todos.map((todo, index) => (
                <div className={`context-todo-item ${todo.status}`} key={`${todo.content}-${index}`}>
                  {todo.status === "completed" ? <CheckCircle2 size={14} /> : todo.status === "in_progress" ? <Loader2 size={14} className="spin" /> : <span className="context-todo-dot" />}
                  <span>{todo.content}</span>
                </div>
              ))}
            </div>
          )}
        </ContextSection>

        <ContextSection icon={UsersRound} title="Subagent 调用" count={subagents.length}>
          {subagents.length === 0 ? (
            <ContextEmpty>当前任务未调用 Subagent</ContextEmpty>
          ) : (
            <div className="context-subagent-list">
              {subagents.map((agent) => {
                // 角色名优先（内置角色有中文名），description 是 Lead 生成
                // 的 3-5 词临时描述，仅作任务内容副标题。
                const roleLabel = subagentRoleLabel(agent.role);
                const timeoutMinutes = subagentTimeoutMinutes(agent.role);
                return (
                  <details className="context-subagent" key={agent.taskId} open={agent.status === "running"}>
                    <summary>
                      <span className="context-subagent-title"><Bot size={14} />{roleLabel ?? agent.description ?? agent.taskId}</span>
                      <em className={`subagent-status ${agent.status}`}>{subagentStatusLabel(agent.status)}</em>
                    </summary>
                    {agent.description && roleLabel && agent.description !== roleLabel && (
                      <div className="context-subagent-desc">{agent.description}</div>
                    )}
                    <div className="context-subagent-meta">
                      {agent.model || "默认模型"}
                      {timeoutMinutes != null ? ` · 预计最长 ${timeoutMinutes} 分钟` : ""}
                      {` · ${agent.steps.length} 个步骤`}
                    </div>
                    {agent.steps.length > 0 && (
                      <div className="context-subagent-steps">
                        {agent.steps.slice(-3).map((step) => <p key={step.index}>{step.text || `步骤 ${step.index}`}</p>)}
                      </div>
                    )}
                  </details>
                );
              })}
            </div>
          )}
        </ContextSection>

        <ContextSection icon={Upload} title="上传文件" count={uploadPanelFiles.length}>
          {uploadsLoading ? <ContextEmpty>正在读取上传目录…</ContextEmpty> : uploadPanelFiles.length === 0 ? (
            <ContextEmpty>当前任务没有上传文件</ContextEmpty>
          ) : (
            <div className="context-file-list">
              {uploadPanelFiles.map(({ file, pending }) => (
                <ContextFileRow
                  key={file.filename}
                  name={file.original_filename || file.filename}
                  meta={`${pending ? "待发送 · " : ""}${formatFileSize(file.size)}${file.markdown_file ? " · 已转换 Markdown" : ""}`}
                  href={file.artifact_url ? toAbsoluteUrl(file.artifact_url) : undefined}
                  onOpen={openArtifact}
                />
              ))}
            </div>
          )}
        </ContextSection>

        <ContextSection icon={FileOutput} title="交付文件" count={deliveryFiles.length}>
          {workspaceChangesLoading ? <ContextEmpty>正在读取本次 run 的交付记录…</ContextEmpty> : deliveryFiles.length === 0 ? (
            <ContextEmpty>当前任务暂无交付文件</ContextEmpty>
          ) : (
            <div className="context-file-list">
              {deliveryFiles.map((file) => (
                <ContextFileRow
                  key={file.key}
                  name={file.name}
                  meta={`${file.status === "modified" ? "已更新" : "已生成"}${file.size != null ? ` · ${formatFileSize(file.size)}` : ""}`}
                  href={file.url}
                  external
                  onOpen={openArtifact}
                />
              ))}
            </div>
          )}
        </ContextSection>
      </aside>
      {artifactError && createPortal(
        <p className="artifact-error" role="alert">{artifactError}</p>,
        document.body,
      )}
      {artifactPreview && createPortal(
        <div className="report-preview-overlay" role="dialog" aria-modal="true" aria-label={artifactPreview.name} style={{ zIndex: 99999 }}>
          <div className="report-preview-dialog">
            <div className="report-preview-bar">
              <strong className="report-preview-title">{artifactPreview.name}</strong>
              <div className="report-preview-actions">
                <button className="subtle-button" type="button" onClick={saveArtifactPreview} disabled={artifactSaving}>
                  {artifactSaving ? "保存中…" : "下载"}
                </button>
                <button className="preview-back-button" type="button" onClick={closeArtifactPreview}>
                  <ArrowLeft size={14} />
                  返回任务页面
                </button>
              </div>
            </div>
            {artifactPreview.kind === "html" ? (
              <iframe title={artifactPreview.name} srcDoc={artifactPreview.htmlContent} sandbox="allow-scripts" />
            ) : (
              <div className="artifact-preview-content">
                {artifactPreview.kind === "markdown" ? (
                  <Markdown>{artifactPreview.text}</Markdown>
                ) : (
                  <pre>{artifactPreview.text}</pre>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
      </div>
    </ArtifactLinkContext.Provider>
  );
}

/**
 * 工作区任务列表：按任务种类分组折叠展示（taskCategory.ts 纯读侧分类，
 * 标题关键词推导——已存在的历史任务渲染时即按种类归类）。
 * 「已归档」组沿用原语义，单独靠 archivedSessions 驱动，置于种类分组之后。
 */
function WorkspaceTaskList({
  sessions,
  archivedSessions,
  activeSessionId,
  collapsedBuckets,
  archiveBusySessionIds,
  onSelectSession,
  onDeleteSession,
  onArchiveSession,
  onUnarchiveSession,
  onToggleBucket,
}: {
  sessions: ChatSession[];
  archivedSessions: ChatSession[];
  activeSessionId: string | undefined;
  collapsedBuckets: Set<TaskGroupKey>;
  archiveBusySessionIds: ReadonlySet<string>;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onUnarchiveSession: (sessionId: string) => void;
  onToggleBucket: (bucket: TaskGroupKey) => void;
}) {
  // 任务种类分组：sessions（未归档）按标题关键词分类；空组不出现，固定顺序。
  const groups = groupSessionsByTaskCategory(sessions);
  const hasArchived = archivedSessions.length > 0;

  return (
    <>
      {groups.map((group) => (
        <TaskGroupBlock
          key={group.key}
          groupKey={group.key}
          label={group.label}
          sessions={group.sessions}
          collapsed={collapsedBuckets.has(group.key)}
          activeSessionId={activeSessionId}
          archiveBusySessionIds={archiveBusySessionIds}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          onArchiveSession={onArchiveSession}
          onToggleBucket={onToggleBucket}
        />
      ))}
      {hasArchived && (
        <TaskGroupBlock
          groupKey={ARCHIVED_GROUP_KEY}
          label="已归档"
          sessions={archivedSessions}
          collapsed={collapsedBuckets.has(ARCHIVED_GROUP_KEY)}
          activeSessionId={activeSessionId}
          archiveBusySessionIds={archiveBusySessionIds}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          onArchiveSession={onArchiveSession}
          onUnarchiveSession={onUnarchiveSession}
          onToggleBucket={onToggleBucket}
        />
      )}
    </>
  );
}

/** 单个任务种类分组的折叠区块。 */
function TaskGroupBlock({
  groupKey,
  label,
  sessions,
  collapsed,
  activeSessionId,
  archiveBusySessionIds,
  onSelectSession,
  onDeleteSession,
  onArchiveSession,
  onUnarchiveSession,
  onToggleBucket,
}: {
  groupKey: TaskGroupKey;
  label: string;
  sessions: ChatSession[];
  collapsed: boolean;
  activeSessionId: string | undefined;
  archiveBusySessionIds: ReadonlySet<string>;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onUnarchiveSession?: (sessionId: string) => void;
  onToggleBucket: (bucket: TaskGroupKey) => void;
}) {
  return (
    <div className="session-bucket">
      <button
        type="button"
        className="side-bucket-header"
        aria-expanded={!collapsed}
        onClick={() => onToggleBucket(groupKey)}
      >
        {collapsed ? (
          <Folder size={13} aria-hidden="true" />
        ) : (
          <FolderOpen size={13} aria-hidden="true" />
        )}
        <span className="side-section-label">{label}</span>
        <span className="side-section-count">{sessions.length}</span>
      </button>
      {!collapsed && (
        <div className="session-bucket-list">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              active={session.id === activeSessionId}
              archived={groupKey === ARCHIVED_GROUP_KEY}
              busy={archiveBusySessionIds.has(session.id)}
              onSelectSession={onSelectSession}
              onDeleteSession={onDeleteSession}
              onArchiveSession={onArchiveSession}
              onUnarchiveSession={onUnarchiveSession}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 单个工作区任务行。根据分组上下文展示不同动作：
 * - 归档桶：取消归档（调回主列表） + 删除
 * - 其他桶：归档（需 threadId） + 删除
 * 本地新建无 threadId 的 session 只能删除，不能归档。
 */
function SessionRow({
  session,
  active,
  archived,
  busy,
  onSelectSession,
  onDeleteSession,
  onArchiveSession,
  onUnarchiveSession,
}: {
  session: ChatSession;
  active: boolean;
  archived: boolean;
  busy: boolean;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onUnarchiveSession?: (sessionId: string) => void;
}) {
  const canArchive = !archived && Boolean(session.threadId);
  const canUnarchive = archived && Boolean(session.threadId);
  return (
    <div className={`session-row ${active ? "active" : ""} ${busy ? "busy" : ""}`}>
      <button
        className="session-row-main"
        type="button"
        onClick={() => onSelectSession(session.id)}
      >
        <strong title={session.title}>{session.title}</strong>
        <span className="session-meta">
          <Clock size={11} />
          {session.updatedAt}
        </span>
      </button>
      {canArchive && (
        <button
          className="session-row-icon"
          type="button"
          aria-label={`归档任务 ${session.title}`}
          title="归档（从主列表移除，可从「已归档」恢复）"
          disabled={busy}
          onClick={() => onArchiveSession(session.id)}
        >
          <Archive size={12} />
        </button>
      )}
      {canUnarchive && onUnarchiveSession && (
        <button
          className="session-row-icon"
          type="button"
          aria-label={`取消归档任务 ${session.title}`}
          title="取消归档（调回主列表）"
          disabled={busy}
          onClick={() => onUnarchiveSession(session.id)}
        >
          <RotateCcw size={12} />
        </button>
      )}
      <button
        className="session-row-icon session-row-delete"
        type="button"
        aria-label={`删除任务 ${session.title}`}
        title="删除任务"
        disabled={busy}
        onClick={() => onDeleteSession(session.id)}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function ContextLine({
  icon: Icon,
  label,
  value
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="context-line">
      <span><Icon size={16} /> {label}</span>
      {value && <em>{value}</em>}
    </div>
  );
}

function ContextSection({
  icon: Icon,
  title,
  count,
  children
}: {
  icon: typeof FileText;
  title: string;
  count: number;
  children: ReactNode;
}) {
  // 无内容的 section 默认折叠；有内容默认展开。
  // 内容从「空」首次变为「非空」时自动展开一次（让用户看到新出现的详情）；
  // 用户手动收起后保持收起，不会被同值 count 反复撑开。
  const [collapsed, setCollapsed] = useState(count === 0);
  const wasEmptyRef = useRef(count === 0);
  useEffect(() => {
    if (wasEmptyRef.current && count > 0) {
      setCollapsed(false);
      wasEmptyRef.current = false;
    } else if (count === 0) {
      wasEmptyRef.current = true;
    }
  }, [count]);
  return (
    <section className="context-section">
      <button
        type="button"
        className="context-section-heading"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span><Icon size={15} />{title}</span>
        <em>{count}</em>
        <ChevronRight
          size={13}
          className={!collapsed ? "chevron-expanded" : ""}
          aria-hidden="true"
        />
      </button>
      {!collapsed && children}
    </section>
  );
}

function ContextEmpty({ children }: { children: ReactNode }) {
  return <p className="context-empty">{children}</p>;
}

function ContextFileRow({
  name,
  meta,
  href,
  external = false,
  onOpen
}: {
  name: string;
  meta: string;
  href?: string;
  external?: boolean;
  onOpen?: (href: string, name: string) => void;
}) {
  const content = <><span className="context-file-name">{name}</span><em>{meta}</em></>;
  if (!href) return <div className="context-file-row">{content}</div>;
  return <button className="context-file-row linked" type="button" onClick={() => onOpen?.(href, name)} title="打开文件">{content}{external ? <ExternalLink size={13} /> : <ArrowLeft size={13} />}</button>;
}

function taskStatusLabel(status?: ChatMessage["status"]): string {
  if (status === "streaming") return "执行中";
  if (status === "needs_input") return "等待回复";
  if (status === "done") return "已完成";
  if (status === "error") return "执行失败";
  if (status === "compacted") return "已压缩";
  return "等待输入";
}

function subagentStatusLabel(status: NonNullable<ChatMessage["subagents"]>[number]["status"]): string {
  if (status === "running") return "运行中";
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  if (status === "timed_out") return "超时";
  return "已取消";
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function mergeUploadPanelFiles(
  uploaded: UploadedFileRef[],
  pending: UploadedFileRef[]
): Array<{ file: UploadedFileRef; pending: boolean }> {
  const byName = new Map<string, { file: UploadedFileRef; pending: boolean }>();
  uploaded.forEach((file) => byName.set(file.filename, { file, pending: false }));
  pending.forEach((file) => {
    const existing = byName.get(file.filename)?.file;
    byName.set(file.filename, {
      file: existing ? { ...existing, ...file } : file,
      pending: true
    });
  });
  return [...byName.values()];
}
