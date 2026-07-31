import { useMemo, useState, type CSSProperties } from "react";
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

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );

  const reportMarkdown = activeSession?.reportMarkdown ?? buildReportMarkdown(createSession());
  const activeSetting = SETTING_SECTIONS.find((section) => section.id === settingsSectionId) ?? SETTING_SECTIONS[0];

  const enterWorkspace = () => setView("workspace");
  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setView("auth");
  };

  const handleNewSession = () => {
    const nextSession = createSession("新研究会话");
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionId(nextSession.id);
    setDraft("");
  };

  const handleSend = () => {
    const input = draft.trim();
    if (!input || !activeSession) {
      return;
    }

    const assistantReply = synthesizeAssistantReply(input);
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSession.id) {
          return session;
        }
        const nextSession = appendMessageToSession(session, "user", input);
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

  if (view === "landing") {
    return <LandingPage onEnter={enterWorkspace} onAuth={openAuth} />;
  }

  if (view === "auth") {
    return (
      <AuthPage
        mode={authMode}
        onModeChange={setAuthMode}
        onBack={() => setView("landing")}
        onComplete={enterWorkspace}
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
      draft={draft}
      reportMarkdown={reportMarkdown}
      rightPanelOpen={rightPanelOpen}
      sessions={sessions}
      sidebarCollapsed={sidebarCollapsed}
      onDraftChange={setDraft}
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
  onBack,
  onComplete,
  onModeChange
}: {
  mode: AuthMode;
  onBack: () => void;
  onComplete: () => void;
  onModeChange: (mode: AuthMode) => void;
}) {
  const isLogin = mode === "login";
  return (
    <main className="auth-shell">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        <span>返回首页</span>
      </button>
      <section className="auth-panel" aria-label={isLogin ? "登录" : "注册"}>
        <div>
          <p className="eyebrow">KStock Account</p>
          <h1>{isLogin ? "登录工作台" : "创建本地账户"}</h1>
          <p>第一阶段使用本地账户体验，后续会接入 OIDC / SSO 和本机安全密钥存储。</p>
        </div>
        <label>
          <span>邮箱</span>
          <input type="email" placeholder="research@kstock.local" />
        </label>
        <label>
          <span>密码</span>
          <input type="password" placeholder="至少 8 位" />
        </label>
        {!isLogin && (
          <label>
            <span>团队名称</span>
            <input type="text" placeholder="量化研究组" />
          </label>
        )}
        <button className="hero-primary full" type="button" onClick={onComplete}>
          <span>{isLogin ? "登录并进入" : "注册并进入"}</span>
        </button>
        <button
          className="link-button"
          type="button"
          onClick={() => onModeChange(isLogin ? "register" : "login")}
        >
          {isLogin ? "没有账户？注册" : "已有账户？登录"}
        </button>
      </section>
    </main>
  );
}

function WorkspaceShell({
  activeSession,
  draft,
  reportMarkdown,
  rightPanelOpen,
  sessions,
  sidebarCollapsed,
  onDraftChange,
  onNewSession,
  onOpenSettings,
  onSelectSession,
  onSend,
  onToggleRightPanel,
  onToggleSidebar
}: {
  activeSession: ChatSession | undefined;
  draft: string;
  reportMarkdown: string;
  rightPanelOpen: boolean;
  sessions: ChatSession[];
  sidebarCollapsed: boolean;
  onDraftChange: (draft: string) => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
  onSelectSession: (sessionId: string) => void;
  onSend: () => void;
  onToggleRightPanel: () => void;
  onToggleSidebar: () => void;
}) {
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
          <button className="nav-command" type="button">
            <CircleUserRound size={17} />
            {!sidebarCollapsed && <span>本地研究员</span>}
          </button>
          <button className="nav-command" type="button" onClick={onOpenSettings} aria-label="打开设置">
            <Settings size={17} />
            {!sidebarCollapsed && <span>设置</span>}
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
            <button className="send-button" type="button" onClick={onSend} aria-label="发送消息">
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

function ModelSettings() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(MODEL_TEMPLATES[0].id);
  const selectedTemplate = MODEL_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? MODEL_TEMPLATES[0];

  return (
    <div className="model-settings">
      <section className="settings-card model-editor" aria-label="模型配置">
        <div className="setting-row">
          <div>
            <strong>模板</strong>
            <span>选择 QiLin 已适配的模型 provider</span>
          </div>
          <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
            {MODEL_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>
        <label>
          <span>provider</span>
          <input readOnly value={selectedTemplate.provider} />
        </label>
        <label>
          <span>model</span>
          <input value={selectedTemplate.model} readOnly />
        </label>
        <label>
          <span>{selectedTemplate.endpointKey}</span>
          <input value={selectedTemplate.endpoint} readOnly />
        </label>
        <label>
          <span>api_key</span>
          <input value={selectedTemplate.apiKeyEnv} readOnly />
        </label>
        <div className="capability-row">
          <span className={selectedTemplate.thinking ? "on" : ""}>Thinking</span>
          <span className={selectedTemplate.vision ? "on" : ""}>Vision</span>
          <span>{selectedTemplate.family}</span>
        </div>
        <p className="model-note">{selectedTemplate.note}</p>
      </section>

      <section className="template-grid" aria-label="模型模板">
        {MODEL_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className={template.id === selectedTemplate.id ? "active" : ""}
            type="button"
            onClick={() => setSelectedTemplateId(template.id)}
          >
            <strong>{template.name}</strong>
            <span>{template.provider}</span>
            <em>{template.thinking ? "支持思考" : "普通生成"} · {template.vision ? "视觉" : "文本"}</em>
          </button>
        ))}
      </section>
    </div>
  );
}
