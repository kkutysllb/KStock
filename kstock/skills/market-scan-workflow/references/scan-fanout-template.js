// ── 全市场扫描 workflow 模板（初筛 → 逐股扇出快评 → 汇总看板）───────────
//
// 用法（主会话）：
//   1. 读本模板，替换 2 个 ◆TODO◆（QUERY 初筛条件 / REPORT_TITLE 报告标题），
//      按需调整 TOP_N 与 FANOUT_K；
//   2. 文末 meta 注释块填进 workflow 工具的 meta 参数，本文件整体填进 script 参数
//      （meta 不是代码，禁止写 export const meta）；
//   3. 钩子契约以会话内 workflow 工具描述为准：agent(prompt, opts) / pipeline(items,
//      ...stages) / parallel(thunks) / phase(title) / log(msg)；schema 仅可用
//      type/properties/required/additionalProperties/items/enum/const/oneOf；
//   4. run 返回后：核验 summary.report_path 存在 → 主会话 present 呈现
//      （present 由主会话做，子代理不做）。
//
// 纪律（随 preset persona 继承，prompt 内已内联提醒）：
//   - 凭据只经环境间接使用（. ~/.kstock/config/secrets.env），禁止回显/落盘；
//   - 引擎产物落 data/market-scan/，报告落 reports/（分区纪律）；
//   - 子代理数值原样转述禁止改写；缺失标「无数据」禁止编造；--mock 禁用；
//   - 单只子代理失败只标记该股无数据（失败隔离），仅阶段一失败才整体终止。

const QUERY = "◆TODO◆高股息低估蓝筹"; // 初筛自然语言条件（贴近策略原生语义：股息率/PE/PB/ROE/市值）
const TOP_N = 20; // 初筛返回数（选股清单建议 20）
const FANOUT_K = 8; // 进入逐股快评的头部数（≤10：护 workflow 的 agent 并发/总量限额）
const REPORT_TITLE = "◆TODO◆全市场扫描看板";

const DATA_DIR = "data/market-scan";

// 交易所后缀（估值引擎必须带）。幂等：screener 返回的代码本身已带后缀
// （实测坑：盲目追加会产生 601919.SH.SH，估值查询落空报「无法获取估值数据」）。
const withSuffix = (code) =>
  /\d{6}\.[A-Z]{2}$/.test(code)
    ? code
    : /^[69]/.test(code)
      ? code + ".SH"
      : /^[48]/.test(code)
        ? code + ".BJ"
        : code + ".SZ";

// ── 阶段一：初筛（单代理，结构化收口）─────────────────────────────────────
phase("初筛");
log("初筛条件：" + QUERY + "，top " + TOP_N);

const screen = await agent(
  `你是选股引擎操作员，工作目录为当前工作区根。任务：跑一次选股初筛并结构化返回。
步骤：
1) mkdir -p ${DATA_DIR} reports；
2) 先用 skill 工具加载 a-stock-screener 技能，记下其 Base directory；
3) 采集（凭据经环境间接注入，禁止回显；预计超 30 秒则 run_in_background 后用 job_output 收集，禁止 nohup+sleep 轮询）：
   set -a && . ~/.kstock/config/secrets.env && set +a
   python3 "<a-stock-screener 基目录>/scripts/cli.py" --query "${QUERY}" --top ${TOP_N} --json > ${DATA_DIR}/screen.json
   （严禁 --mock：伪数据禁入交付物）
4) 校验：退出码 0、JSON 可解析、无 error 键、stocks 非空；任一不满足则把原因写进 error 字段如实返回，禁止编造数据。
只返回结构化结果：命中的策略组合、逐股代码/名称/评分/入选理由（数值原样转述）、screen.json 相对路径。`,
  {
    label: "初筛 " + QUERY,
    phase: "初筛",
    schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        strategies_used: { type: "array", items: { type: "string" } },
        stocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              name: { type: "string" },
              score: { type: "number" },
              reasons: { type: "array", items: { type: "string" } },
            },
            required: ["code", "name", "score"],
          },
        },
        data_file: { type: "string" },
        error: { type: "string" },
      },
      required: ["query", "strategies_used", "stocks", "data_file"],
    },
  },
);

if (!screen || screen.error || !screen.stocks || screen.stocks.length === 0) {
  return {
    ok: false,
    stage: "screen",
    error: !screen ? "初筛子代理失败" : screen.error || "初筛结果为空",
    hint: "检查数据源凭据与网络后重跑；无数据时禁止编造继续",
  };
}
log(
  "初筛命中策略 " + screen.strategies_used.join("/") + "，入选 " + screen.stocks.length + " 只",
);

// ── 阶段二：逐股扇出快评（pipeline 逐项流水，无栅栏，失败隔离）────────────
const candidates = screen.stocks.slice(0, FANOUT_K);
phase("逐股快评（扇出 " + candidates.length + " 只）");

