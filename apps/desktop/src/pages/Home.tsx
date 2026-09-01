/**
 * 应用根页面：负责认证探测、视图路由（落地页/登录/工作台/设置/报告库/策略库）、
 * 会话状态与流式 run 编排。页面级组件拆分在同目录 home/ 下。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onMenuCommand, showDesktopNotification } from "../lib/desktopBridge";
import {
  getSetupStatus,
  logout as gatewayLogout,
  tryGetCurrentUser,
  type AuthUser,
  type SetupStatus
} from "../lib/authClient";
import { listModels, type ModelConfig } from "../lib/modelsClient";
import {
  appendMessageToSession,
  appendTurnToSession,
  bindThreadId,
  createAssistantTurn,
  createSession,
  setSessionMessages,
  threadToSession,
  updateMessageInSession,
  type ChatSession
} from "../lib/sessionStore";
import {
  archiveThread,
  cancelRun,
  createThreadBranch,
  deleteThread,
  deleteUpload,
  ensureThread,
  fetchThreadMessages,
  getWorkspaceChanges,
  listThreads,
  listUploads,
  prepareEditRegenerate,
  runContextFromModel,
  streamRun,
  uploadFiles,
  type ReasoningMode,
  type RunCheckpoint,
  type RunInput,
  type UploadedFileRef,
  type WorkspaceChangeFile,
} from "../lib/turnsClient";
import {
  DEFAULT_COLLAPSED_BUCKETS,
  selectStaleSessions,
  type HistoryBucket,
} from "../lib/historyGrouping";
import {
  buildEditedBranchSession,
  editableUserMessageIds,
  prepareEditedBranch,
  selectEditModel
} from "../lib/editResend";
import { engineMessagesToChatMessages } from "../lib/engineHistory";
import { initialTurn, reduceFrame } from "../lib/turnReducer";
import { inferStage } from "../lib/stageInferrer";
import { getDataSourceStatus, type DataSourceConfig } from "../lib/dataSourcesClient";
import { listScheduledTaskRuns, listScheduledTasks } from "../lib/scheduledTasksClient";
import {
  DEFAULT_GENERAL_PREFERENCES,
  getGeneralPreferences,
  updateGeneralPreferences,
  type GeneralPreferences,
} from "../lib/generalSettingsClient";
import { SETTING_SECTIONS } from "../lib/qilinSettings";
import { ClarifyInputDialog } from "../components/ClarifyInputDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LogoMark } from "../components/LogoMark";
import { ReportLibrary } from "../components/ReportLibrary";
import { StrategiesLibrary } from "../components/StrategiesLibrary";
import { AuthPage } from "./home/AuthPage";
import { LandingPage } from "./home/LandingPage";
import { SettingsPage } from "./home/SettingsPage";
import { WorkspaceShell } from "./home/WorkspaceShell";
import type { AuthMode } from "./home/types";
type ViewMode = "landing" | "auth" | "workspace" | "settings" | "reports" | "strategies";
type DesktopMenuCommand =
  | "new-task"
  | "open-settings"
  | "open-reports"
  | "open-strategies"
  | "check-update";

const WORKSPACE_SIDEBAR_WIDTH_KEY = "kstock.workspaceSidebarWidth";
const SETTINGS_SIDEBAR_WIDTH_KEY = "kstock.settingsSidebarWidth";
const REASONING_MODE_KEY = "kstock.reasoningMode";
const AUTH_BOOT_TIMEOUT_MS = 3_000;

function readReasoningMode(): ReasoningMode {
  const stored = localStorage.getItem(REASONING_MODE_KEY);
  return stored === "off" || stored === "low" || stored === "medium" || stored === "high"
    ? stored
    : "auto";
}

function readSidebarWidth(key: string, fallback: number, min: number, max: number) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
  } catch {
    return fallback;
  }
}

function persistSidebarWidth(key: string, value: number) {
  try {
    localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // 本地存储不可用时保留当前会话内的拖拽结果。
  }
}

/** 提取首条用户消息文本，用于通知正文（无标题时的兜底）。 */
function firstInputText(input: RunInput): string {
  const first = input.messages?.find((m) => m.role === "user");
  if (!first) return "查看任务详情";
  const content = first.content;
  if (typeof content === "string") return content;
  return content?.map((part) => part.text).join(" ") || "查看任务详情";
}

