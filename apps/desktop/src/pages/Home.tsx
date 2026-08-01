import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Activity,
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock,
  Command,
  Cpu,
  Database,
  FileText,
  Folder,
  Library,
  Lock,
  LogOut,
  PanelRight,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Square,
  Trash2,
  Zap,
} from "lucide-react";
import { Markdown } from "../lib/markdown";
import { fetchLandingNews, type LandingNewsItem } from "../lib/landingNewsClient";
import { MODEL_TEMPLATES, SETTING_SECTIONS } from "../lib/qilinSettings";
import {
  getSetupStatus,
  initializeAdmin as gatewayInitializeAdmin,
  isAuthApiError,
  login as gatewayLogin,
  logout as gatewayLogout,
  register as gatewayRegister,
  tryGetCurrentUser,
  type AuthApiError,
  type AuthUser,
  type SetupStatus
} from "../lib/authClient";
import {
  createModel,
  deleteModel,
  isModelsApiError,
  listModels,
  setDefaultModel,
  updateModel,
  type ModelConfig,
  type ModelWritePayload
} from "../lib/modelsClient";
import {
  appendMessageToSession,
  appendTurnToSession,
  bindThreadId,
  createAssistantTurn,
  createSession,
  DEFAULT_ACTIVE_SKILLS,
  setSessionMessages,
  threadToSession,
  updateMessageInSession,
  type ChatSession
} from "../lib/sessionStore";
import {
  cancelRun,
  deleteThread,
  deleteUpload,
  ensureThread,
  fetchThreadMessages,
  listThreads,
  runContextFromModel,
  streamRun,
  uploadFiles,
  type UploadedFileRef,
} from "../lib/turnsClient";
import { engineMessagesToChatMessages } from "../lib/engineHistory";
import { initialTurn, reduceFrame } from "../lib/turnReducer";
import { inferStage } from "../lib/stageInferrer";
import {
  isGatewayControlApiError,
  restartGateway,
  waitForGateway,
} from "../lib/gatewayControlClient";
import { ChatFeed, type ChatFeedHandle } from "../components/ChatFeed";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DatabaseSettings } from "../components/DatabaseSettings";
import { MemorySettings } from "../components/MemorySettings";
import { SandboxSettings } from "../components/SandboxSettings";
import { RuntimeSettings } from "../components/RuntimeSettings";
import { GuardrailsSettings } from "../components/GuardrailsSettings";
import { SearchSettings } from "../components/SearchSettings";
import { SubagentsSettings } from "../components/SubagentsSettings";
import { AttachmentSettings } from "../components/AttachmentSettings";
import { AccountSettings } from "../components/AccountSettings";
import { ReportSettings } from "../components/ReportSettings";
import { ReportLibrary } from "../components/ReportLibrary";
import { McpExtensionsCard } from "../components/McpExtensionsCard";
import { SkillsExtensionsCard } from "../components/SkillsExtensionsCard";
import { AttachmentPicker, AttachmentChips } from "../components/AttachmentPicker";
import { GeneralSettings } from "../components/GeneralSettings";
import { SidebarResizeHandle } from "../components/SidebarResizeHandle";
import {
  DEFAULT_GENERAL_PREFERENCES,
  getGeneralPreferences,
  updateGeneralPreferences,
  type GeneralPreferences,
} from "../lib/generalSettingsClient";

type ViewMode = "landing" | "auth" | "workspace" | "settings" | "reports";
type AuthMode = "login" | "register";

const WORKSPACE_SIDEBAR_WIDTH_KEY = "kstock.workspaceSidebarWidth";
const SETTINGS_SIDEBAR_WIDTH_KEY = "kstock.settingsSidebarWidth";

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

async function toggleWindowMaximize(event: React.MouseEvent<HTMLElement>) {
  const target = event.target as HTMLElement;
  if (target.closest("button, input, select, textarea, a")) {
    return;
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  } catch {
    // 浏览器预览环境没有 Tauri 原生窗口，忽略即可。
  }
}

