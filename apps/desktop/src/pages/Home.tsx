import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Activity,
  ArrowLeft,
  Bell,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Command,
  Cpu,
  Database,
  FileText,
  Folder,
  KeyRound,
  Library,
  Lock,
  LogOut,
  PanelRight,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { normalizeMarkdown } from "../lib/markdown";
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
  buildReportMarkdown,
  createSeedSessions,
  createSession,
  DEFAULT_ACTIVE_SKILLS,
  synthesizeAssistantReply,
  type ChatSession
} from "../lib/sessionStore";

type ViewMode = "landing" | "auth" | "workspace" | "settings";
type AuthMode = "login" | "register";

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
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [settingsSectionId, setSettingsSectionId] = useState("general");
  const [sessions, setSessions] = useState<ChatSession[]>(() => createSeedSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);
  const [draft, setDraft] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);

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

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );

  const reportMarkdown = activeSession?.reportMarkdown ?? buildReportMarkdown(createSession());
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

  const handleNewSession = () => {
    const nextSession = createSession("新研究会话");
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionId(nextSession.id);
    setDraft("");
  };

  const handleSend = (model: string) => {
    const input = draft.trim();
    if (!input || !activeSession || !model) {
      return;
    }

    const assistantReply = synthesizeAssistantReply(input);
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSession.id) {
          return session;
        }
        const nextSession = appendMessageToSession(session, "user", input, model);
        const withAssistant = appendMessageToSession(nextSession, "assistant", assistantReply.message);
        return {
          ...withAssistant,
          reportMarkdown: buildReportMarkdown({
            ...withAssistant,
            activeSkills: assistantReply.activeSkills
          }),
          activeSkills: assistantReply.activeSkills
        };
      })
    );
    setDraft("");
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
        onBack={enterWorkspace}
        onSelectSection={setSettingsSectionId}
      />
    );
  }

  return (
    <WorkspaceShell
      activeSession={activeSession}
      currentUser={currentUser}
      draft={draft}
      reportMarkdown={reportMarkdown}
      rightPanelOpen={rightPanelOpen}
      sessions={sessions}
      sidebarCollapsed={sidebarCollapsed}
      onDraftChange={setDraft}
      onLogout={handleLogout}
      onNewSession={handleNewSession}
      onOpenSettings={() => setView("settings")}
      onSelectSession={setActiveSessionId}
      onSend={handleSend}
      onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
      onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
    />
  );
}

