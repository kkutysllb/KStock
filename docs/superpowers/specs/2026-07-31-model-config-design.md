# 前端模型配置打通 — 设计文档

- 日期：2026-07-31
- 分支：`feat/model-config`
- 状态：已批准，待实现

## 背景与目标

桌面端设置页的「模型」当前是纯展示桩：从硬编码的 `MODEL_TEMPLATES` 读取数据，所有字段 `readOnly`，与内置 QiLin gateway 完全脱节。引擎已配置的真实模型无法在前端体现，用户也无法通过 UI 增删改模型配置。

本功能打通模型配置的读写闭环：前端能真实读取引擎已配置的模型、增删改模型配置并即时生效、在消息输入框选用当前会话使用的模型。

## 引擎现状（vendor/qilin）

调研结论：

- `GET /api/models` 只读，返回 `name / model / display_name / supports_thinking / supports_reasoning_effort`，**故意不返回 provider / endpoint / api_key**（安全考虑）
- **无写入端点**——引擎不提供增删改模型的 API
- 配置文件 mtime 变化后 `get_app_config()` 自动热重载（`vendor/qilin/qilin/config/app_config.py` line 655-661），KStock 改写 `qilin.runtime.yaml` 即可让改动即时生效，无需重启 gateway

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 功能范围 | 完整 CRUD + 默认模型 | 纯只读无法满足用户自配置需求；CRUD 才是真正的"打通" |
| API key 存储 | `secrets.env` + 环境变量引用 | 符合引擎原生 `api_key: $ENV` 设计；key 与配置分离；文件权限 600 |
| provider 模板定位 | 快速入口 + 空白添加 | 模板降低门槛（预填 use/endpoint/capabilities），空白满足高级用户 |
| 写入端点位置 | 独立 `scripts/kstock_models.py` | 职责分离，`run_gateway.py` 不膨胀 |
| 输入框模型选择 | 会话级选择 + 请求传入 | 避免频繁改写配置文件；支持多模型灵活切换；localStorage 持久化 |

## 架构

```
前端 ModelSettings（设置页）
   ├── GET  /api/v1/models              ← 引擎原生只读端点（展示）
   └── CRUD /api/v1/kstock/models       → KStock 写入层（新增）
                                           ├── 改写 qilin.runtime.yaml models 段
                                           └── 更新 secrets.env（API key 明文存此）
                                                     ↓
引擎 get_app_config() 检测 mtime 变化 → 自动热重载 → 新配置生效

输入框模型选择器
   ├── listModels() 与设置页共享数据
   ├── 选中项持久化 localStorage（key: kstock.activeModel）
   └── 发送消息时 model 随 session 消息元数据记录（真正调用引擎 run 属后续功能）
```

关键点：引擎不提供写入 API，KStock 自己实现写入层；引擎的 mtime 自动重载机制让改动即时生效。

## 后端：KStock 写入层（scripts/kstock_models.py）

独立 FastAPI 路由模块，`run_gateway.py` 在 `create_app()` 里 `app.include_router()` 挂载。

### 端点

| 端点 | 方法 | 作用 |
|------|------|------|
| `/api/v1/kstock/models` | GET | 读 runtime.yaml 的 models 段，返回含 provider/endpoint/capabilities（比引擎原生多返回前端编辑需要的字段），api_key 字段返回 `$ENV_VAR` 引用而非明文 |
| `/api/v1/kstock/models` | POST | 新增模型：写 runtime.yaml models 段 + 写 secrets.env（若提供 key） |
| `/api/v1/kstock/models/{name}` | PUT | 编辑现有模型：更新 runtime.yaml 对应条目 + 同步 secrets.env |
| `/api/v1/kstock/models/{name}` | DELETE | 删除模型：从 runtime.yaml 移除 + 从 secrets.env 删对应 key |
| `/api/v1/kstock/default-model` | GET/PUT | 读写 KStock 偏好文件 `prefs.json` 的 `default_model` 字段（引擎 `AppConfig` 无此字段，这是 KStock 自己的偏好，见下方说明） |

### 文件写入安全

- runtime.yaml 写入前先 `shutil.copy2` 备份到 `<data_root>/backups/`
- 写入用临时文件 + `os.replace` 原子替换
- secrets.env 创建即 `chmod 600`
- key 写入格式 `KEY="value"`

### 环境变量命名约定

`KSTOCK_MODEL_<UPPER_NAME>_KEY`，其中 `<UPPER_NAME>` 由模型 name 转大写、非字母数字字符转下划线得到。例如 name=`deepseek-v4` → `KSTOCK_MODEL_DEEPSEEK_V4_KEY`。

### 默认模型存储说明

引擎 `AppConfig` 无 `default_model` 顶层字段（调研确认：模型选择是 run 级别的，通过发起 run 时的 `context.model_name` 传入，而非配置级默认值）。因此「默认模型」是 **KStock 自己的前端偏好**，存到独立的偏好文件 ``<data_root>/config/prefs.json``，字段名 ``default_model``。该文件由 KStock 写入层独占管理，与 runtime.yaml 解耦，不影响引擎热重载。