const verdicts = await pipeline(candidates, async (stock) => {
  const full = withSuffix(stock.code);
  const v = await agent(
    `你是个股快评员，标的：${stock.code} ${stock.name}。工作目录为当前工作区根。任务：两维快评并结构化返回。
步骤：
1) 先用 skill 工具加载 stock-analysis 技能，记下其 Base directory（引擎在其 scripts/analysis-engine/ 下）；
2) 两路互不依赖，全部 run_in_background 并行发起、job_output 收齐（禁止 nohup+sleep 轮询）：
   python3 "<基目录>/scripts/analysis-engine/analyze_stock_company_info.py" --stock ${stock.code} --json > ${DATA_DIR}/quick-${stock.code}.json
   python3 "<基目录>/scripts/analysis-engine/analyze_stock_valuation.py" --stock ${full} --json > ${DATA_DIR}/val-${stock.code}.json
   （估值必须带交易所后缀 ${full}，裸代码会报「无法识别股票」；严禁 --mock；凭据禁止回显）
3) 校验退出码与 error 键；失败维度如实标注「无数据」并说明原因，禁止编造。
只返回结构化结果：行业、主业一句话、PE/PB 与历史估值百分位（数值原样，字符串口径）、风险 2-3 条、一句话结论、落盘文件相对路径。`,
    {
      label: "快评 " + stock.code + " " + stock.name,
      phase: "逐股快评",
      schema: {
        type: "object",
        properties: {
          code: { type: "string" },
          industry: { type: "string" },
          business_one_liner: { type: "string" },
          pe: { type: "string" },
          pb: { type: "string" },
          valuation_percentile: { type: "string" },
          one_liner: { type: "string" },
          risks: { type: "array", items: { type: "string" } },
          files: { type: "array", items: { type: "string" } },
        },
        required: ["code", "one_liner"],
      },
    },
  );
  // 失败隔离：单只失败标「无数据」，不拖垮整个 run
  return v
    ? { ...stock, ...v, quick_ok: true }
    : { ...stock, quick_ok: false, one_liner: "无数据（子代理失败）" };
});

const okCount = verdicts.filter((v) => v && v.quick_ok).length;
log("逐股快评完成 " + okCount + "/" + candidates.length);

// ── 阶段三：汇总看板（单代理收口，数值不改写）─────────────────────────────
phase("汇总看板");

const summary = await agent(
  `你是报告交付员。工作目录为当前工作区根。输入为已校验的结构化扫描结果（数值原样，禁止改写或重算排序口径）：
${JSON.stringify({
  query: screen.query,
  strategies_used: screen.strategies_used,
  screened_total: screen.stocks.length,
  verdicts,
})}
步骤：
1) 先用 skill 工具加载 html-report 技能，按其契约构造 reports/market-scan-report.json：
   评分卡（扫描条件/命中策略/入选数/快评完成数）；
   bar 图（入选股综合评分）；正文分节（清单总表：代码/名称/评分/策略命中/估值百分位；
   逐股快评 2-3 条；落选说明=策略解释帮用户放宽收紧条件）；风险提示与数据来源（接口名+数据日期）；
2) 渲染：python3 "<html-report 基目录>/scripts/render_report.py" reports/market-scan-report.json -o reports/market-scan.html
   （渲染器 stderr 有告警必须修正后重渲）；
3) 归档（可选、不阻塞交付）：按 html-report 技能的 curl 模板 POST http://127.0.0.1:18001/kstock-api/reports，
   引擎不可达则 archived 记 "no" 并注明；
4) 报告标题用「${REPORT_TITLE}」。
只返回结构化结果：报告相对路径、归档状态（yes/no）、数据日期、3-5 条要点（原样口径）。`,
  {
    label: "汇总看板",
    phase: "汇总看板",
    schema: {
      type: "object",
      properties: {
        report_path: { type: "string" },
        archived: { type: "string", enum: ["yes", "no"] },
        data_date: { type: "string" },
        highlights: { type: "array", items: { type: "string" } },
      },
      required: ["report_path", "archived"],
    },
  },
);

return {
  ok: !!summary,
  query: screen.query,
  strategies_used: screen.strategies_used,
  screened: screen.stocks.length,
  fanned_out: candidates.length,
  quick_ok: okCount,
  verdicts,
  summary: summary || null,
  note: summary
    ? "主会话核验 " + summary.report_path + " 后 present 呈现"
    : "汇总代理失败：初筛与快评产物已落 " + DATA_DIR + "/，可手动续跑阶段三",
};

// ── meta 参数（填进 workflow 工具的 meta，不进 script）───────────────────
// {
//   "name": "market-scan",
//   "description": "全市场扫描：初筛 → 逐股扇出快评 → 汇总看板",
//   "whenToUse": "批量筛选 + 逐股分析 + HTML 看板交付的多阶段扇出任务",
//   "phases": [
//     { "title": "初筛", "detail": "a-stock-screener 自然语言初筛 top N" },
//     { "title": "逐股快评", "detail": "公司信息 + 估值两维并行扇出" },
//     { "title": "汇总看板", "detail": "html-report 渲染 + 报告库归档" }
//   ]
// }
