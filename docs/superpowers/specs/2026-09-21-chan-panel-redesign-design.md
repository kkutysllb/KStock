# 缠论研究面板改版设计（动力学×形态学结合分析）

- 日期：2026-09-21
- 状态：设计已获用户批准（布局/雷达/路径均经选项确认）
- 范围：`kstock/chan-ui`（前端全量改版）+ `vendor/skills/public/stock-analysis`（signal_scorer 分类修复，经 patch_vendor_skills.py 补丁 22 镜像四 preset）

## 1. 背景与动机

用户反馈：缠论研究面板功能偏少、界面需要美化丰富，且「动力学和形态学结合分析的逻辑缺少展示」——背驰为什么成立、买卖点为什么推导出来、中枢在如何演化，这些推理链在当前 UI 中不可见。

### 1.1 已确诊的引擎侧缺陷（用户发现）

用户观察到「不同周期下方的雷达图和信号明细一样」。实测（000001，daily/weekly/30min 三级别直跑引擎脚本）证据链：

1. 雷达 7 轴中 5 轴被结构性钉死在 50.0（中性）——三级别形状几乎相同，仅 vol/bar 两轴真实波动（56.2/46.2/61.2）；
2. 根因一：`signal_scorer.py::_get_category()` 按信号名前缀（cxt_/tas_/vol_…）归类，但 `chan_enhanced.py::generate_signal_library()` 生成的 38 个键中只有 `bar_*`(6)/`jcc_*`(3)/`vol_*`(3) 带前缀，其余全部落入默认类别 cxt；
3. 根因二：tas/pos/sta 三类信号库中根本不存在 → 空类别雷达恒 50；
4. 根因三：大量信号值落「其他_任意_任意/无信号」中性桶（评分 0），cxt 均值被拉回 0 → 雷达 50；
5. final_score 因 vol/bar 加权仍微动（52.6/47.9/54.7），造成「有点变化但图一样」的观感。

结论：雷达本质退化为两轴仪表。本设计以「缠论原生维度雷达」替换（§4.1），并修复分类 bug（§5）使保留的综合评分恢复语义。

## 2. 已确认的决策

| 决策点 | 用户选择 |
|---|---|
| 结合分析模块 | 全选四件：背驰力度对比卡、买卖点证据链、中枢演化状态卡、多级别联立矩阵 |
| 雷达维度体系 | 缠论原生七维（替换 czsc 七类） |
| 布局 | 方案 C 三栏证据台（主图 / 中栏证据链 / 右状态栏） |
| 实现路径 | 方案一：前端合成 + 引擎仅修 signal_scorer 分类 bug |

## 3. 布局：三栏证据台（自适应降级）

```
┌ 顶栏：代码输入 · 级别选择 · 分析 · Agent 深度解读 ┐
├──────────┬────────────────┬──────────────┤
│ 主图      │ 中栏·证据链      │ 右栏·状态      │
│ K线+笔段  │ ⓪推导总链(一句话) │ 缠论原生雷达    │
│ 中枢+背驰 │ ①背驰判定卡      │ 多级别联立矩阵  │
│ 买卖点    │ ②买卖点证据链    │ 关键位+评估     │
│ MACD/量  │ ③中枢演化卡      │ 信号明细(折叠) │
└──────────┴────────────────┴──────────────┘
```

- 断点：≥1100px 三栏；<1100px 中栏并入右栏 Tab 化；<760px 全部纵向堆叠。面板为 slot 组件，宽度随容器自适应。
- 现有滚轮缩放/拖拽/双击复位/hover 十字线交互全部保留。

## 4. 模块设计

### 4.1 中栏「动力学×形态学」证据链（核心新增）

- **⓪ 推导总链**（顶部窄条，自动拼装）：由①②③卡状态拼一句话推理，如 `下跌两中枢 → 末段底背驰成立 → 一买候选 → 周线未确认`。数据缺失环节以「—」占位。
- **① 背驰判定卡**：数据源 `chart_data.backchis[]`（current/previous_macd_area、macd_divergence、四段时间戳、valid、backchi_type）。每条渲染：双横条对比（前段 vs 现段 MACD 面积）、macd_divergence 数值、价格关系（前端按 previous/current 区间从 kline 计算新高/新低对照）、结论徽章（顶/底/盘整背驰 × 成立/不成立）。valid 优先排序。点击 → 主图定位该区间并高亮背驰罩（脉冲动画）。
- **② 买卖点证据链卡**：数据源 `dynamics.buy_points/sell_points[]` + `chart_data.markers[]`（type、price、timestamp、reliability、strength、confirmed_by_higher/lower）。逐点渲染：类型徽章（一买…三卖）+ 价格/日期 + 可靠度条 + 强度 + 高/低级别确认标记 + 「为什么」行：按类型静态缠论定义（一买=下跌趋势+底背驰；三买=中枢上沿放量突破回踩不破等）+ 动态联动（存在对应背驰时标注联动）。点击 → 主图定位。
- **③ 中枢演化卡**：数据源 `active_zhongshus[]` + `chart_data.zhongshu_zones[]`（zhongshu_type、high/low/center/gg/dd、extend_count、stability）。渲染：类型徽章（普通/扩展/复杂）、区间与中轴、延伸次数、稳定度条、GG/DD 震荡带、当前价位置指示器（上/内/下 + 距上沿/下沿百分比）、下一步推演文案（规则生成：按现价位置 + 走势类型 + 趋势方向输出，如「放量破 GG 11.28 → 三买成立」「跌破 ZD 10.80 → 中枢下移风险」）。点击 → 主图定位中枢。

### 4.2 右栏状态栏