### 热重载触发

runtime.yaml 被原子替换后 mtime 变化，引擎 `get_app_config()` 下次调用自动重载——无需主动通知，无需重启 gateway。偏好文件 ``prefs.json`` 不影响引擎，仅供前端读取。

## 前端：modelsClient.ts（新增）

镜像 `authClient.ts` 模式，封装类型与 API：

```typescript
export interface ModelConfig {
  name: string;
  display_name: string | null;
  description: string | null;
  use: string;                    // provider class path
  model: string;                  // 模型标识
  api_base: string | null;        // endpoint（OpenAI 系）
  api_key_env: string;            // 形如 $KSTOCK_MODEL_X_KEY（引用）
  supports_thinking: boolean;
  supports_vision: boolean;
  supports_reasoning_effort: boolean;
}

// 导出函数
listModels(): Promise<ModelConfig[]>
createModel(payload): Promise<ModelConfig>
updateModel(name, payload): Promise<ModelConfig>
deleteModel(name): Promise<void>
getDefaultModel(): Promise<string | null>
setDefaultModel(name): Promise<void>
```

## 前端：ModelSettings 组件重构（Home.tsx）

从纯展示桩改为真实 CRUD：

- **左侧模型列表**：`listModels()` 加载，显示 display_name + provider 简称 + 能力徽章（思考/视觉）。顶部「+ 添加模型」按钮。当前选中高亮
- **添加模型弹层**：先选「从模板添加」（复用现有 `MODEL_TEMPLATES`，预填 use/endpoint/capabilities）或「空白添加」。表单字段：name / display_name / use / model / api_base / api_key（明文输入，提交时转 env 引用）/ 能力 checkbox
- **右侧编辑面板**：选中模型后展示可编辑表单，底部「保存」「删除」按钮。删除需二次确认（原生 confirm）
- **默认模型选择器**：顶部下拉，`setDefaultModel` 写入 runtime.yaml 顶层
- **加载/错误/空态**：loading 骨架、API 错误用 authClient 同款中文归一、无模型时引导添加

敏感字段处理：api_key 输入框 type=password，编辑现有模型时显示为 `•••••（已配置）`，留空表示不修改。

## 前端：输入框模型选择器（新增）

在 `composer-toolbar` 内（现有「研究模式」「QiLin 已连接」徽章旁）加模型下拉选择器：

- 启动时读 `getDefaultModel()` 作为初始选中；未配置默认模型时自动选列表第一个
- 模型列表与设置页 `ModelSettings` 共享同一份 `listModels()` 数据
- 无已配置模型时选择器显示「未配置模型」并禁用发送（提示去设置页添加）
- 选中项持久化到 `localStorage`（key: `kstock.activeModel`），下次启动自动恢复

发送链路：`onSend` 签名扩展为 `(text: string, model: string) => void`，对应 `handleSend` / `appendMessageToSession` 把 `model` 存入 session 消息元数据，供后续真正调引擎 run 时作为 `body.model` 传入。

> 本功能范围只到「选择器 + 状态持久化 + 随消息记录 model 字段」。真正发起引擎 run 的对接（thread_runs 端点）属于后续功能，不在本次范围。

## 测试

### 后端

`scripts/test_kstock_models.py`（pytest）覆盖：
- CRUD 端点基本流程
- secrets.env 读写（创建、追加、删除 key、权限 600）
- runtime.yaml 原子替换（写入中断不破坏原文件）
- 备份文件生成到 `<data_root>/backups/`
- 环境变量命名规则

### 前端

`tests/App.spec.tsx` 扩展，mock modelsClient：
- 模型列表渲染
- 从模板添加模型的流程
- 编辑保存
- 删除二次确认
- 输入框模型选择器与设置页联动

### 端到端（Playwright）

首启无模型 → 设置页添加 deepseek 模板 → 输入框选择器出现 → 选中新模型 → 选择器状态持久化。

## 文档

- `docs/配置说明.md` 新增「模型配置」章节（CRUD 操作、API key 存储位置 secrets.env、环境变量命名规则）
- `docs/运行说明.md` 补充「配置模型」步骤到首次运行流程
- **`docs/开发进度.md`（新增）**：统计截至当前所有已交付功能（含上一阶段的用户数据空间、认证闭环、sidecar→gateway 迁移，与本阶段的模型配置打通），按功能项 / 涉及模块 / 状态组织

## 范围外（YAGNI）

以下明确不在本次范围：

- 真正发起引擎 run 的对接（thread_runs 端点、流式响应）——后续功能
- API key 的 keychain 集成——当前 secrets.env 已足够
- 模型测试连通性按钮——后续迭代
- 多用户共享模型配置——当前单用户场景
- provider 模板的动态拉取——当前硬编码模板已覆盖主流 provider