export function Home() {
  const [view, setView] = useState<ViewMode>("landing");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceSidebarWidth, setWorkspaceSidebarWidth] = useState(() =>
    readSidebarWidth(WORKSPACE_SIDEBAR_WIDTH_KEY, 280, 180, 360)
  );
  const [settingsSidebarWidth, setSettingsSidebarWidth] = useState(() =>
    readSidebarWidth(SETTINGS_SIDEBAR_WIDTH_KEY, 228, 190, 360)
  );
  const [generalPreferences, setGeneralPreferences] = useState<GeneralPreferences>(DEFAULT_GENERAL_PREFERENCES);
  const [generalPreferencesLoaded, setGeneralPreferencesLoaded] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [settingsSectionId, setSettingsSectionId] = useState("general");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  // 启动恢复历史任务是异步的。若用户在恢复完成前已经新建/发送会话，
  // 恢复请求返回时不能再用空历史覆盖本地会话，否则会出现“消息发出后消失”。
  const localSessionBeforeHistoryLoadedRef = useRef(false);
  const localSessionBeforeHistoryLoadedIdRef = useRef<string | null>(null);
  // 历史拉取是否真正完成。不能用 sessionsLoaded 判定：!currentUser 分支
  // （auth 解析前的瞬时态）会预置 sessionsLoaded=true，此后 new-task 误以为
  // 历史已加载不设 marker，登录后恢复完成又用空历史覆盖用户刚建的会话
  // （App.spec “桌面系统菜单事件” flaky 根因）。
  const historyFetchDoneRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  // 模型配置（提升到 Home，供 handleSend 构造 RunContext）。
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [activeModel, setActiveModel] = useState<string>("");
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>(readReasoningMode);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([]);
  // 流式 run 状态。
  const [streamingId, setStreamingId] = useState<string | null>(null);
  // 澄清确认弹窗草稿：非 null 时弹窗可见，确认后作为消息发送（不再回填主输入框）。
  const [clarifyDraft, setClarifyDraft] = useState<{ text: string; question?: string } | null>(null);
  // 输入区待发附件（本轮要随消息携带的 UploadedFileRef）。发送成功后清空。
  const [pendingAttachments, setPendingAttachments] = useState<UploadedFileRef[]>([]);
  // 附件上传中状态（控制 chip loading + 选择按钮禁用）。
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  // 研究上下文面板使用的真实线程文件状态。
  const [threadUploads, setThreadUploads] = useState<UploadedFileRef[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [workspaceChanges, setWorkspaceChanges] = useState<WorkspaceChangeFile[]>([]);
  const [workspaceChangesLoading, setWorkspaceChangesLoading] = useState(false);
  const workspaceChangesKeyRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 当前正在执行的 run 标识（threadId + runId），由 streamRun 的 onRunId 回调填入。
  // handleStop 用它显式调 cancel API 即时停止 agent/subagent，而不只靠 abort 断流。
  const activeRunRef = useRef<{ threadId: string; runId: string } | null>(null);
  // 防止重复点击停止（cancelRun 是异步请求，连点会发多次）。
  const stoppingRef = useRef(false);
  // 删除历史任务的二次确认状态（替代 window.confirm，在桌面端 webview 中可靠弹窗）。
  // pendingDeleteSessionId：待删除的 session id；后端失败时填 confirmError 提示二次确认。
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [deleteDeleting, setDeleteDeleting] = useState(false);
  // 历史任务按时间分桶后的折叠状态：DEFAULT_COLLAPSED_BUCKETS 是「3 天以外」初始折叠。
  // 会话内记忆（重启后重置）——符合「启动时默认只展开3天以内」的设计。
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<HistoryBucket>>(
    () => new Set(DEFAULT_COLLAPSED_BUCKETS)
  );
  // 已归档任务：单独拉取（listThreads 默认不返回归档项），只在 sidebar 的
  // 「已归档」桶展开时呈现。归档项不占用主列表。
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  // 归档/取消归档操作防重复点击。
  const [archiveBusySessionIds, setArchiveBusySessionIds] = useState<Set<string>>(new Set());
  // 自动归档扫描节流：同一次会话内只跑一次，避免每次 sessions 变化都重复 PATCH。
  const autoArchiveDoneRef = useRef(false);

  const handleWorkspaceSidebarResize = useCallback((width: number) => {
    setWorkspaceSidebarWidth(width);
    persistSidebarWidth(WORKSPACE_SIDEBAR_WIDTH_KEY, width);
  }, []);

  const handleSettingsSidebarResize = useCallback((width: number) => {
    setSettingsSidebarWidth(width);
    persistSidebarWidth(SETTINGS_SIDEBAR_WIDTH_KEY, width);
  }, []);

  // 任务开始执行时（streamingId 由 null → 非 null）自动展开浮动面板，
  // 让用户立刻看到任务摘要 / Todo / Subagent 等实时进度。任务执行期间
  // 用户手动收起不会被重新撑开（streamingId 一直非 null，不触发跃变）；
  // 任务结束（变回 null）也不自动收起，方便查看结果。下一个任务开始
  // 才会再次自动展开。
  const prevStreamingIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevStreamingIdRef.current === null && streamingId !== null) {
      setRightPanelOpen(true);
    }
    prevStreamingIdRef.current = streamingId;
  }, [streamingId]);

  // 启动时探测 gateway 会话与系统初始化状态。
  // gateway 冷启动需数秒（PyInstaller 引导 + 导入重依赖），探测失败时后台
  // 自动重试（约 30 秒），避免首屏误报「无法连接本地引擎」/ 首启不出现
  // 管理员初始化流程；UI 仍按 AUTH_BOOT_TIMEOUT_MS 尽快展示，不阻塞。
  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let attempts = 0;
    const timeoutId = window.setTimeout(() => {
      if (cancelled || settled) return;
      setAuthReady(true);
    }, AUTH_BOOT_TIMEOUT_MS);
    const probe = () => {
      if (cancelled || settled) return;
      attempts += 1;
      Promise.all([
        tryGetCurrentUser().catch(() => null),
        getSetupStatus().catch(() => null),
      ]).then(([user, setup]) => {
        if (cancelled) return;
        if (user || setup) {
          settled = true;
          window.clearTimeout(timeoutId);
          if (user) setCurrentUser(user);
          if (setup) setSetupStatus(setup);
          setAuthReady(true);
          return;
        }
        // gateway 尚未就绪（冷启动竞态），继续后台探测。
        if (attempts < 20) {
          window.setTimeout(probe, 1_500);
        }
      });
    };
    probe();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  // 会话探测完成后，已登录用户自动从落地页进入工作台。
  useEffect(() => {
    if (authReady && currentUser && view === "landing") {
      setView("workspace");
    }
  }, [authReady, currentUser, view]);

  // 首页与工作台顶部只展示不含密钥的连接状态；切换页面时重新读取，
  // 让用户从设置页保存凭证后返回即可看到最新状态。
  useEffect(() => {
    let cancelled = false;
    void getDataSourceStatus()
      .then((response) => {
        if (!cancelled) setDataSources(response.sources);
      })
      .catch(() => {
        if (!cancelled) setDataSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  // 读取当前用户的桌面偏好。Gateway 不可用时使用默认值，设置页仍可打开。
  useEffect(() => {
    let cancelled = false;
    if (!currentUser) {
      setGeneralPreferences(DEFAULT_GENERAL_PREFERENCES);
      setGeneralPreferencesLoaded(false);
      setSidebarCollapsed(false);
      return;
    }
    setGeneralPreferencesLoaded(false);
    getGeneralPreferences()
      .catch(() => DEFAULT_GENERAL_PREFERENCES)
      .then((preferences) => {
        if (cancelled) return;
        setGeneralPreferences(preferences);
        setSidebarCollapsed(preferences.sidebar_collapsed);
        setGeneralPreferencesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // 模型能力变化后校正推理菜单：避免把 effort 覆盖发送给不支持的模型。
  useEffect(() => {
    const model = models.find((item) => item.name === activeModel);
    if (!model || reasoningMode === "auto" || reasoningMode === "off") return;
    if (!model.supports_thinking || !model.supports_reasoning_effort) {
      setReasoningMode("auto");
      localStorage.setItem(REASONING_MODE_KEY, "auto");
    }
  }, [activeModel, models, reasoningMode]);

  // 登录后从后端拉取历史会话列表（POST /api/threads/search）。
  // 修复「预置假会话重启后重复出现」的 bug：以前用 createSeedSessions() 硬编码
  // 两个假会话作为初始 state，用户删除后重启又会重新生成；现在改为从后端加载
  // 真实 thread，无 thread 时显示空态。
  //
  // 同时执行自动归档：拉回的非归档 thread 中 > 30 天的批量 PATCH 为 archived，
  // 从主列表移除；并拉取所有已归档 thread 填充「已归档」桶。自动归档只在每次
  // 登录后跳一次（autoArchiveDoneRef 节流，避免 sessions 变化时重复跳）。
  useEffect(() => {
    if (!currentUser || !generalPreferencesLoaded) {
      if (!currentUser) {
        setSessions([]);
        setArchivedSessions([]);
        setActiveSessionId("");
        setSessionsLoaded(true);
        autoArchiveDoneRef.current = false;
      }
      return;
    }
    let cancelled = false;
    historyFetchDoneRef.current = false; // 新一轮拉取开始，重新接受 marker 保护
    (async () => {
      const threads = await listThreads(100);
      if (cancelled) return;
      historyFetchDoneRef.current = true;
      let restored = threads.map(threadToSession);
      const lastSessionId = generalPreferences.restore_last_session
        ? localStorage.getItem(`kstock.lastSession.${currentUser.id}`)
        : null;
      const restoredIndex = lastSessionId
        ? threads.findIndex((thread) => thread.thread_id === lastSessionId)
        : -1;
      if (localSessionBeforeHistoryLoadedRef.current) {
        const localSessionId = localSessionBeforeHistoryLoadedIdRef.current;
        setSessions((current) => {
          if (current.length > 0) return current;
          if (restored.length === 0 && generalPreferences.create_session_when_empty) {
            const fresh = createSession("新研究会话");
            localSessionBeforeHistoryLoadedIdRef.current = fresh.id;
            return [fresh];
          }
          return restored;
        });
        setActiveSessionId((current) =>
          current ||
          localSessionId ||
          restored[restoredIndex >= 0 ? restoredIndex : 0]?.id ||
          localSessionBeforeHistoryLoadedIdRef.current ||
          ""
        );
        localSessionBeforeHistoryLoadedRef.current = false;
        setSessionsLoaded(true);
        return;
      }
      // 自动归档：> 30 天且未归档的 thread 批量 PATCH 为 archived。
      // 不做后台定时（避免长驻进程），用户每天首次启动触发一次清理足够。
      if (!autoArchiveDoneRef.current) {
        const stale = selectStaleSessions(restored);
        if (stale.length > 0) {
          // 并发限流 5，避免一次几十个 PATCH 把 gateway 打抱。
          const CONCURRENCY = 5;
          const threadIdToSession = new Map(stale.map((s) => [s.threadId, s]));
          const threadIds = Array.from(threadIdToSession.keys()).filter((id): id is string => Boolean(id));
          for (let i = 0; i < threadIds.length; i += CONCURRENCY) {
            const batch = threadIds.slice(i, i + CONCURRENCY);
            await Promise.all(
              batch.map(async (tid) => {
                try {
                  await archiveThread(tid, true);
                  return tid;
                } catch {
                  // 单个失败不影响其他——该 thread 仍留在主列表。
                  return null;
                }
              })
            ).then((results) => {
              const archivedIds = new Set(
                results.filter((r): r is string => r !== null)
              );
              if (archivedIds.size > 0) {
                // 把成功归档的 session 从 restored 移除，同时加入 archivedSessions。
                const moved: ChatSession[] = [];
                restored = restored.filter((s) => {
                  if (s.threadId && archivedIds.has(s.threadId)) {
                    moved.push({ ...s, metadata: { ...s.metadata, qilin_archived: true } });
                    return false;
                  }
                  return true;
                });
                if (moved.length > 0) {
                  setArchivedSessions((prev) => [...moved, ...prev]);
                }
              }
            });
            if (cancelled) return;
          }
        }
        autoArchiveDoneRef.current = true;
      }
      // 拉取已归档 thread（包含刚刚被自动归档的 + 历史已归档的）。
      // 调大 limit 以涵盖长期累积的归档项。
      if (!cancelled) {
        try {
          const archivedThreads = await listThreads(500, { includeArchived: true });
          if (!cancelled) {
            // 过滤掉已被自动归档流程纳入的 thread，避免重复（双源合并去重）。
            const existingIds = new Set(restored.map((s) => s.threadId));
            const freshArchived = archivedThreads
              .filter((t) => !existingIds.has(t.thread_id))
              .map(threadToSession);
            setArchivedSessions((prev) => {
              const seen = new Set(freshArchived.map((s) => s.threadId));
              const kept = prev.filter((s) => !seen.has(s.threadId));
              return [...freshArchived, ...kept];
            });
          }
        } catch {
          // 归档桶拉取失败不影响主流程，静默忽略。
        }
      }
      if (cancelled) return;
      if (restored.length === 0 && generalPreferences.create_session_when_empty) {
        const fresh = createSession("新研究会话");
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
      } else {
        setSessions(restored);
        setActiveSessionId(restored[restoredIndex >= 0 ? restoredIndex : 0]?.id ?? "");
      }
      setSessionsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, generalPreferencesLoaded]);

  // 定时任务轮询：gateway scheduler 后台执行无推送通道，桌面端每 60s 检查
  // 各任务最近一次 run 的状态；发现新的终态 run 时发系统通知，并把新生成
  // 的任务线程合并进侧栏（fresh_thread_per_run 每次产生新 thread）。
  // 首轮只登记既有 run id 不通知，避免启动时对历史执行补发通知。
  const seenScheduledRunIdsRef = useRef<Set<string>>(new Set());
  const scheduledFirstPollRef = useRef(true);
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    const mergeNewThreads = async () => {
      try {
        const threads = await listThreads(30);
        if (!active) return;
        setSessions((current) => {
          const existingIds = new Set(
            current.map((session) => session.threadId).filter((id): id is string => Boolean(id)),
          );
          const fresh = threads
            .filter((thread) => !existingIds.has(thread.thread_id))
            .map(threadToSession);
          return fresh.length > 0 ? [...fresh, ...current] : current;
        });
      } catch {
        // 侧栏合并失败不影响通知主流程。
      }
    };
    const poll = async () => {
      try {
        const tasks = await listScheduledTasks();
        if (!active || tasks.length === 0) return;
        for (const task of tasks) {
          try {
            const runs = await listScheduledTaskRuns(task.id, 1);
            const latest = runs[0];
            if (!latest) continue;
            if (seenScheduledRunIdsRef.current.has(latest.id)) continue;
            seenScheduledRunIdsRef.current.add(latest.id);
            const terminal =
              latest.status === "success" ||
              latest.status === "failed" ||
              latest.status === "interrupted";
            if (scheduledFirstPollRef.current || !terminal) continue;
            if (generalPreferences.notify_task_done !== false) {
              void showDesktopNotification(
                latest.status === "success" ? "定时任务已完成" : "定时任务执行失败",
                latest.status === "success"
                  ? `${task.title} — 报告已生成，可到报告库查看`
                  : `${task.title} — ${(latest.error ?? "查看任务执行历史").slice(0, 100)}`,
              );
            }
            await mergeNewThreads();
          } catch {
            // 单个任务的状态查询失败不影响其他任务。
          }
        }
        scheduledFirstPollRef.current = false;
      } catch {
        // scheduled-tasks 接口不可用（旧版 gateway 未启用调度器）时静默跳过。
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUser, generalPreferences.notify_task_done]);

  // 切换到历史会话时懒加载消息：session 有 threadId 但 messages 为空时
  // 调 fetchThreadMessages 拉取，转成 ChatMessage[] 写回 session.messages。
  // threadToSession 创建的 session messages 为空，首次点进该会话才加载。
  useEffect(() => {
    if (!activeSessionId) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session || !session.threadId) return;
    // 已有消息或正在加载则跳过
    if (session.messages.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await fetchThreadMessages(session.threadId!);
        if (cancelled) return;
        const msgs = engineMessagesToChatMessages(raw);
        if (cancelled || msgs.length === 0) return;
        setSessions((current) =>
          current.map((s) => (s.id === session.id ? setSessionMessages(s, msgs) : s))
        );
      } catch {
        // 加载失败静默处理（保留空消息，用户可重试切换）。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, sessions]);

  // 加载模型列表，确定初始 activeModel：localStorage > default_model > 首个。
  // 依赖 currentUser：未登录时请求会被 401，登录成功后需要重试拉取。
  // （原实现依赖 []，桌面端首次进入未登录时 listModels 永远拿到 401 且不重试，
  //   导致登录后仍显示「未配置模型」。Web 端因打开时已登录放免。）
  useEffect(() => {
    let cancelled = false;
    if (!currentUser) {
      // 未登录时清空，避免显示他人模型列表。
      setModels([]);
      setModelsLoading(false);
      return;
    }
    setModelsLoading(true);
    (async () => {
      try {
        const stored = localStorage.getItem("kstock.activeModel");
        const data = await listModels();
        if (cancelled) return;
        setModels(data.models);
        const initial =
          stored && data.models.some((m) => m.name === stored)
            ? stored
            : data.default_model && data.models.some((m) => m.name === data.default_model)
              ? data.default_model
              : (data.models[0]?.name ?? "");
        setActiveModel(initial);
      } catch {
        // gateway 未就绪或未登录：保持空，选择器显示「未配置」。
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // 设置页（ModelSettings）增删改后回调：同步本组件的 models state，并校正
  // activeModel —— 若当前选中的模型已被删除，回退到默认模型或列表首个。
  // 否则输入框选择器不刷新（ModelSettings 有自己独立的 models state）。
  const handleModelsChanged = useCallback(
    (next: ModelConfig[], defaultModel: string | null) => {
      setModels(next);
      setActiveModel((prev) => {
        if (prev && next.some((m) => m.name === prev)) return prev;
        // 当前选中被删除：localStorage 记忆 > default_model > 首个
        const stored = localStorage.getItem("kstock.activeModel");
        if (stored && next.some((m) => m.name === stored)) return stored;
        if (defaultModel && next.some((m) => m.name === defaultModel)) return defaultModel;
        return next[0]?.name ?? "";
      });
    },
    []
  );

  const handleGeneralPreferencesSaved = useCallback((next: GeneralPreferences) => {
    setGeneralPreferences(next);
    setSidebarCollapsed(next.sidebar_collapsed);
  }, []);

  const persistGeneralPreferencePatch = useCallback(
    (patch: Partial<GeneralPreferences>) => {
      const next = { ...generalPreferences, ...patch };
      handleGeneralPreferencesSaved(next);
      updateGeneralPreferences(next).catch(() => {
        // 设置页仍可继续使用；下次加载会以服务端值为准。
      });
    },
    [generalPreferences, handleGeneralPreferencesSaved]
  );

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );
  const editableUserMessageIdSet = useMemo(
    () => editableUserMessageIds(activeSession?.messages ?? []),
    [activeSession?.messages]
  );

  // 线程上传目录是后端用户数据空间的事实来源；切换任务时重新读取，避免把
  // 上一个任务的文件误显示到当前面板。
  useEffect(() => {
    const threadId = activeSession?.threadId;
    setThreadUploads([]);
    if (!threadId) {
      setUploadsLoading(false);
      return;
    }
    let cancelled = false;
    setUploadsLoading(true);
    listUploads(threadId)
      .then((files) => {
        if (!cancelled) setThreadUploads(files);
      })
      .catch(() => {
        if (!cancelled) setThreadUploads([]);
      })
      .finally(() => {
        if (!cancelled) setUploadsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSession?.id, activeSession?.threadId]);

  // run 完成后读取 workspace/output 变更。接口没有变更记录时返回 available=false，
  // 这不是错误，面板会继续展示 values.artifacts 中的已交付路径。
  const latestAssistantTurn = useMemo(
    () => [...(activeSession?.messages ?? [])].reverse().find((message) => message.role === "assistant"),
    [activeSession?.messages]
  );
  useEffect(() => {
    const threadId = activeSession?.threadId;
    const runId = latestAssistantTurn?.runId;
    if (!threadId || !runId || latestAssistantTurn?.status !== "done") {
      setWorkspaceChanges([]);
      setWorkspaceChangesLoading(false);
      workspaceChangesKeyRef.current = null;
      return;
    }
    const key = `${threadId}:${runId}`;
    if (workspaceChangesKeyRef.current === key) return;
    workspaceChangesKeyRef.current = key;
    let cancelled = false;
    setWorkspaceChangesLoading(true);
    getWorkspaceChanges(threadId, runId)
      .then((response) => {
        if (!cancelled) setWorkspaceChanges(response.available ? response.files : []);
      })
      .catch(() => {
        if (!cancelled) setWorkspaceChanges([]);
      })
      .finally(() => {
        if (!cancelled) setWorkspaceChangesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSession?.threadId, latestAssistantTurn?.runId, latestAssistantTurn?.status]);

  const activeSetting = SETTING_SECTIONS.find((section) => section.id === settingsSectionId) ?? SETTING_SECTIONS[0];

  // 未登录点「进入工作台」不应直接进：拦截到登录页。
  const enterWorkspace = () => {
    if (!currentUser) {
      setAuthMode("login");
      setView("auth");
      return;
    }
    setView("workspace");
  };
  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setView("auth");
  };

  // 注册 / 登录成功后：记录当前用户并进入工作台。
  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setView("workspace");
  };

  // 登出：清除 gateway 会话后回到落地页。
  const handleLogout = async () => {
    try {
      await gatewayLogout();
    } catch {
      // 即使登出请求失败也回到落地页，避免卡在工作台。
    }
    setCurrentUser(null);
    setView("landing");
    // 登出离开全部任务：清空待发附件，避免再次登录后残留到任务面板。
    setPendingAttachments([]);
  };

  const handleModelChange = (name: string) => {
    setActiveModel(name);
    localStorage.setItem("kstock.activeModel", name);
  };

  const handleReasoningModeChange = (mode: ReasoningMode) => {
    setReasoningMode(mode);
    localStorage.setItem(REASONING_MODE_KEY, mode);
  };

  const handleNewSession = useCallback(() => {
    const nextSession = createSession("新研究会话");
    if (!historyFetchDoneRef.current) {
      localSessionBeforeHistoryLoadedRef.current = true;
      localSessionBeforeHistoryLoadedIdRef.current = nextSession.id;
    }
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionId(nextSession.id);
    setDraft("");
    // 待发附件是会话级状态：新建任务必须清空，避免上一个任务的文件残留
    // 到新任务面板或随下一条消息发送。
    setPendingAttachments([]);
  }, []);

  useEffect(() => {
    // 桌面端系统菜单 / 托盘命令（由 preload 桥推送）。浏览器预览环境无桥时
    // onMenuCommand 返回空 unlisten，不报错。
    const dispose = onMenuCommand((command) => {
      switch (command as DesktopMenuCommand) {
        case "new-task":
          if (currentUser) {
            handleNewSession();
            setView("workspace");
          } else {
            setAuthMode("login");
            setView("auth");
          }
          break;
        case "open-settings":
          setSettingsSectionId("general");
          if (currentUser) {
            setView("settings");
          } else {
            setAuthMode("login");
            setView("auth");
          }
          break;
        case "open-strategies":
          setView("strategies");
          break;
        case "open-reports":
          if (currentUser) {
            setView("reports");
          } else {
            setAuthMode("login");
            setView("auth");
          }
          break;
        case "check-update":
          window.dispatchEvent(new CustomEvent("kstock:check-update"));
          break;
      }
    });

    return () => dispose();
  }, [currentUser, handleNewSession]);

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    // 待发附件是会话级状态：切换任务必须清空（线程已上传文件由上面的
    // useEffect 按 threadId 重新读取，待发附件不跨任务保留）。
    setPendingAttachments([]);
    if (currentUser) {
      const selected = sessions.find((session) => session.id === sessionId);
      if (selected?.threadId) {
        localStorage.setItem(`kstock.lastSession.${currentUser.id}`, selected.threadId);
      }
    }
  };

  // 删除历史任务：点击删除按钮只打开确认对话框，不立即执行。
  // 同步清理后端用户数据空间下整个 thread 目录（workspace/uploads/outputs/
  // 中间文件 + checkpoints + thread_meta）。
  // 同时检索 sessions + archivedSessions，让「已归档」桶里的删除按钮也能用。
  const handleRequestDeleteSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId)
      ?? archivedSessions.find((s) => s.id === sessionId);
    if (!target) return;
    setConfirmError(null);
    setPendingDeleteSessionId(sessionId);
  };

  // 归档一个任务：调后端 PATCH 后从 sessions 移除并加入 archivedSessions 顶部。
  // 本地新建无 threadId 的 session 不支持归档（只能删除）——调用方已保证有 threadId。
  // busy 状态防护避免连点发出多次 PATCH。
  const handleArchiveSession = async (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target || !target.threadId) return;
    if (archiveBusySessionIds.has(sessionId)) return;
    setArchiveBusySessionIds((prev) => new Set(prev).add(sessionId));
    try {
      await archiveThread(target.threadId, true);
      setSessions((current) => current.filter((s) => s.id !== sessionId));
      // 如果归档的是当前 active，切换到首个剩余会话（保持与删除一致的体验）。
      setActiveSessionId((current) => {
        if (current !== sessionId) return current;
        const nextFirst = sessions.find((s) => s.id !== sessionId);
        return nextFirst?.id ?? "";
      });
      setArchivedSessions((prev) => [
        { ...target, metadata: { ...target.metadata, qilin_archived: true } },
        ...prev.filter((s) => s.threadId !== target.threadId),
      ]);
    } catch {
      // 失败静默：不做 toast（避免主侧边栏的轻量交互被提示打断）。后端不可达时
      // 不改变本地状态，避免与后端不一致。
    } finally {
      setArchiveBusySessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  // 取消归档：把任务从 archivedSessions 拉回主列表。重新走后端 PATCH + 本地状态同步。
  const handleUnarchiveSession = async (sessionId: string) => {
    const target = archivedSessions.find((s) => s.id === sessionId);
    if (!target || !target.threadId) return;
    if (archiveBusySessionIds.has(sessionId)) return;
    setArchiveBusySessionIds((prev) => new Set(prev).add(sessionId));
    try {
      await archiveThread(target.threadId, false);
      setArchivedSessions((current) => current.filter((s) => s.id !== sessionId));
      setSessions((prev) => [
        { ...target, metadata: { ...target.metadata, qilin_archived: false } },
        ...prev.filter((s) => s.threadId !== target.threadId),
      ]);
    } catch {
      // 静默失败，保持状态一致。
    } finally {
      setArchiveBusySessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  // 切换某个历史任务桶的折叠状态（会话内记忆，重启重置）。
  const handleToggleBucket = (bucket: HistoryBucket) => {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) {
        next.delete(bucket);
      } else {
        next.add(bucket);
      }
      return next;
    });
  };

  // 用户在确认对话框点「确认」后执行真正删除。
  const handleConfirmDeleteSession = async () => {
    const sessionId = pendingDeleteSessionId;
    if (!sessionId || deleteDeleting) return;
    const target = sessions.find((s) => s.id === sessionId)
      ?? archivedSessions.find((s) => s.id === sessionId);
    if (!target) {
      setPendingDeleteSessionId(null);
      return;
    }
    const isArchivedTarget = !sessions.some((s) => s.id === sessionId);
    setDeleteDeleting(true);
    // 1. 调用后端删除 thread（best-effort，后端不可达也允许前端清理）。
    if (target.threadId) {
      try {
        await deleteThread(target.threadId);
      } catch (err) {
        // 后端删除失败时提示但仍清理前端，避免遗留无法访问的幽灵会话。
        const msg = err instanceof Error ? err.message : String(err);
        setDeleteDeleting(false);
        // 首次失败：在同一个对话框里展示错误，二次确认是否仍移除前端列表。
        setConfirmError(msg);
        return;
      }
    }
    // 2. 前端移除该 session。归档 session 从 archivedSessions 删，否则从 sessions 删。
    // 若删的是当前 active，切换到首个剩余会话。
    if (isArchivedTarget) {
      setArchivedSessions((current) => current.filter((s) => s.id !== sessionId));
    } else {
      setSessions((current) => {
        const next = current.filter((s) => s.id !== sessionId);
        if (sessionId === activeSessionId) {
          setActiveSessionId(next[0]?.id ?? "");
          // 删除的是当前任务：其待发附件一并清空（线程文件已随 thread 目录删除）。
          setPendingAttachments([]);
        }
        return next;
      });
    }
    setDeleteDeleting(false);
    setConfirmError(null);
    setPendingDeleteSessionId(null);
  };

  const handleCancelDeleteSession = () => {
    if (deleteDeleting) return;
    setPendingDeleteSessionId(null);
    setConfirmError(null);
  };

  type StreamIntoSessionOptions = {
    sessionId: string;
    threadId: string;
    model: ModelConfig;
    input: RunInput;
    checkpoint?: RunCheckpoint;
    metadata?: Record<string, unknown>;
  };

  const streamIntoSession = async ({
    sessionId,
    threadId,
    model,
    input,
    checkpoint,
    metadata
  }: StreamIntoSessionOptions) => {
    const turn = createAssistantTurn(model.name);
    const startedAt = Date.now();
    setStreamingId(turn.id);
    setSessions((current) =>
      current.map((session) => (session.id === sessionId ? appendTurnToSession(session, turn) : session))
    );

    const controller = new AbortController();
    abortRef.current = controller;
    let turnState = initialTurn();
    const patchTurn = () =>
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId ? updateMessageInSession(session, turn.id, turnState) : session
        )
      );

    try {
      await streamRun({
        threadId,
        input,
        checkpoint,
        metadata,
        context: runContextFromModel(model, reasoningMode),
        signal: controller.signal,
        handlers: {
          onRunId: (runId) => {
            activeRunRef.current = { threadId, runId };
            turnState = { ...turnState, runId };
            patchTurn();
          },
          onFrame: (frame) => {
            const now = Date.now();
            turnState = reduceFrame(turnState, frame, now);
            turnState.stage = inferStage(turnState.stage, frame);
            patchTurn();
          },
          onError: (error) => {
            turnState = { ...turnState, status: "error", error: error.message };
            patchTurn();
          }
        }
      });
    } finally {
      abortRef.current = null;
      activeRunRef.current = null;
      // 用户主动停止（stoppingRef）不发通知；长任务完成/等待回复（≥15s）、
      // 失败（≥3s，过滤掉连模型都没建立的瞬时配置错误）提醒一次。
      // 主进程在窗口聚焦时自动降级不打扰；浏览器预览无桥静默忽略。
      const wasStopped = stoppingRef.current;
      stoppingRef.current = false;
      const status = turnState.status;
      if (
        !wasStopped &&
        generalPreferences.notify_task_done !== false &&
        (status === "error" || status === "done" || status === "needs_input")
      ) {
        const elapsed = Date.now() - startedAt;
        const threshold = status === "error" ? 3_000 : 15_000;
        if (elapsed >= threshold) {
          const title =
            status === "error" ? "任务执行失败"
            : status === "needs_input" ? "任务等待你的回复"
            : "任务已完成";
          const body =
            status === "error"
              ? (turnState.error ?? "查看任务详情").slice(0, 160)
              : (input.title || firstInputText(input)).slice(0, 60);
          void showDesktopNotification(title, body);
        }
      }
      setStreamingId((id) => (id === turn.id ? null : id));
    }
  };

  // 发送消息：append user → ensureThread → shared stream runner。
  const handleSend = async (modelName: string) => {
    await sendText(draft, modelName);
  };

  // 发送任意文本（主输入框 / 澄清确认对话框共用）：内容来自调用方显式传入。
  const sendText = async (input: string, modelName: string) => {
    const text = input.trim();
    if (!text || !modelName || streamingId) return;
    if (!historyFetchDoneRef.current) {
      localSessionBeforeHistoryLoadedRef.current = true;
      localSessionBeforeHistoryLoadedIdRef.current = activeSession?.id ?? null;
    }
    const filesToSend = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    let session = activeSession;
    if (!session) {
      session = createSession(text.slice(0, 18));
      if (!historyFetchDoneRef.current) localSessionBeforeHistoryLoadedIdRef.current = session.id;
      setSessions((current) => [session!, ...current]);
      setActiveSessionId(session.id);
    }
    const model = models.find((candidate) => candidate.name === modelName);
    if (!model) return;

    if (!generalPreferences.keep_draft_after_send) setDraft("");
    if (!generalPreferences.keep_attachments_after_send) setPendingAttachments([]);

    const humanMessageId = crypto.randomUUID();
    setSessions((current) =>
      current.map((currentSession) =>
        currentSession.id === session!.id
          ? appendMessageToSession(currentSession, "user", text, modelName, humanMessageId)
          : currentSession
      )
    );

    let threadId = session.threadId;
    if (!threadId) {
      try {
        threadId = await ensureThread();
        if (currentUser) localStorage.setItem(`kstock.lastSession.${currentUser.id}`, threadId);
        setSessions((current) =>
          current.map((currentSession) =>
            currentSession.id === session!.id ? bindThreadId(currentSession, threadId!) : currentSession
          )
        );
      } catch (err) {
        const errTurn = createAssistantTurn(modelName);
        errTurn.status = "error";
        errTurn.error = `创建会话失败：${err instanceof Error ? err.message : String(err)}`;
        setSessions((current) =>
          current.map((currentSession) =>
            currentSession.id === session!.id ? appendTurnToSession(currentSession, errTurn) : currentSession
          )
        );
        return;
      }
    }

    await streamIntoSession({
      sessionId: session.id,
      threadId,
      model,
      input: {
        messages: [{
          role: "user",
          id: humanMessageId,
          content: text,
          ...(filesToSend ? { additional_kwargs: { files: filesToSend } } : {})
        }]
      }
    });
  };

  const handleEditResend = async (messageId: string, replacementText: string) => {
    const source = activeSession;
    if (!source?.threadId || streamingId) throw new Error("当前任务暂时无法编辑重发");
    const modelName = selectEditModel(
      source.messages.find((message) => message.id === messageId),
      models.map((model) => model.name),
      activeModel
    );
    const model = models.find((candidate) => candidate.name === modelName);
    if (!model) throw new Error("没有可用模型，无法重新发送");

    const result = await prepareEditedBranch({
      sourceSession: source,
      userMessageId: messageId,
      replacementText,
      api: {
        createBranch: createThreadBranch,
        prepareEdit: prepareEditRegenerate,
        deleteThread
      }
    });
    const branchSession = buildEditedBranchSession(
      source,
      result.target.userIndex,
      result.branch.thread_id,
      result.prepared.replacement_human_message_id,
      replacementText.trim(),
      model.name
    );
    setSessions((current) => [branchSession, ...current]);
    setActiveSessionId(branchSession.id);
    await streamIntoSession({
      sessionId: branchSession.id,
      threadId: result.branch.thread_id,
      model,
      input: result.prepared.input,
      checkpoint: result.prepared.checkpoint,
      metadata: result.prepared.metadata
    });
  };

  // 停止生成：立即响应 UI + 异步 cancel 后端 run + abort SSE 断流兼兜底。
  //
  // 重要：必须先 setStreamingId(null) 让 UI 即时从「生成中」更改为可输入态，
  // 不能等 cancelRun / streamRun 返回——桌面端 webview 中 fetch + ReadableStream
  // 的 abort 有时不能即时释放 SSE 长连接的 reader.read()，导致 streamRun
  // promise 迟迟不 resolve、handleSend 的 finally 不执行、UI 卡在「生成中」。
  // 变更顺序后：UI 立即响应；cancel 后台异步发；abort 兑底断流；streamRun
  // 后续 resolve 时 finally 里的 setStreamingId((id) => id === turn.id ? null : id)
  // 因 streamingId 已被这里置为 null（不等于 turn.id）而不会重复修改。
  //
  // 双保险：cancelRun 直接通知 RunManager 取消（不等断连检测延迟）；abort 确保
  // fetch 连接断开；后端 on_disconnect=cancel 会兼底取消。cancelRun 失败不阻断。
  const handleStop = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    // 1. 立即响应 UI：清 streamingId（stop 按钮变回 send 按钮）。
    const streamingTurnId = streamingId;
    if (streamingTurnId) {
      setStreamingId((id) => (id === streamingTurnId ? null : id));
    }
    // 2. 立即 abort SSE 连接（不等 cancelRun，避免 fetch 网络延迟阻塞断流）。
    abortRef.current?.abort();
    // 3. 后台异步发 cancel（fire-and-forget）：通知后端 RunManager 即时取消 agent + subagent。
    const run = activeRunRef.current;
    if (run) {
      cancelRun(run.threadId, run.runId).catch(() => {
        // cancel 失败不报错：abort 已断流，后端断连检测会兼底 cancel。
      });
    }
  };

  // 选附件：上传到当前会话的 thread（无 threadId 时先创建引擎 thread 并绑定）。
  const handlePickFiles = async (files: File[]) => {
    // 与 handleSend 保持一致：空白工作台也允许先选择附件，自动创建本地任务，
    // 不再因为 activeSession 为空而让附件按钮永久 disabled。
    let session = activeSession;
    if (!session) {
      session = createSession("新研究会话");
      setSessions((current) => [session!, ...current]);
      setActiveSessionId(session.id);
    }

    // 附件上传依赖 thread_id；无 threadId 时先创建引擎 thread 并绑定到 session。
    let threadId = session.threadId;
    if (!threadId) {
      try {
        threadId = await ensureThread();
        setSessions((current) =>
          current.map((s) => (s.id === session.id ? bindThreadId(s, threadId!) : s))
        );
      } catch {
        // 创建 thread 失败：静默返回（不影响其他操作）。
        return;
      }
    }

    setAttachmentsLoading(true);
    try {
      const refs = await uploadFiles(threadId, files);
      if (refs.length > 0) {
        setPendingAttachments((prev) => [...prev, ...refs]);
        setThreadUploads((prev) => {
          const byName = new Map(prev.map((file) => [file.filename, file]));
          refs.forEach((file) => byName.set(file.filename, file));
          return [...byName.values()];
        });
      }
    } catch {
      // 上传失败：静默处理（可后续加 toast）。
    } finally {
      setAttachmentsLoading(false);
    }
  };

  // 移除附件：乐观移除 chip + best-effort 删除引擎文件。
  const handleRemoveAttachment = async (filename: string) => {
    const session = activeSession;
    // 乐观 UI：先移除 chip
    setPendingAttachments((prev) => prev.filter((a) => a.filename !== filename));
    setThreadUploads((prev) => prev.filter((file) => file.filename !== filename));
    if (!session?.threadId) return;
    try {
      await deleteUpload(session.threadId, filename);
    } catch {
      // 删除失败：chip 已移除，引擎文件残留不影响发送。
    }
  };

  if (!authReady) {
    return (
      <main className="app-boot" aria-label="应用启动中">
        <LogoMark compact />
        <p>正在连接本地引擎…</p>
      </main>
    );
  }

  if (view === "landing") {
    return <LandingPage onEnter={enterWorkspace} onAuth={openAuth} dataSources={dataSources} />;
  }

  if (view === "auth") {
    return (
      <AuthPage
        mode={authMode}
        needsSetup={setupStatus?.needs_setup ?? false}
        registrationEnabled={setupStatus?.registration_enabled ?? true}
        onModeChange={setAuthMode}
        onBack={() => setView("landing")}
        onComplete={handleAuthSuccess}
      />
    );
  }

  if (view === "settings") {
    return (
      <SettingsPage
        activeSection={activeSetting}
        activeSectionId={settingsSectionId}
        currentUser={currentUser}
        models={models}
        generalPreferences={generalPreferences}
        sidebarWidth={settingsSidebarWidth}
        onBack={enterWorkspace}
        onLogout={handleLogout}
        onSelectSection={setSettingsSectionId}
        onModelsChanged={handleModelsChanged}
        onGeneralPreferencesChanged={handleGeneralPreferencesSaved}
        onSidebarWidthChange={handleSettingsSidebarResize}
      />
    );
  }

  if (view === "reports") {
    return <ReportLibrary onBack={() => setView("workspace")} />;
  }

  if (view === "strategies") {
    return (
      <StrategiesLibrary
        onBack={() => setView("workspace")}
        onRerun={(prompt) => {
          setDraft(prompt);
          setView("workspace");
        }}
      />
    );
  }

  // 待删除 session 的标题（对话框展示用）。
  const pendingDeleteTitle = pendingDeleteSessionId
    ? (sessions.find((s) => s.id === pendingDeleteSessionId)?.title ?? "该任务")
    : "";

  return (
    <>
      <WorkspaceShell
      activeSession={activeSession}
      currentUser={currentUser}
      draft={draft}
      rightPanelOpen={rightPanelOpen}
      sessions={sessions}
      archivedSessions={archivedSessions}
      sidebarCollapsed={sidebarCollapsed}
      sidebarWidth={workspaceSidebarWidth}
      historyCollapsed={generalPreferences.history_collapsed}
      collapsedBuckets={collapsedBuckets}
      archiveBusySessionIds={archiveBusySessionIds}
      generalPreferences={generalPreferences}
      models={models}
      activeModel={activeModel}
      reasoningMode={reasoningMode}
      modelsLoading={modelsLoading}
      sessionsLoaded={sessionsLoaded}
      streamingId={streamingId}
      editableUserMessageIds={editableUserMessageIdSet}
      onEditResend={handleEditResend}
      onModelChange={handleModelChange}
      onReasoningModeChange={handleReasoningModeChange}
      onDraftChange={setDraft}
      onClarifyPick={(text, question) => setClarifyDraft({ text, question })}
      onLogout={handleLogout}
      onNewSession={handleNewSession}
      onOpenSettings={() => setView("settings")}
      onOpenIntegrations={() => {
        setSettingsSectionId("integrations");
        setView("settings");
      }}
      onOpenReports={() => setView("reports")}
      onOpenStrategies={() => setView("strategies")}
      onSelectSession={handleSelectSession}
      onDeleteSession={handleRequestDeleteSession}
      onArchiveSession={handleArchiveSession}
      onUnarchiveSession={handleUnarchiveSession}
      onToggleBucket={handleToggleBucket}
      onSend={handleSend}
      onStop={handleStop}
      pendingAttachments={pendingAttachments}
      attachmentsLoading={attachmentsLoading}
      onPickFiles={handlePickFiles}
      onRemoveAttachment={handleRemoveAttachment}
      threadUploads={threadUploads}
      uploadsLoading={uploadsLoading}
      workspaceChanges={workspaceChanges}
      workspaceChangesLoading={workspaceChangesLoading}
      onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
      onToggleSidebar={() => persistGeneralPreferencePatch({ sidebar_collapsed: !sidebarCollapsed })}
      onResizeWorkspaceSidebar={handleWorkspaceSidebarResize}
      onToggleHistory={() => persistGeneralPreferencePatch({ history_collapsed: !generalPreferences.history_collapsed })}
      dataSources={dataSources}
    />
      <ConfirmDialog
        open={pendingDeleteSessionId !== null}
        title={confirmError ? "后端删除失败" : `删除「${pendingDeleteTitle}」`}
        description={
          confirmError
            ? `后端数据清理失败：${confirmError}\n\n仍要从前端列表移除该任务吗？（后端残留数据可能需要手动清理）`
            : `将同步删除后端该任务的全部对话数据、上传文件、产出与中间文件，不可恢复。`
        }
        confirmText={confirmError ? "仍从前端移除" : "确认删除"}
        tone="danger"
        onConfirm={handleConfirmDeleteSession}
        onCancel={handleCancelDeleteSession}
      />
      <ClarifyInputDialog
        open={clarifyDraft !== null}
        initialText={clarifyDraft?.text ?? ""}
        question={clarifyDraft?.question}
        onConfirm={(text) => {
          setClarifyDraft(null);
          void sendText(text, activeModel);
        }}
        onCancel={() => setClarifyDraft(null)}
      />
    </>
  );
}