- **缠论原生雷达**（替换 SignalRadar）七维，全部客户端合成、逐周期天然不同；每维 hover 展示计算依据：
  1. 形态完整度：分型/笔/段计数结构比例合理性 + processed 比例（morphology）；
  2. 中枢稳定度：最新中枢 stability（无中枢→维度缺失不画均值）；
  3. 走势强度：trend_strength × 100；
  4. 背驰压力：valid 背驰计数 + macd_divergence 强度（顶背驰记空方压力、底背驰记多方承接）；
  5. 买卖点质量：最近信号 reliability；
  6. 级别共振：联立矩阵方向一致率；
  7. 量能配合：前端按 kline+volumes 算量价配合度（涨放量/跌缩量=配合）。
  总分=各维等权平均，偏多/偏空判定；维度数据缺失时该维退出总分并标注（不设隐性权重）。
- **多级别联立矩阵**：现 levelsBrief（仅高两档）扩展为四行：当前级别 + 低一档（若有）+ 高两档；到边界时向另一侧顺延补足四行（如 5min 无低档 → 5min/15min/30min/60min；monthly 无高档 → daily/weekly/monthly + 60min 顺延）。分钟级配额不足显示「数据不足」占位。每行：级别、走势方向、最新买卖点、得分、背驰数；同向行高亮共振（多绿/空红）。
- **关键位**（保留现有）+ 新增 `assessment.risk_level/confidence_score` 评估小条。
- **信号明细**：修复后的 czsc chips 收纳为折叠区（默认收起）。

### 4.3 主图增强（美化项）

- 顶部信息条：现价大字 + 涨跌幅 + 走势类型徽章 + 中枢位置徽章；
- 买卖点徽章外圈可靠度环；背驰罩渐变填充；中枢渐变 + 圆角延续现有紫系；
- hover tooltip 增加结构上下文：该 K 线处的分型/笔端点/买卖点/中枢事件；
- 图例重排至更紧凑位置；
- 中栏卡片点击 → `focusIndex` 扩展携带 highlightId，图上对应元素（背驰罩/买卖点/中枢）脉冲高亮。

### 4.4 美化基调

沿用 KStock 暗色与 dsw token 体系；卡片化层级 + 间距/字重规范化；色彩语义不变（红涨绿跌、紫中枢、橙笔、蓝段），新增背驰红罩系、买点绿系/卖点红系徽章；数字等宽对齐。

## 5. 引擎侧小补丁（唯一后端改动）

- 位置：`vendor/skills/public/stock-analysis/chan_theory_v2/core/signal_scorer.py`；
- 内容（经代码审查修正）：`_get_category()` 增加 `_SIGNAL_CATEGORY_OVERRIDE` 显式表——仅 8 个技术指标裸键（macd_cross/dif_zero/double_ma/ma_system/boll_status/kdj_cross/rsi_status/atr → tas，与评分表 `tas_*` 前缀分类一致；trend_type 实为 `cxt_trend_type_signal` 产出的裸键，默认 cxt 已正确，不进表）；bar_*/vol_*/jcc_* 前缀兜底保留。另在 `score_single_signal()` 裸键查分 miss 时按类别前缀补齐重试（评分表 157 键全带前缀、信号库产出裸键，查分 miss 是 radar 钉死 50 的另一半根因，只改分组不动分数无效）。sta/pos 在信号库全库无信号，保持空且不参与加权（诚实呈现）。
- 登记 `scripts/patch_vendor_skills.py` 补丁 22（锚定 `_get_category` 原实现），apply 后镜像四 preset（stock-analysis/standard/chan-theory-expert/stock-screener）。
- 上游变更 → 锚点失配静默跳过（既有纪律），radar_data/category_scores 恢复语义后前端虽不再依赖，但综合评分与信号明细 chips 重新可用。
- 注：analyzed JSON 的 signal_scores 结构不变，无接口变更。

## 6. 不做什么（YAGNI）

- 不启用引擎 `multi_level_consistency.py`（MultiLevelConsensus），联立矩阵客户端拼接；
- 不动 `POST /kstock-api/chan-analyze` 接口与 spawnSync 时延；
- 不做多周期 K 线小图对比；
- 不动其他面板与全局样式。

## 7. 错误处理与缺失态

- parseChart 宽松解析纪律保持，新消费字段全部 asNum/asStr 容错；
- 无背驰/无中枢/无买卖点/分钟级数据不足：卡片渲染诚实占位（「本级别无背驰记录」等），不造假数据；
- 多级别请求失败：矩阵该行显示「加载失败」，不阻塞其余行；
- 雷达某维数据缺失：该维退出总分并在 hover 说明。

## 8. 验收标准

1. `bash scripts/check-ci.sh` 通过（chan-ui 构建 + 既有 gate）；
2. 隔离引擎（18099 smoke 环境）Playwright 冒烟：
   - 三栏布局截图正常，<1100px 与 <760px 降级正常；
   - 背驰卡/买卖点卡/中枢卡点击 → 主图定位与高亮联动；
   - **daily/weekly/30min 三级别雷达形状实测不同**（直接验证原始痛点已治）；
   - 证据链卡片在 000001（有结构数据）与分钟级配额不足股上均不崩、缺失态诚实；
3. 补丁 22/23 应用后四 preset 的 signal_scorer 一致，真实数据下 `category_counts` 中 cxt/tas/vol/bar/jcc 非空（sta/pos 全库无信号，保持空且不参与加权），且 `radar_data` 的 tas/cxt 轴随级别变化（不再钉死 50）；
4. 不回退既有功能：缩放/拖拽/复位/Agent 深度解读/多级别摘要。