async function openExternalUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_external_url", { url });
  } catch {
    // 浏览器预览环境没有 Tauri command，回退到系统新标签页行为。
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const quickPrompts = [
  "分析贵州茅台最新财报并输出研究报告",
  "跟踪半导体行业景气度和估值分位",
  "比较宁德时代和比亚迪的盈利质量",
  "生成本周 A 股宏观与资金面摘要"
];

const researchSourceItems = [
  "财报与公告",
  "行情与估值",
  "行业与宏观"
];

const landingCandles = [
  { left: 2, top: 56, height: 11, delay: -0.2, direction: "up" },
  { left: 6, top: 47, height: 18, delay: -1.1, direction: "down" },
  { left: 10, top: 52, height: 9, delay: -2.4, direction: "up" },
  { left: 14, top: 39, height: 23, delay: -0.8, direction: "up" },
  { left: 18, top: 43, height: 15, delay: -1.8, direction: "down" },
  { left: 22, top: 33, height: 20, delay: -2.7, direction: "up" },
  { left: 26, top: 36, height: 11, delay: -0.5, direction: "up" },
  { left: 30, top: 26, height: 24, delay: -2.1, direction: "down" },
  { left: 34, top: 31, height: 14, delay: -1.4, direction: "up" },
  { left: 38, top: 20, height: 25, delay: -2.9, direction: "up" },
  { left: 42, top: 24, height: 13, delay: -0.9, direction: "down" },
  { left: 46, top: 17, height: 20, delay: -1.7, direction: "up" },
  { left: 50, top: 23, height: 10, delay: -2.5, direction: "down" },
  { left: 54, top: 12, height: 24, delay: -0.7, direction: "up" },
  { left: 58, top: 17, height: 12, delay: -2.2, direction: "up" },
  { left: 62, top: 8, height: 22, delay: -1.3, direction: "down" },
  { left: 66, top: 13, height: 14, delay: -2.8, direction: "up" },
  { left: 70, top: 21, height: 19, delay: -0.4, direction: "down" },
  { left: 74, top: 17, height: 11, delay: -1.9, direction: "up" },
  { left: 78, top: 28, height: 20, delay: -2.6, direction: "down" },
  { left: 82, top: 24, height: 12, delay: -1.0, direction: "up" },
  { left: 86, top: 35, height: 23, delay: -2.0, direction: "down" },
  { left: 90, top: 31, height: 13, delay: -0.6, direction: "up" },
  { left: 94, top: 43, height: 19, delay: -2.3, direction: "down" },
  { left: 98, top: 50, height: 12, delay: -1.5, direction: "up" }
];

export function Home() {
  const [view, setView] = useState<ViewMode>("landing");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceSidebarWidth, setWorkspaceSidebarWidth] = useState(() =>
    readSidebarWidth(WORKSPACE_SIDEBAR_WIDTH_KEY, 242, 180, 360)
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
  const [draft, setDraft] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  // 模型配置（提升到 Home，供 handleSend 构造 RunContext）。
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [activeModel, setActiveModel] = useState<string>("");
  const [modelsLoading, setModelsLoading] = useState(true);
  // 流式 run 状态。
  const [streamingId, setStreamingId] = useState<string | null>(null);
  // 输入区待发附件（本轮要随消息携带的 UploadedFileRef）。发送成功后清空。
  const [pendingAttachments, setPendingAttachments] = useState<UploadedFileRef[]>([]);
  // 附件上传中状态（控制 chip loading + 选择按钮禁用）。
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // 当前正在执行的 run 标识（threadId + runId），由 streamRun 的 onRunId 回调填入。
  // handleStop 用它显式调 cancel API 即时停止 agent/subagent，而不只靠 abort 断流。
  const activeRunRef = useRef<{ threadId: string; runId: string } | null>(null);
  // 防止重复点击停止（cancelRun 是异步请求，连点会发多次）。
  const stoppingRef = useRef(false);
  // 删除历史任务的二次确认状态（替代 window.confirm，在 Tauri webview 中可靠弹窗）。
  // pendingDeleteSessionId：待删除的 session id；后端失败时填 confirmError 提示二次确认。
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [deleteDeleting, setDeleteDeleting] = useState(false);

  const handleWorkspaceSidebarResize = useCallback((width: number) => {
    setWorkspaceSidebarWidth(width);
    persistSidebarWidth(WORKSPACE_SIDEBAR_WIDTH_KEY, width);
  }, []);

  const handleSettingsSidebarResize = useCallback((width: number) => {
    setSettingsSidebarWidth(width);
    persistSidebarWidth(SETTINGS_SIDEBAR_WIDTH_KEY, width);
  }, []);

  // 启动时探测 gateway 会话与系统初始化状态。
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      tryGetCurrentUser().catch(() => null),
      getSetupStatus().catch(() => null),
    ]).then(([user, setup]) => {
      if (cancelled) return;
      if (user) setCurrentUser(user);
      if (setup) setSetupStatus(setup);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 会话探测完成后，已登录用户自动从落地页进入工作台。
  useEffect(() => {
    if (authReady && currentUser && view === "landing") {
      setView("workspace");
    }
  }, [authReady, currentUser, view]);

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

  // 登录后从后端拉取历史会话列表（POST /api/threads/search）。
  // 修复「预置假会话重启后重复出现」的 bug：以前用 createSeedSessions() 硬编码
  // 两个假会话作为初始 state，用户删除后重启又会重新生成；现在改为从后端加载
  // 真实 thread，无 thread 时显示空态。
  useEffect(() => {
    if (!currentUser || !generalPreferencesLoaded) {
      if (!currentUser) {
        setSessions([]);
        setActiveSessionId("");
        setSessionsLoaded(true);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      const threads = await listThreads(100);
      if (cancelled) return;
      const restored = threads.map(threadToSession);
      const lastSessionId = generalPreferences.restore_last_session
        ? localStorage.getItem(`kstock.lastSession.${currentUser.id}`)
        : null;
      const restoredIndex = lastSessionId
        ? threads.findIndex((thread) => thread.thread_id === lastSessionId)
        : -1;
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

  const reportMarkdown = activeSession?.reportMarkdown ?? "";
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
  };

  const handleModelChange = (name: string) => {
    setActiveModel(name);
    localStorage.setItem("kstock.activeModel", name);
  };

  const handleNewSession = () => {
    const nextSession = createSession("新研究会话");
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionId(nextSession.id);
    setDraft("");
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
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
  const handleRequestDeleteSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;
    setConfirmError(null);
    setPendingDeleteSessionId(sessionId);
  };

  // 用户在确认对话框点「确认」后执行真正删除。
  const handleConfirmDeleteSession = async () => {
    const sessionId = pendingDeleteSessionId;
    if (!sessionId || deleteDeleting) return;
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) {
      setPendingDeleteSessionId(null);
      return;
    }
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
    // 2. 前端移除该 session。若删的是当前 active，切换到首个剩余会话。
    setSessions((current) => {
      const next = current.filter((s) => s.id !== sessionId);
      if (sessionId === activeSessionId) {
        setActiveSessionId(next[0]?.id ?? "");
      }
      return next;
    });
    setDeleteDeleting(false);
    setConfirmError(null);
    setPendingDeleteSessionId(null);
  };

  const handleCancelDeleteSession = () => {
    if (deleteDeleting) return;
    setPendingDeleteSessionId(null);
    setConfirmError(null);
  };

  // 发送消息：append user → ensureThread → append streaming turn → streamRun。
  // reducer 状态在闭包外维护（setSessions 异步，不能依赖最新 state 读回 turn）。
  const handleSend = async (modelName: string) => {
    const input = draft.trim();
    if (!input || !modelName || streamingId) {
      return;
    }
    // 捕快照：发送前保存待发附件（随后清空 pendingAttachments）
    const filesToSend = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    // 无 activeSession（首次进入空台）时自动创建一个，再继续发送。
    let session = activeSession;
    if (!session) {
      session = createSession(input.slice(0, 18));
      setSessions((current) => [session!, ...current]);
      setActiveSessionId(session.id);
    }
    const model = models.find((m) => m.name === modelName);
    if (!model) {
      return;
    }

    if (!generalPreferences.keep_draft_after_send) setDraft("");
    if (!generalPreferences.keep_attachments_after_send) setPendingAttachments([]);

    // 1. append user message
    setSessions((current) =>
      current.map((s) => (s.id === session.id ? appendMessageToSession(s, "user", input, modelName) : s))
    );

    // 2. ensure thread（首次发消息时创建引擎 thread 并绑定）
    let threadId = session.threadId;
    if (!threadId) {
      try {
        threadId = await ensureThread();
        if (currentUser) {
          localStorage.setItem(`kstock.lastSession.${currentUser.id}`, threadId);
        }
        setSessions((current) =>
          current.map((s) => (s.id === session.id ? bindThreadId(s, threadId!) : s))
        );
      } catch (err) {
        const errTurn = createAssistantTurn(modelName);
        errTurn.status = "error";
        errTurn.error = `创建会话失败：${err instanceof Error ? err.message : String(err)}`;
        setSessions((current) =>
          current.map((s) => (s.id === session.id ? appendTurnToSession(s, errTurn) : s))
        );
        return;
      }
    }

    // 3. append 空 streaming assistant turn
    const turn = createAssistantTurn(modelName);
    setStreamingId(turn.id);
    setSessions((current) =>
      current.map((s) => (s.id === session.id ? appendTurnToSession(s, turn) : s))
    );

    // 4. streamRun：逐帧 reduceFrame + inferStage 回写 turn
    const controller = new AbortController();
    abortRef.current = controller;
    let turnState = initialTurn();

    const patchTurn = () =>
      setSessions((current) =>
        current.map((s) => (s.id === session.id ? updateMessageInSession(s, turn.id, turnState) : s))
      );

    try {
      await streamRun({
        threadId,
        input: {
          messages: [
            {
              role: "user",
              content: input,
              ...(filesToSend ? { additional_kwargs: { files: filesToSend } } : {})
            }
          ]
        },
        context: runContextFromModel(model),
        signal: controller.signal,
        handlers: {
          onRunId: (runId) => {
            // 捕获 run_id 供 handleStop 显式 cancel；幂等赋值（重连场景安全）。
            activeRunRef.current = { threadId, runId };
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
      stoppingRef.current = false;
      setStreamingId((id) => (id === turn.id ? null : id));
    }
  };

  // 停止生成：立即响应 UI + 异步 cancel 后端 run + abort SSE 断流兼兜底。
  //
  // 重要：必须先 setStreamingId(null) 让 UI 即时从「生成中」更改为可输入态，
  // 不能等 cancelRun / streamRun 返回——Tauri webview 中 fetch + ReadableStream
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
  const handlePickFiles = async (files: FileList) => {
    const session = activeSession;
    if (!session) return;

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
    if (!session?.threadId) return;
    try {
      await deleteUpload(session.threadId, filename);
    } catch {
      // 删除失败：chip 已移除，引擎文件残留不影响发送。
    }
  };

  if (!authReady) {
    return <main className="app-boot" aria-label="应用启动中" />;
  }

  if (view === "landing") {
    return <LandingPage onEnter={enterWorkspace} onAuth={openAuth} />;
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
      reportMarkdown={reportMarkdown}
      rightPanelOpen={rightPanelOpen}
      sessions={sessions}
      sidebarCollapsed={sidebarCollapsed}
      sidebarWidth={workspaceSidebarWidth}
      historyCollapsed={generalPreferences.history_collapsed}
      generalPreferences={generalPreferences}
      models={models}
      activeModel={activeModel}
      modelsLoading={modelsLoading}
      streamingId={streamingId}
      onModelChange={handleModelChange}
      onDraftChange={setDraft}
      onLogout={handleLogout}
      onNewSession={handleNewSession}
      onOpenSettings={() => setView("settings")}
      onOpenIntegrations={() => {
        setSettingsSectionId("integrations");
        setView("settings");
      }}
      onOpenReports={() => setView("reports")}
      onSelectSession={handleSelectSession}
      onDeleteSession={handleRequestDeleteSession}
      onSend={handleSend}
      onStop={handleStop}
      pendingAttachments={pendingAttachments}
      attachmentsLoading={attachmentsLoading}
      onPickFiles={handlePickFiles}
      onRemoveAttachment={handleRemoveAttachment}
      onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
      onToggleSidebar={() => persistGeneralPreferencePatch({ sidebar_collapsed: !sidebarCollapsed })}
      onResizeWorkspaceSidebar={handleWorkspaceSidebarResize}
      onToggleHistory={() => persistGeneralPreferencePatch({ history_collapsed: !generalPreferences.history_collapsed })}
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
    </>
  );
}

function LandingPage({ onEnter, onAuth }: { onEnter: () => void; onAuth: (mode: AuthMode) => void }) {
  const [newsItems, setNewsItems] = useState<LandingNewsItem[]>([]);

  useEffect(() => {
    let active = true;
    const loadNews = async () => {
      try {
        const response = await fetchLandingNews();
        if (!active) return;
        setNewsItems(response.items.slice(0, 10));
      } catch {
        // 落地页新闻是增强信息，接口不可用时保留空态，不阻塞登录入口。
      }
    };
    void loadNews();
    const timer = window.setInterval(() => void loadNews(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const tickerItems = newsItems.length > 1 ? [...newsItems, ...newsItems] : newsItems;

  return (
    <main className="landing-shell">
      <nav
        className="landing-nav"
        aria-label="产品入口"
        data-tauri-drag-region
        onDoubleClick={toggleWindowMaximize}
      >
        <div className="brand-mark">
          <LogoMark />
          <strong>KStock</strong>
        </div>
        <div className="landing-nav-engine" aria-label="QiLin 引擎状态">
          <span className="status-pulse" />
          <span>QiLin 引擎</span>
          <em>已连接</em>
        </div>
      </nav>

      <section className="landing-hero" aria-label="产品介绍">
        <div className="market-scene" aria-hidden="true">
          <div className="kline-field">
            <div className="kline-grid" />
            <div className="kline-stream">
              {landingCandles.map((candle, index) => (
                <span
                  key={`${candle.left}-${index}`}
                  className={`kline-candle ${candle.direction}`}
                  style={
                    {
                      left: `${candle.left}%`,
                      top: `${candle.top}%`,
                      height: `${candle.height}%`,
                      animationDelay: `${candle.delay}s`
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Stock Quant Agent Desktop</p>
          <h1>KStock</h1>
          <p className="hero-subtitle">用对话完成股票研究、分析和报告，把 QiLin 引擎与精选 KSkills 技能封装成跨平台桌面工作台。</p>
          <div className="hero-actions">
            <button className="hero-primary" type="button" onClick={onEnter}>
              <Command size={18} />
              <span>进入工作台</span>
            </button>
            <button className="hero-secondary" type="button" onClick={() => onAuth("login")}>
              <Lock size={18} />
              <span>登录 / 注册</span>
            </button>
          </div>
        </div>
        <div className="engine-brief" aria-label="QiLin 引擎介绍">
          <p>QiLin Engine</p>
          <strong>面向投研报告的本地 Agent 核心</strong>
          <span><b>内置引擎</b>发布包使用 vendor/qilin，不依赖开发机外部仓库。</span>
          <span><b>精选技能</b>加载财报、估值、行业、新闻、公告、宏观等 KSkills 子集。</span>
          <span><b>报告交付</b>生成研究路径、来源摘要、图表建议和 Markdown 草稿。</span>
        </div>
        <section className="landing-news" aria-label="财经新闻">
          <header className="landing-news-header">
            <div>
              <p className="eyebrow">Market News</p>
              <h2>财经快讯</h2>
            </div>
          </header>
          <div className="landing-news-window">
            {tickerItems.length > 0 ? (
              <div className="landing-news-list">
                {tickerItems.map((item, index) => (
                  <a
                    key={`${item.title}-${index}`}
                    className="landing-news-item"
                    href={item.url || undefined}
                    target={item.url ? "_blank" : undefined}
                    rel={item.url ? "noreferrer" : undefined}
                    onClick={(event) => {
                      if (!item.url) return;
                      event.preventDefault();
                      void openExternalUrl(item.url);
                    }}
                    aria-hidden={index >= newsItems.length ? "true" : undefined}
                  >
                    <span className="landing-news-index">{String((index % Math.max(newsItems.length, 10)) + 1).padStart(2, "0")}</span>
                    <span className="landing-news-title">{item.title}</span>
                    <time>{item.published_at || item.source}</time>
                  </a>
                ))}
              </div>
            ) : (
              <p className="landing-news-empty">正在获取最新财经资讯…</p>
            )}
          </div>
        </section>
      </section>

      <section className="landing-band" aria-label="亮点">
        <article>
          <Bot size={20} />
          <h2>QiLin 内置引擎</h2>
          <p>产品发布输入固定到 `vendor/qilin`，不再依赖开发者机器上的外部仓库。</p>
        </article>
        <article>
          <Sparkles size={20} />
          <h2>精选技能体系</h2>
          <p>只加载研究、分析、报告优先的 KSkills 子集，避免把开发类技能混进产品运行时。</p>
        </article>
        <article>
          <FileText size={20} />
          <h2>报告优先流程</h2>
          <p>从问题到数据来源、推理过程、图表和 Markdown 报告，围绕投研交付组织界面。</p>
        </article>
      </section>
    </main>
  );
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? "logo-mark compact" : "logo-mark"}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="56" height="56" rx="14" />
      <path className="logo-stem" d="M21 16h9c2 0 4 2 4 4v24c0 2-2 4-4 4h-9z" />
      <path className="logo-arm" d="M34 31 50 16h9L41 34l18 14H47L34 38z" />
      <path className="logo-line" d="M15 43 28 38l8 4 12-11 9 3" />
    </svg>
  );
}

function AuthPage({
  mode,
  needsSetup,
  registrationEnabled,
  onBack,
  onComplete,
  onModeChange
}: {
  mode: AuthMode;
  /** gateway ``setup-status`` 的 ``needs_setup``：为 true 时注册走 ``/initialize`` 创建管理员。 */
  needsSetup: boolean;
  /** gateway ``setup-status`` 的 ``registration_enabled``：为 false 时禁止普通注册。 */
  registrationEnabled: boolean;
  onBack: () => void;
  onComplete: (user: AuthUser) => void;
  onModeChange: (mode: AuthMode) => void;
}) {
  const isLogin = mode === "login";
  // 首启注册=创建管理员（走 /initialize），否则=普通用户（走 /register）。
  const isAdminBootstrap = !isLogin && needsSetup;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 切换登录/注册模式时清空错误，避免残留提示误导用户。
  useEffect(() => {
    setError(null);
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("请填写邮箱与密码");
      return;
    }
    // 注册时校验两次密码一致（登录无需）。
    if (!isLogin && password !== passwordConfirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isLogin) {
        // 登录响应只含 token 有效期，补一次 /me 拿到账户信息。
        await gatewayLogin(trimmedEmail, password, rememberMe);
        const user = await tryGetCurrentUser();
        if (!user) {
          setError("登录成功但无法读取账户信息，请重试");
          return;
        }
        onComplete(user);
      } else if (isAdminBootstrap) {
        // 首启：创建管理员账户（system_role=admin）。
        const user = await gatewayInitializeAdmin({
          email: trimmedEmail,
          password,
          remember_me: rememberMe,
        });
        onComplete(user);
      } else {
        // 普通注册：system_role=user。
        const user = await gatewayRegister({
          email: trimmedEmail,
          password,
          remember_me: rememberMe,
        });
        onComplete(user);
      }
    } catch (err) {
      setError(
        isAuthApiError(err)
          ? err.message
          : "操作失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 标题 / 副标题 / 提交按钮文案随首启 / 登录 / 普通注册变化。
  const heading = isLogin
    ? "登录工作台"
    : isAdminBootstrap
      ? "初始化管理员账户"
      : "创建本地账户";
  const subtitle = isLogin
    ? "本地账户由内置 QiLin gateway 管理会话，后续会接入 OIDC / SSO 与本机安全密钥存储。"
    : isAdminBootstrap
      ? "首次启动需要创建一个管理员账户以完成系统初始化，该账户将拥有 system_role=admin。"
      : "注册将创建一个普通用户账户（system_role=user），管理员需在首启时初始化。";
  const submitLabel = submitting
    ? "处理中…"
    : isLogin
      ? "登录并进入"
      : isAdminBootstrap
        ? "初始化并进入"
        : "注册并进入";

  return (
    <main className="auth-shell">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        <span>返回首页</span>
      </button>
      <section className="auth-panel" aria-label={isLogin ? "登录" : "注册"}>
        <div>
          <div className="auth-brand" aria-label="KStock 账户">
            <LogoMark compact />
            <span>KStock</span>
          </div>
          <h1>{heading}</h1>
          <p>{subtitle}</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>邮箱</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="research@kstock.dev"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="至少 8 位"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {!isLogin && (
            <label>
              <span>确认密码</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="再次输入密码"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </label>
          )}
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>记住我（保持 7 天登录态）</span>
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="hero-primary full"
            type="submit"
            disabled={submitting}
          >
            <span>{submitLabel}</span>
          </button>
        </form>
        {/* 首启只能初始化管理员，不提供切换到普通登录的入口；登录模式不显示切换。 */}
        {!isAdminBootstrap && (
          <button
            className="link-button"
            type="button"
            onClick={() => onModeChange(isLogin ? "register" : "login")}
          >
            {isLogin
              ? (registrationEnabled ? "没有账户？注册" : "仅管理员可登录")
              : "已有账户？登录"}
          </button>
        )}
      </section>
    </main>
  );
}

function WorkspaceShell({
  activeSession,
  currentUser,
  draft,
  reportMarkdown,
  rightPanelOpen,
  sessions,
  sidebarCollapsed,
  sidebarWidth,
  historyCollapsed,
  generalPreferences,
  models,
  activeModel,
  modelsLoading,
  streamingId,
  onModelChange,
  onDraftChange,
  onLogout,
  onNewSession,
  onOpenIntegrations,
  onOpenReports,
  onOpenSettings,
  onSelectSession,
  onDeleteSession,
  onSend,
  onStop,
  pendingAttachments,
  attachmentsLoading,
  onPickFiles,
  onRemoveAttachment,
  onToggleRightPanel,
  onToggleSidebar,
  onResizeWorkspaceSidebar,
  onToggleHistory
}: {
  activeSession: ChatSession | undefined;
  currentUser: AuthUser | null;
  draft: string;
  reportMarkdown: string;
  rightPanelOpen: boolean;
  sessions: ChatSession[];
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  historyCollapsed: boolean;
  generalPreferences: GeneralPreferences;
  models: ModelConfig[];
  activeModel: string;
  modelsLoading: boolean;
  streamingId: string | null;
  onModelChange: (name: string) => void;
  onDraftChange: (draft: string) => void;
  onLogout: () => void;
  onNewSession: () => void;
  onOpenIntegrations: () => void;
  onOpenReports: () => void;
  onOpenSettings: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onSend: (model: string) => void;
  onStop: () => void;
  pendingAttachments: UploadedFileRef[];
  attachmentsLoading: boolean;
  onPickFiles: (files: FileList) => void;
  onRemoveAttachment: (filename: string) => void;
  onToggleRightPanel: () => void;
  onToggleSidebar: () => void;
  onResizeWorkspaceSidebar: (width: number) => void;
  onToggleHistory: () => void;
}) {
  const messages = activeSession?.messages ?? [];
  const latestUsage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.usage);
  const taskTokens = latestUsage?.usage?.total_tokens ?? 0;
  // ChatFeed 命令式 ref + 贴底状态：驱动「回到底部」浮动按钮。
  const feedRef = useRef<ChatFeedHandle>(null);
  const [feedAtBottom, setFeedAtBottom] = useState(true);
  const scrollToBottom = () => feedRef.current?.scrollToBottom("smooth");
  // 账户操作默认收起，避免长期占用侧栏底部空间。
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  return (
    <div
      className={`workspace-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${rightPanelOpen ? "context-open" : ""} density-${generalPreferences.density} ${generalPreferences.reduce_motion ? "reduce-motion" : ""}`}
      style={{ "--workspace-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <aside className="codex-sidebar" aria-label="工作区侧边栏">
        <div className="sidebar-title">
          <button className="icon-ghost" type="button" onClick={onToggleSidebar} aria-label="折叠侧边栏">
            {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
          {!sidebarCollapsed && (
            <div className="sidebar-brand" aria-label="KStock 工作区">
              <LogoMark compact />
              <strong>KStock</strong>
              <ChevronDown size={15} />
            </div>
          )}
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
              <span className="side-section-label">历史任务</span>
              <span className="side-section-count">{sessions.length}</span>
              <ChevronRight
                size={13}
                className={!historyCollapsed ? "chevron-expanded" : ""}
                aria-hidden="true"
              />
            </button>
            {!historyCollapsed && (
              <div className="session-strip">
                {sessions.length === 0 ? (
                  <p className="session-empty">暂无历史任务</p>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`session-row ${session.id === activeSession?.id ? "active" : ""}`}
                    >
                      <button
                        className="session-row-main"
                        type="button"
                        onClick={() => onSelectSession(session.id)}
                      >
                        <strong>{session.title}</strong>
                        <span className="session-meta">
                          <Clock size={11} />
                          {session.updatedAt}
                        </span>
                      </button>
                      <button
                        className="session-row-delete"
                        type="button"
                        aria-label={`删除任务 ${session.title}`}
                        title="删除任务"
                        onClick={() => onDeleteSession(session.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
        <div className="sidebar-footer">
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
          data-tauri-drag-region
          onDoubleClick={toggleWindowMaximize}
        >
          <div>
            <Folder size={17} />
            <strong>{activeSession?.title ?? "新研究会话"}</strong>
          </div>
          <div className="research-status-bar" aria-label="研究状态">
            <span className={`status-light ${streamingId ? "active" : ""}`} />
            <strong>研究模式</strong>
            <span className="status-separator">/</span>
            <span>{streamingId ? "生成中…" : "等待研究任务"}</span>
            <em><span className="status-pulse" />QiLin 已连接</em>
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
            onAtBottomChange={setFeedAtBottom}
            onClarifyPick={(text) =>
              onDraftChange(draft.trim() ? `${draft.trimEnd()}
${text}` : text)
            }
            emptySlot={
              <div className="workspace-empty">
                <div className="welcome-heading">
                  <p className="eyebrow">Research Desk <span>01</span></p>
                  <h1>把一个问题，变成一份<br /><em>可验证的研究结论。</em></h1>
                  <p>从行情、财报到行业脉络，KStock 会整理证据、过程与风险，最后交付清晰的研究看板。</p>
                </div>
                <div className="quick-prompt-grid">
                  {quickPrompts.map((prompt, index) => (
                    <button key={prompt} type="button" onClick={() => onDraftChange(prompt)}>
                      <span className="prompt-index">0{index + 1}</span>
                      {prompt}
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            }
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
              if (event.nativeEvent.isComposing || !draft.trim()) return;
              const modifier = event.metaKey || event.ctrlKey;
              const shouldSend = generalPreferences.send_shortcut === "enter"
                ? event.key === "Enter" && !event.shiftKey
                : event.key === "Enter" && modifier && !event.shiftKey;
              if (!shouldSend || streamingId || !activeModel) return;
              event.preventDefault();
              onSend(activeModel);
            }}
          />
          <div className="composer-toolbar">
            <AttachmentPicker
              loading={attachmentsLoading}
              disabled={!activeSession || !!streamingId}
              disabledReason={!activeSession ? "先开始一个会话" : undefined}
              onPickFiles={onPickFiles}
            />
            {modelsLoading ? (
              <span className="model-picker loading">模型加载中…</span>
            ) : models.length === 0 ? (
              <span className="model-picker empty">未配置模型（请到设置页添加）</span>
            ) : (
              <label className="model-picker">
                <Cpu size={15} />
                <select value={activeModel} onChange={(e) => onModelChange(e.target.value)}>
                  {models.map((m) => (
                    <option key={m.name} value={m.name}>{m.display_name || m.name}</option>
                  ))}
                </select>
              </label>
            )}
            {streamingId ? (
              <button className="send-button stop" type="button" onClick={onStop} aria-label="停止生成">
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button className="send-button" type="button" onClick={() => onSend(activeModel)} disabled={!activeModel} aria-label="发送消息">
                <Send size={18} />
              </button>
            )}
          </div>
        </section>
      </main>

      <aside className={`floating-context-panel ${rightPanelOpen ? "open" : ""}`} aria-label="研究上下文">
        <div className="floating-header">
          <strong>研究上下文</strong>
          <button className="icon-ghost" type="button" onClick={onToggleRightPanel} aria-label="隐藏研究上下文">
            <PanelRight size={17} />
          </button>
        </div>
        <ContextLine icon={Activity} label="任务状态" value="等待输入" />
        <ContextLine icon={Cpu} label="QiLin 引擎" value="已连接" />
        <ContextLine icon={Sparkles} label="技能" value={`${DEFAULT_ACTIVE_SKILLS.length} 个`} />
        <ContextLine icon={FileText} label="输出格式" value="研究报告" />
        <div className="context-divider" />
        <strong className="mini-heading">数据范围</strong>
        {researchSourceItems.map((item) => (
          <ContextLine key={item} icon={Database} label={item} value="待调用" />
        ))}
        <div className="context-divider" />
        <strong className="mini-heading">报告预览</strong>
        <div className="context-report-preview">
          {reportMarkdown ? <Markdown>{reportMarkdown}</Markdown> : <em>暂无报告</em>}
        </div>
      </aside>
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

function SettingsPage({
  activeSection,
  activeSectionId,
  currentUser,
  models,
  generalPreferences,
  sidebarWidth,
  onBack,
  onLogout,
  onSelectSection,
  onModelsChanged,
  onGeneralPreferencesChanged,
  onSidebarWidthChange,
}: {
  activeSection: (typeof SETTING_SECTIONS)[number];
  activeSectionId: string;
  currentUser: AuthUser | null;
  models: ModelConfig[];
  generalPreferences: GeneralPreferences;
  sidebarWidth: number;
  onBack: () => void;
  onLogout: () => void;
  onSelectSection: (id: string) => void;
  onModelsChanged?: (models: ModelConfig[], defaultModel: string | null) => void;
  onGeneralPreferencesChanged: (preferences: GeneralPreferences) => void;
  onSidebarWidthChange: (width: number) => void;
}) {
  const grouped = SETTING_SECTIONS.reduce<Record<string, typeof SETTING_SECTIONS>>((acc, section) => {
    acc[section.group] = [...(acc[section.group] ?? []), section];
    return acc;
  }, {});
  const ActiveIcon = activeSection.icon;

  return (
    <div
      className={`settings-shell density-${generalPreferences.density} ${generalPreferences.reduce_motion ? "reduce-motion" : ""}`}
      style={{ "--settings-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <aside className="settings-sidebar" aria-label="设置菜单">
        <button className="settings-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          <span>返回应用</span>
        </button>
        <label className="settings-search">
          <Search size={15} />
          <input placeholder="搜索设置..." />
        </label>
        {Object.entries(grouped).map(([group, sections]) => (
          <div key={group} className="settings-group">
            <p>{group}</p>
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  className={section.id === activeSectionId ? "active" : ""}
                  type="button"
                  onClick={() => onSelectSection(section.id)}
                >
                  <Icon size={17} />
                  <span>{section.title}</span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>
      <SidebarResizeHandle
        width={sidebarWidth}
        minWidth={190}
        maxWidth={360}
        label="调整设置侧栏宽度"
        onResize={onSidebarWidthChange}
      />

      <main className="settings-content">
        <div className="settings-title">
          <ActiveIcon size={26} />
          <div>
            <h1>{activeSection.title}</h1>
            <p>{activeSection.summary}</p>
          </div>
        </div>

        {/* 后端维护操作条：跨设置 section 的全局按钮 */}
        <BackendControlBar />

        {activeSection.id === "general" ? (
          <GeneralSettings initialValue={generalPreferences} onSaved={onGeneralPreferencesChanged} />
        ) : activeSection.id === "models" ? (
          <ModelSettings onModelsChanged={onModelsChanged} />
        ) : activeSection.id === "memory" ? (
          <MemorySettings />
        ) : activeSection.id === "database" ? (
          <DatabaseSettings />
        ) : activeSection.id === "tools" ? (
          <SandboxSettings />
        ) : activeSection.id === "runtime" ? (
          <RuntimeSettings />
        ) : activeSection.id === "guardrails" ? (
          <GuardrailsSettings />
        ) : activeSection.id === "search" ? (
          <SearchSettings />
        ) : activeSection.id === "subagents" ? (
          <SubagentsSettings />
        ) : activeSection.id === "attachments" ? (
          <AttachmentSettings />
        ) : activeSection.id === "auth" ? (
          currentUser ? (
            <AccountSettings currentUser={currentUser} models={models} onLogout={onLogout} />
          ) : (
            <section className="settings-card">
              <p className="auth-error" role="alert">请先登录后查看账户信息。</p>
            </section>
          )
        ) : activeSection.id === "reports" ? (
          <ReportSettings onNavigateToExtensions={() => onSelectSection("integrations")} />
        ) : activeSection.id === "integrations" ? (
          <div className="subagents-settings">
            <McpExtensionsCard />
            <SkillsExtensionsCard />
          </div>
        ) : (
          <section className="settings-card" aria-label={`${activeSection.title}配置`}>
            {activeSection.fields.map((field) => (
              <div key={field.name} className="setting-row">
                <div>
                  <strong>{field.name}</strong>
                  <span>{field.hint}</span>
                </div>
                <button className="pill-control" type="button">{field.value}</button>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

/** 后端维护操作条：跨设置 section 的全局按钮，重启 gateway 无需重启整个桌面端。 */
function BackendControlBar() {
  const [state, setState] = useState<"idle" | "restarting" | "success" | "error">("idle");
  const [statusText, setStatusText] = useState("");
  // 二次确认用受控 ConfirmDialog（window.confirm 在 Tauri webview 中不弹窗）。
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRestart = async () => {
    // 点「确认重启」后才走这里；先关对话框，再发起重启。
    setConfirmOpen(false);
    setState("restarting");
    setStatusText("正在发送重启请求…");
    try {
      await restartGateway();
      setStatusText("后端重启中，等待恢复…");
      const ok = await waitForGateway(20000, (n) =>
        setStatusText(`等待后端恢复…（第 ${n} 次）`)
      );
      if (ok) {
        setState("success");
        setStatusText("后端已恢复。");
      } else {
        setState("error");
        setStatusText("后端恢复超时，请检查 gateway 是否正常运行。");
      }
    } catch (err) {
      setState("error");
      setStatusText(isGatewayControlApiError(err) ? err.message : "重启失败");
    }
  };

  return (
    <>
      <section className="settings-card backend-bar" aria-label="后端维护">
        <div className="backend-bar-info">
          <strong>后端引擎（gateway）</strong>
          <span>修改配置后重启 gateway 使变更完全生效（如数据库后端切换），无需重启整个桌面端。</span>
        </div>
        <div className="backend-bar-action">
          {statusText && (
            <span className={`backend-status backend-status--${state}`} role="status">
              {statusText}
            </span>
          )}
          <button
            className="pill-control backend-restart-btn"
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={state === "restarting"}
          >
            {state === "restarting" ? "重启中…" : "重启后端"}
          </button>
        </div>
      </section>
      <ConfirmDialog
        open={confirmOpen}
        title="重启后端"
        description="重启期间对话将短暂不可用，约 2-3 秒恢复。配置文件（模型 / 记忆等）不会丢失。"
        confirmText="确认重启"
        tone="primary"
        onConfirm={handleRestart}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/** 模型配置 CRUD 页：列表 + 编辑 + 添加 + 默认模型。 */
function ModelSettings({ onModelsChanged }: { onModelsChanged?: (models: ModelConfig[], defaultModel: string | null) => void }) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [defaultModel, setDefaultModelState] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addTemplate, setAddTemplate] = useState<typeof MODEL_TEMPLATES[number] | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listModels();
      setModels(data.models);
      setDefaultModelState(data.default_model);
      if (data.models.length > 0 && !selectedName) {
        setSelectedName(data.models[0].name);
      }
      // 同步外部（Home 的输入框选择器）：设置页增删改后，输入框选择器需要
      // 反映最新列表，且当前选中的模型被删除时要回退到默认/首个。
      onModelsChanged?.(data.models, data.default_model);
    } catch (err) {
      setError(isModelsApiError(err) ? err.message : "加载模型失败");
    } finally {
      setLoading(false);
    }
  }, [selectedName, onModelsChanged]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selected = models.find((m) => m.name === selectedName) ?? null;

  const handleDelete = async (name: string) => {
    if (!window.confirm(`确认删除模型「${name}」？相关 API key 也会从 secrets.env 移除。`)) return;
    try {
      await deleteModel(name);
      if (selectedName === name) setSelectedName(null);
      await reload();
    } catch (err) {
      setError(isModelsApiError(err) ? err.message : "删除失败");
    }
  };

  const handleSetDefault = async (name: string | null) => {
    try {
      await setDefaultModel(name);
      setDefaultModelState(name);
    } catch (err) {
      setError(isModelsApiError(err) ? err.message : "设置默认模型失败");
    }
  };

  if (loading) {
    return <div className="model-settings"><p className="model-loading">加载模型配置…</p></div>;
  }

  return (
    <div className="model-settings">
      {error && <p className="auth-error" role="alert">{error}</p>}

      <section className="settings-card model-list-card" aria-label="模型列表">
        <div className="model-list-header">
          <strong>已配置模型</strong>
          <button className="pill-control" type="button" onClick={() => { setAddTemplate(null); setAdding(true); }}>+ 添加模型</button>
        </div>
        {models.length === 0 ? (
          <p className="model-empty">尚未配置任何模型。点击「添加模型」，从模板创建或自定义一个。</p>
        ) : (
          <ul className="model-list">
            {models.map((m) => (
              <li
                key={m.name}
                className={m.name === selectedName ? "active" : ""}
                onClick={() => setSelectedName(m.name)}
              >
                <div>
                  <strong>{m.display_name || m.name}</strong>
                  <span>{m.use}</span>
                </div>
                <div className="model-badges">
                  {m.supports_thinking && <em>思考</em>}
                  {m.supports_vision && <em>视觉</em>}
                  {defaultModel === m.name && <em className="default">默认</em>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleSetDefault(m.name); }} aria-label="设为默认">设默认</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <ModelEditor
          key={selected.name}
          model={selected}
          onSave={async (payload) => {
            try {
              await updateModel(selected.name, payload);
              await reload();
            } catch (err) {
              setError(isModelsApiError(err) ? err.message : "保存失败");
            }
          }}
          onDelete={() => handleDelete(selected.name)}
        />
      )}

      {adding && (
        <ModelAddDialog
          initialTemplate={addTemplate}
          onPickTemplate={(t) => setAddTemplate(t)}
          onCancel={() => setAdding(false)}
          onSubmit={async (payload) => {
            try {
              await createModel(payload);
              setAdding(false);
              await reload();
            } catch (err) {
              setError(isModelsApiError(err) ? err.message : "添加失败");
            }
          }}
        />
      )}
    </div>
  );
}

/** 单个模型编辑面板。api_key 留空表示不修改现有 key。 */
function ModelEditor({ model, onSave, onDelete }: {
  model: ModelConfig;
  onSave: (payload: ModelWritePayload) => Promise<void>;
  onDelete: () => void;
}) {
  const [displayName, setDisplayName] = useState(model.display_name ?? "");
  const [useClass, setUseClass] = useState(model.use);
  const [modelName, setModelName] = useState(model.model);
  const [apiBase, setApiBase] = useState(model.api_base ?? "");
  const [apiKey, setApiKey] = useState("");
  const [thinking, setThinking] = useState(model.supports_thinking);
  const [vision, setVision] = useState(model.supports_vision);
  const [reasoningEffort, setReasoningEffort] = useState(model.supports_reasoning_effort);
  const [saving, setSaving] = useState(false);

  return (
    <section className="settings-card model-editor" aria-label="编辑模型">
      <h3>{model.name}</h3>
      <label><span>display_name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
      <label><span>use（provider class）</span><input value={useClass} onChange={(e) => setUseClass(e.target.value)} /></label>
      <label><span>model</span><input value={modelName} onChange={(e) => setModelName(e.target.value)} /></label>
      <label><span>api_base</span><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} /></label>
      <label><span>api_key{model.api_key_env ? `（已配置 ${model.api_key_env}）` : ""}</span>
        <input type="password" placeholder="留空不修改" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      </label>
      <div className="capability-row">
        <label className="auth-remember"><input type="checkbox" checked={thinking} onChange={(e) => setThinking(e.target.checked)} /><span>Thinking</span></label>
        <label className="auth-remember"><input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} /><span>Vision</span></label>
        <label className="auth-remember"><input type="checkbox" checked={reasoningEffort} onChange={(e) => setReasoningEffort(e.target.checked)} /><span>Reasoning Effort</span></label>
      </div>
      <div className="model-editor-actions">
        <button className="hero-primary" type="button" disabled={saving} onClick={async () => {
          setSaving(true);
          try {
            await onSave({
              name: model.name,
              display_name: displayName || null,
              use: useClass,
              model: modelName,
              api_base: apiBase || null,
              api_key: apiKey || null,
              supports_thinking: thinking,
              supports_vision: vision,
              supports_reasoning_effort: reasoningEffort,
            });
          } finally { setSaving(false); }
        }}>{saving ? "保存中…" : "保存"}</button>
        <button className="link-button" type="button" onClick={onDelete}>删除模型</button>
      </div>
    </section>
  );
}

/** 添加模型弹层：先选模板或空白自定义，再填表单提交。 */
function ModelAddDialog({ initialTemplate, onPickTemplate, onCancel, onSubmit }: {
  initialTemplate: typeof MODEL_TEMPLATES[number] | null;
  onPickTemplate: (t: typeof MODEL_TEMPLATES[number] | null) => void;
  onCancel: () => void;
  onSubmit: (payload: ModelWritePayload) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [useClass, setUseClass] = useState("");
  const [modelName, setModelName] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [thinking, setThinking] = useState(false);
  const [vision, setVision] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialTemplate) {
      setName(initialTemplate.id);
      setDisplayName(initialTemplate.name);
      setUseClass(initialTemplate.provider);
      setModelName(initialTemplate.model);
      setApiBase(initialTemplate.endpointKey === "native" ? "" : initialTemplate.endpoint);
      setThinking(initialTemplate.thinking);
      setVision(initialTemplate.vision);
    }
  }, [initialTemplate]);

  return (
    <section className="settings-card model-add-dialog" aria-label="添加模型">
      <div className="model-list-header">
        <strong>添加模型</strong>
        <button className="link-button" type="button" onClick={onCancel}>取消</button>
      </div>
      {!initialTemplate && (
        <div className="template-picker">
          <p className="model-empty">从模板快速创建，或直接空白自定义：</p>
          <div className="template-grid">
            {MODEL_TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => onPickTemplate(t)}>
                <strong>{t.name}</strong><span>{t.provider}</span>
              </button>
            ))}
            <button type="button" onClick={() => onPickTemplate(MODEL_TEMPLATES[0])}>
              <strong>空白自定义</strong><span>手动填写全部字段</span>
            </button>
          </div>
        </div>
      )}
      {initialTemplate && (
        <>
          <div className="model-add-fields">
            <label><span>name（唯一标识）</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label><span>display_name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
            <label><span>use（provider class）</span><input value={useClass} onChange={(e) => setUseClass(e.target.value)} /></label>
            <label><span>model</span><input value={modelName} onChange={(e) => setModelName(e.target.value)} /></label>
            <label><span>api_base</span><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} /></label>
            <label><span>api_key（明文，存入 secrets.env）</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></label>
          </div>
          <div className="capability-row">
            <label className="auth-remember"><input type="checkbox" checked={thinking} onChange={(e) => setThinking(e.target.checked)} /><span>Thinking</span></label>
            <label className="auth-remember"><input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} /><span>Vision</span></label>
          </div>
          <button className="hero-primary" type="button" disabled={submitting} onClick={async () => {
            if (!name || !useClass || !modelName) return;
            setSubmitting(true);
            try {
              await onSubmit({
                name, display_name: displayName || null,
                use: useClass, model: modelName,
                api_base: apiBase || null, api_key: apiKey || null,
                supports_thinking: thinking, supports_vision: vision,
              });
            } finally { setSubmitting(false); }
          }}>{submitting ? "提交中…" : "创建"}</button>
        </>
      )}
    </section>
  );
}
