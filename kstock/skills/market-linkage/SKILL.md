---
name: market-linkage
description: |
  A 股市场联动分析场景（编排手册）。用户问「市场联动 / 大盘联动 / 资金面
  情绪面全景 / 今天市场怎么样 / 多维度联动分析」等市场全景类问题时触发。
  编排 market-linkage-engine（8 维度引擎数据）+ 可选分维度并行解读
  （futures-analysis / etf-analysis / macro-query）+ html-report 看板交付
  与报告库归档。产出：单文件 HTML 联动看板（评分卡 + 8 维图表 + 结论）。
license: MIT
category: finance
version: 2.0.0
author: kk-quant
tags:
  - A股
  - 市场联动
  - 场景编排
  - 资金面
  - 情绪面

package:
  type: knowledge-only
metadata:
  openclaw:
    emoji: "🔗"
    version: "2.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - A股
      - 市场联动
      - 场景编排
---

# 市场联动分析场景（编排手册）

本技能是**场景编排层**：自身不带数据脚本，编排以下技能完成一次完整的市场
联动分析并交付 HTML 看板。被分派本场景的代理（主代理或子代理）按三阶段执行。

## 触发条件

- 「市场联动」「大盘联动」「资金面情绪面」「多维度联动」「市场全景」；
- 「今天/最近市场怎么样」「本周市场复盘」等市场整体判断类问题；
- 个股/单板块深度问题**不**触发本场景（走对应个股研究技能）。

## 粒度选择

| 用户问法 | 粒度 | 命令 |
|---|---|---|
| 今天 / 最新 / 收盘 | 日度 daily | `python3 -m market_linkage_engine daily` |
| 本周 / 这周 / 中期趋势 / 复盘 | 周度 weekly | `python3 -m market_linkage_engine weekly` |

拿不准时选 daily，并在报告注明粒度与数据窗口。

## 阶段一：数据采集（必做）

1. 先用 `skill` 工具加载 `market-linkage-engine` 技能，按加载结果给出的
   基目录（`Base directory for this skill: ...`）进入后执行；
2. 采集命令（在 market-linkage-engine 加载结果给出的基目录内，相对路径按基目录解析）：

   ```bash
   python3 -m market_linkage_engine daily -f json -o linkage.json
   # 周度：python3 -m market_linkage_engine weekly -f json -o linkage.json
   ```

3. **必须用 `-o` 参数落盘 JSON**，禁止 shell 重定向 `>` 生成文件（引擎日志
   走 stderr，重定向会把日志混入 JSON 导致解析失败）；
4. 读取 `linkage.json`：8 大维度（主力资金 / 北向资金 / 两融 / 期指基差 /
   期权波动率 / ETF 份额 / Shibor / 龙虎榜）各自的评分、偏向与明细，
   以及综合评分与市场总结。

依赖：脚本需要 TUSHARE_TOKEN（数据源凭据已由壳注入环境，缺token 时脚本会
明确报错——此时按「无数据」口径处理，禁止编造数值）。

## 阶段二：分维度解读（可选，用户要「深度/详细」时执行）

对以下维度用 `subagent` 工具并行委派补充解读（委派 prompt 必须写明：先
`skill` 加载对应技能、要执行的命令、输出格式；返回数值原样转述）：

| 维度 | 补充技能 | 解读重点 |
|---|---|---|
| 期指基差 | futures-analysis | 基差结构与多空持仓印证 |
| ETF 份额 | etf-analysis | 申赎与价格的背离/同步信号 |
| 宏观流动性 | macro-query | Shibor 与资金面的宏观背景 |

不需要深度解读时跳过本阶段，直接进入阶段三。

## 阶段三：报告交付（必做）

1. 按 `html-report` 技能的报告 JSON 契约（其 `references/report-schema.md`）
   构造联动报告：
   - 评分卡：综合评分、偏多/偏空计数、一句话市场总结；
   - 图表：8 维评分条形图（bar）、北向资金与两融余额时间序列（line）、
     维度偏向分布（pie）；
   - 分节正文：每维度小节 = 明细表格 + 2-3 条解读（带数据依据）；
   - 风险提示与参考来源（Tushare 接口名 + 数据日期）；
2. 保存 `report.json` 后用 html-report 技能渲染器产出单文件 HTML：

   ```bash
   python3 <html-report 基目录>/scripts/render_report.py report.json -o market-linkage.html
   # <html-report 基目录> = html-report 技能加载结果给出的 Base directory
   ```

3. 用 html-report 技能 SKILL.md 中的 curl 模板归档报告库：
   `POST /kstock-api/reports`；
4. `present` 呈现 HTML，消息区给出综合评分、偏向与关键信号摘要。

## 输出纪律（强约束）

- 8 维表格数值**原样转述**，禁止改写数值、四舍五入口径变更或丢弃表格；
- 金额口径：亿元（引擎输出已换算，不要再次换算）；
- 缺失维度诚实标注「无数据」及原因（如 Tushare 无权限），禁止以「中性」
  掩盖；
- 结论必须带综合评分、偏向与数据日期；方向性判断给依据与反证信号；
- 全文为研究参考口径，不构成投资建议。
