import {
  Brain,
  Database,
  FileSearch,
  Gauge,
  GitBranch,
  KeyRound,
  MemoryStick,
  Paperclip,
  Plug,
  Search,
  Shield,
  SlidersHorizontal,
  TerminalSquare
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ModelTemplate {
  id: string;
  name: string;
  family: string;
  provider: string;
  model: string;
  endpointKey: "api_base" | "base_url" | "native";
  endpoint: string;
  apiKeyEnv: string;
  thinking: boolean;
  vision: boolean;
  note: string;
}

export interface SettingSection {
  id: string;
  title: string;
  group: string;
  icon: LucideIcon;
  summary: string;
  fields: Array<{
    name: string;
    value: string;
    hint: string;
  }>;
}

export const MODEL_TEMPLATES: ModelTemplate[] = [
  {
    id: "deepseek",
    name: "DeepSeek / 火山 / Kimi 兼容",
    family: "DeepSeek reasoning",
    provider: "qilin.models.patched_deepseek:PatchedChatDeepSeek",
    model: "deepseek-v4-pro",
    endpointKey: "api_base",
    endpoint: "https://api.deepseek.com",
    apiKeyEnv: "$DEEPSEEK_API_KEY",
    thinking: true,
    vision: false,
    note: "保留 reasoning_content，适合 DeepSeek、火山 Coding Plan、Kimi thinking 兼容入口。"
  },
  {
    id: "gemini-openai",
    name: "Gemini / Qwen OpenAI 兼容",
    family: "OpenAI compatible thinking",
    provider: "qilin.models.patched_openai:PatchedChatOpenAI",
    model: "google/gemini-2.5-pro-preview",
    endpointKey: "base_url",
    endpoint: "https://openrouter.ai/api/v1",
    apiKeyEnv: "$OPENROUTER_API_KEY",
    thinking: true,
    vision: true,
    note: "保留 Gemini thought_signature，适合 OpenAI 兼容网关里的思考模型。"
  },
  {
    id: "mimo",
    name: "小米 MiMo",
    family: "MiMo reasoning",
    provider: "qilin.models.patched_mimo:PatchedChatMiMo",
    model: "mimo-v2.5-pro",
    endpointKey: "base_url",
    endpoint: "https://api.xiaomimimo.com/v1",
    apiKeyEnv: "$MIMO_API_KEY",
    thinking: true,
    vision: false,
    note: "为 MiMo reasoning_content 回放做适配。"
  },
  {
    id: "stepfun",
    name: "阶跃星辰 StepFun",
    family: "StepFun reasoning",
    provider: "qilin.models.patched_stepfun:PatchedChatStepFun",
    model: "step-3.7-flash",
    endpointKey: "base_url",
    endpoint: "https://api.stepfun.com/v1",
    apiKeyEnv: "$STEPFUN_API_KEY",
    thinking: true,
    vision: true,
    note: "默认开启 deepseek-style reasoning_format。"
  },
  {
    id: "minimax",
    name: "MiniMax",
    family: "MiniMax reasoning",
    provider: "qilin.models.patched_minimax:PatchedChatMiniMax",
    model: "MiniMax-M3",
    endpointKey: "base_url",
    endpoint: "https://api.minimax.io/v1",
    apiKeyEnv: "$MINIMAX_API_KEY",
    thinking: true,
    vision: true,
    note: "启用 reasoning_split，并兼容 MiniMax 消息格式。"
  },
  {
    id: "claude",
    name: "Claude",
    family: "Anthropic native",
    provider: "qilin.models.claude_provider:ClaudeChatModel",
    model: "claude-sonnet-4-20250514",
    endpointKey: "native",
    endpoint: "Anthropic SDK",
    apiKeyEnv: "$ANTHROPIC_API_KEY",
    thinking: true,
    vision: true,
    note: "使用 QiLin Claude 包装器，支持扩展 thinking 参数。"
  },
  {
    id: "vllm",
    name: "自托管 vLLM",
    family: "Self hosted",
    provider: "qilin.models.vllm_provider:VllmChatModel",
    model: "Qwen/Qwen3-32B",
    endpointKey: "base_url",
    endpoint: "http://localhost:8000/v1",
    apiKeyEnv: "$VLLM_API_KEY",
    thinking: true,
    vision: false,
    note: "适合本地或私有推理服务。"
  },
  {
    id: "mindie",
    name: "华为 MindIE",
    family: "Enterprise inference",
    provider: "qilin.models.mindie_provider:MindIEChatModel",
    model: "Qwen3-Coder-480B-A35B-Instruct-Client",
    endpointKey: "base_url",
    endpoint: "http://localhost:8989/v1",
    apiKeyEnv: "$MINDIE_API_KEY",
    thinking: false,
    vision: false,
    note: "面向企业私有化推理服务。"
  },
  {
    id: "codex",
    name: "OpenAI Codex Provider",
    family: "Codex style",
    provider: "qilin.models.openai_codex_provider:CodexChatModel",
    model: "gpt-5.4",
    endpointKey: "native",
    endpoint: "OpenAI Codex provider",
    apiKeyEnv: "$OPENAI_API_KEY",
    thinking: true,
    vision: false,
    note: "QiLin 内置 Codex 风格 provider。"
  }
];

export const SETTING_SECTIONS: SettingSection[] = [
  {
    id: "general",
    title: "常规",
    group: "个人",
    icon: SlidersHorizontal,
    summary: "语言、默认工作区、菜单栏行为和桌面端运行偏好。",
    fields: [
      { name: "语言", value: "简体中文", hint: "应用 UI 和报告默认语言" },
      { name: "默认研究目录", value: ".kstock/workspaces", hint: "会话文件和报告输出位置" },
      { name: "运行时防止系统休眠", value: "开启", hint: "长任务执行时保持唤醒" }
    ]
  },
  {
    id: "models",
    title: "模型",
    group: "引擎",
    icon: Brain,
    summary: "模型列表、provider 模板、思考模式、视觉能力和成本上限。",
    fields: [
      { name: "默认模型", value: "未配置", hint: "选择一个模板后填入密钥即可启用" },
      { name: "并发上限", value: "0", hint: "0 表示不限制 QiLin LLM call 并发" },
      { name: "重试策略", value: "3 次 / 1000ms", hint: "对应 llm_call.retry_*" }
    ]
  },
  {
    id: "attachments",
    title: "附件上传",
    group: "执行",
    icon: Paperclip,
    summary: "会话附件的大小、数量与总量限制（写入 runtime.yaml uploads 段，重启生效）。",
    fields: [
      { name: "单文件上限", value: "50 MB", hint: "对应 uploads.max_file_size" },
      { name: "文件数量上限", value: "10 个", hint: "对应 uploads.max_files" },
      { name: "总量上限", value: "100 MB", hint: "对应 uploads.max_total_size" }
    ]
  },
  {
    id: "tools",
    title: "工具与沙箱",
    group: "执行",
    icon: TerminalSquare,
    summary: "LocalSandboxProvider、工具输出限制、文件读写和命令超时。",
    fields: [
      { name: "Sandbox Provider", value: "qilin.sandbox.local:LocalSandboxProvider", hint: "桌面端默认本地沙箱" },
      { name: "Host Bash", value: "关闭", hint: "allow_host_bash 保持关闭" },
      { name: "命令超时", value: "600 秒", hint: "对应 sandbox.bash_command_timeout" }
    ]
  },
  {
    id: "memory",
    title: "记忆与摘要",
    group: "智能体",
    icon: MemoryStick,
    summary: "同页配置记忆机制、会话摘要、标题生成；管理记忆事实（增删改 / 导入导出 / 清空）。",
    fields: []
  },
  {
    id: "subagents",
    title: "子代理",
    group: "智能体",
    icon: GitBranch,
    summary: "预置 5 个量化研究角色（行情/个股/缠论/回测/报告），全局超时与轮次配置。",
    fields: [
      { name: "预置角色", value: "5 个", hint: "market-data / stock-researcher / chan-theory / backtest / report-writer" },
      { name: "全局超时", value: "1800 秒", hint: "对应 subagents.timeout_seconds" },
      { name: "每轮上限", value: "6 次", hint: "对应 subagents.max_total_per_run" }
    ]
  },
  {
    id: "guardrails",
    title: "权限与护栏",
    group: "安全",
    icon: Shield,
    summary: "RBAC、工具策略、输入清洗、循环检测和安全 finish_reason。",
    fields: [
      { name: "Authorization", value: "开启", hint: "细粒度资源授权" },
      { name: "Input Polish", value: "开启", hint: "发送前润色和结构化" },
      { name: "Loop Detection", value: "开启", hint: "防止重复调用循环" }
    ]
  },
  {
    id: "search",
    title: "搜索与来源",
    group: "研究",
    icon: Search,
    summary: "MCP、工具搜索、新闻/公告/研报来源和来源面板。",
    fields: [
      { name: "Tool Search", value: "开启", hint: "按需发现工具能力" },
      { name: "MCP Extensions", value: "按配置加载", hint: "对应 extensions_config" },
      { name: "来源展示", value: "自动隐藏浮动面板", hint: "主界面右侧环境信息" }
    ]
  },
  {
    id: "database",
    title: "数据与持久化",
    group: "系统",
    icon: Database,
    summary: "后端选择（memory/sqlite/postgres）、连接池、检查点模式。后端切换需重启 gateway。",
    fields: []
  },
  {
    id: "auth",
    title: "账户与登录",
    group: "系统",
    icon: KeyRound,
    summary: "本地账户、OIDC、工作区身份和密钥管理。",
    fields: [
      { name: "登录方式", value: "本地账户优先", hint: "后续接 OIDC / SSO" },
      { name: "密钥存储", value: "本机安全存储", hint: "前端只展示掩码" },
      { name: "工作区身份", value: "默认用户", hint: "绑定 QiLin user_id" }
    ]
  },
  {
    id: "reports",
    title: "报告输出",
    group: "研究",
    icon: FileSearch,
    summary: "HTML 数据看板、离线资源、报告库和报告技能状态。",
    fields: [
      { name: "默认格式", value: "HTML Dashboard", hint: "单个自包含离线看板" },
      { name: "图表技能", value: "chart-visualization", hint: "使用精选通用图表技能" },
      { name: "报告技能", value: "analysis-report", hint: "统一投研报告结构" }
    ]
  },
  {
    id: "runtime",
    title: "运行与预算",
    group: "执行",
    icon: Gauge,
    summary: "Token 预算、递归限制、熔断、重试和进度事件。",
    fields: [
      { name: "Token Usage", value: "开启", hint: "统计输入/输出/总 token" },
      { name: "Token Budget", value: "关闭", hint: "可设置硬停止阈值" },
      { name: "最大递归", value: "1000", hint: "对应 max_recursion_limit" }
    ]
  },
  {
    id: "integrations",
    title: "插件与技能",
    group: "集成",
    icon: Plug,
    summary: "MCP server CRUD（含股票类模板）+ 预置技能启停管理。",
    fields: [
      { name: "MCP Server", value: "支持模板快捷添加", hint: "Tushare / AKShare / Wind / Choice 模板" },
      { name: "预置技能", value: "12 个", hint: "10 个股票类 + 2 个通用类，可单独启停" },
      { name: "生效方式", value: "重启后加载", hint: "变更写入配置文件，重启 gateway 生效" }
    ]
  }
];