function LandingPage({ onEnter, onAuth }: { onEnter: () => void; onAuth: (mode: AuthMode) => void }) {
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
        <div className="landing-nav-actions">
          <button className="ghost-button" type="button" onClick={() => onAuth("login")}>
            <KeyRound size={16} />
            <span>登录</span>
          </button>
          <button className="solid-button" type="button" onClick={() => onAuth("register")}>
            <UserPlus size={16} />
            <span>注册</span>
          </button>
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
          <p className="eyebrow">KStock Account</p>
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
  onDraftChange,
  onLogout,
  onNewSession,
  onOpenSettings,
  onSelectSession,
  onSend,
  onToggleRightPanel,
  onToggleSidebar
}: {
  activeSession: ChatSession | undefined;
  currentUser: AuthUser | null;
  draft: string;
  reportMarkdown: string;
  rightPanelOpen: boolean;
  sessions: ChatSession[];
  sidebarCollapsed: boolean;
  onDraftChange: (draft: string) => void;
  onLogout: () => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
  onSelectSession: (sessionId: string) => void;
  onSend: (model: string) => void;
  onToggleRightPanel: () => void;
  onToggleSidebar: () => void;
}) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [activeModel, setActiveModel] = useState<string>("");
  const [modelsLoading, setModelsLoading] = useState(true);

  // 启动时加载模型列表，确定初始 activeModel：localStorage > default_model > 首个。
  useEffect(() => {
    let cancelled = false;
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
        // gateway 未就绪：保持空，选择器显示「未配置」。
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleModelChange = (name: string) => {
    setActiveModel(name);
    localStorage.setItem("kstock.activeModel", name);
  };

  const messages = activeSession?.messages ?? [];
  return (
    <div className={`workspace-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="codex-sidebar" aria-label="工作区侧边栏">
        <div className="sidebar-title">
          <button className="icon-ghost" type="button" onClick={onToggleSidebar} aria-label="折叠侧边栏">
            {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
          {!sidebarCollapsed && <LogoMark compact />}
          {!sidebarCollapsed && <strong>KStock</strong>}
          {!sidebarCollapsed && <ChevronDown size={15} />}
        </div>
        <div className="nav-stack">
          <button className="nav-command" type="button" onClick={onNewSession}>
            <Plus size={17} />
            {!sidebarCollapsed && <span>新研究</span>}
          </button>
          <button className="nav-command" type="button">
            <Library size={17} />
            {!sidebarCollapsed && <span>报告库</span>}
          </button>
          <button className="nav-command" type="button">
            <Activity size={17} />
            {!sidebarCollapsed && <span>已安排</span>}
          </button>
          <button className="nav-command" type="button">
            <Sparkles size={17} />
            {!sidebarCollapsed && <span>技能</span>}
          </button>
        </div>
        {!sidebarCollapsed && (
          <>
            <p className="side-section-label">优先级</p>
            <div className="session-strip">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  className={`session-row ${session.id === activeSession?.id ? "active" : ""}`}
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                >
                  <strong>{session.title}</strong>
                  <span><Folder size={12} /> KStock</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="sidebar-footer">
          <button
            className="nav-command"
            type="button"
            title={currentUser?.email ?? "未登录"}
          >
            <CircleUserRound size={17} />
            {!sidebarCollapsed && <span>{currentUser?.email ?? "未登录"}</span>}
          </button>
          <button className="nav-command" type="button" onClick={onOpenSettings} aria-label="打开设置">
            <Settings size={17} />
            {!sidebarCollapsed && <span>设置</span>}
          </button>
          <button className="nav-command" type="button" onClick={onLogout} aria-label="退出登录">
            <LogOut size={17} />
            {!sidebarCollapsed && <span>退出登录</span>}
          </button>
        </div>
      </aside>

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
          <div className="topbar-actions">
            <button className="icon-ghost" type="button" aria-label="搜索">
              <Search size={17} />
            </button>
            <button className="icon-ghost" type="button" aria-label="通知">
              <Bell size={17} />
            </button>
            <button className="icon-ghost" type="button" onClick={onToggleRightPanel} aria-label="显示环境信息">
              <PanelRight size={17} />
            </button>
          </div>
        </header>

        <section className="message-canvas" aria-label="对话工作台">
          <div className="research-status-bar" aria-label="研究状态">
            <span className="status-light" />
            <strong>研究模式</strong>
            <span className="status-separator">/</span>
            <span>等待研究任务</span>
            <em>QiLin 已连接</em>
          </div>
          <div className="chat-column">
            {messages.length === 0 ? (
              <div className="workspace-empty">
                <p className="eyebrow">Research Mode</p>
                <h1>把股票、行业或宏观问题直接交给 KStock。</h1>
                <p>默认使用 QiLin 引擎和精选 KSkills，输出研究路径、来源摘要、图表建议和报告草稿。</p>
                <div className="quick-prompt-grid">
                  {quickPrompts.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => onDraftChange(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={`chat-message ${message.role}`}>
                  <strong>{message.role === "user" ? "你" : "KStock"}</strong>
                  <p>{message.content}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="composer-dock" aria-label="消息输入区">
          <textarea
            aria-label="消息输入"
            value={draft}
            placeholder="要求 KStock 完成一个投研任务，例如：分析贵州茅台最近一季财报，并生成报告。"
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <div className="composer-toolbar">
            <span><FileText size={15} /> 研究模式</span>
            <span><Cpu size={15} /> QiLin 已连接</span>
            {modelsLoading ? (
              <span className="model-picker loading">模型加载中…</span>
            ) : models.length === 0 ? (
              <span className="model-picker empty">未配置模型（请到设置页添加）</span>
            ) : (
              <label className="model-picker">
                <Cpu size={15} />
                <select value={activeModel} onChange={(e) => handleModelChange(e.target.value)}>
                  {models.map((m) => (
                    <option key={m.name} value={m.name}>{m.display_name || m.name}</option>
                  ))}
                </select>
              </label>
            )}
            <button className="send-button" type="button" onClick={() => onSend(activeModel)} disabled={!activeModel} aria-label="发送消息">
              <Send size={18} />
            </button>
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
        <pre>{normalizeMarkdown(reportMarkdown)}</pre>
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
  onBack,
  onSelectSection
}: {
  activeSection: (typeof SETTING_SECTIONS)[number];
  activeSectionId: string;
  onBack: () => void;
  onSelectSection: (id: string) => void;
}) {
  const grouped = SETTING_SECTIONS.reduce<Record<string, typeof SETTING_SECTIONS>>((acc, section) => {
    acc[section.group] = [...(acc[section.group] ?? []), section];
    return acc;
  }, {});
  const ActiveIcon = activeSection.icon;

  return (
    <div className="settings-shell">
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

      <main className="settings-content">
        <div className="settings-title">
          <ActiveIcon size={26} />
          <div>
            <h1>{activeSection.title}</h1>
            <p>{activeSection.summary}</p>
          </div>
        </div>

        {activeSection.id === "models" ? (
          <ModelSettings />
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

/** 模型配置 CRUD 页：列表 + 编辑 + 添加 + 默认模型。 */
function ModelSettings() {
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
    } catch (err) {
      setError(isModelsApiError(err) ? err.message : "加载模型失败");
    } finally {
      setLoading(false);
    }
  }, [selectedName]);

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
          <label><span>name（唯一标识）</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label><span>display_name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label><span>use（provider class）</span><input value={useClass} onChange={(e) => setUseClass(e.target.value)} /></label>
          <label><span>model</span><input value={modelName} onChange={(e) => setModelName(e.target.value)} /></label>
          <label><span>api_base</span><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} /></label>
          <label><span>api_key（明文，存入 secrets.env）</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></label>
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
