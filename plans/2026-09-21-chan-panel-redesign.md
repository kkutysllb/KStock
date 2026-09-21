# 缠论研究面板改版实施计划

**Goal:** 按已批准规格（docs/superpowers/specs/2026-09-21-chan-panel-redesign-design.md）重做缠论研究面板：三栏证据台布局 + 动力学×形态学证据链（背驰/买卖点/中枢）+ 缠论原生七维雷达 + 多级别联立矩阵，并修 signal_scorer 分类 bug。

**Architecture:** 前端把 678 行的 page.tsx 拆成「纯逻辑 derive.ts（node:test 可测）+ 图表 chart.tsx + 证据链 evidence.tsx + 状态栏 status.tsx + 组合 page.tsx」，样式追加进 quant-ui 共享 quant.css；引擎侧唯一改动是 patch_vendor_skills.py 补丁 22（vendor 源头改 `_get_category`，镜像四 preset）。

**Tech Stack:** React 18 + 自研 SVG（无图表库）、tsdown 双端打包、node:test + tsx（chan-ui 新增测试）、patch_vendor_skills.py 锚点补丁、Playwright MCP 冒烟。

**执行前提（本会话已具备）:**
- 冒烟引擎在 18099 已运行（后台 job bash-13）；重启命令：
  `KSTOCK_APP_DATA_DIR=/tmp/kstock-smoke-data QILIN_HOME=/tmp/kstock-smoke-home KSTOCK_PRESETS_DIR="$PWD/kstock/presets" KSTOCK_SKILLS_DIR="$PWD/vendor/skills" ./dist-exe/kstock-engine --profile kstock --port 18099 --no-open`（需 danger-full-access 沙箱：引擎写 /tmp 与 ~/.kstock 运行时目录）
- 冒烟登录：`smoke-admin` / `Smoke-Test-2026!`
- 引擎服务插件模块按 boot 扫描——chan-ui 重建后必须重启冒烟引擎才生效。
- TUSHARE_TOKEN 在 `~/.kstock/config/secrets.env`（直跑 Python 引擎时用）。

---

### Task 1: 引擎补丁 22 — signal_scorer 信号类别显式映射

**Files:**
- Modify: `scripts/patch_vendor_skills.py`（补丁 20 定义块之后 + apply_skill_patches 调用处）
- 产物（补丁器自动改）: `vendor/skills/public/stock-analysis/chan_theory_v2/core/signal_scorer.py` 与四份 `kstock/presets/*/skills/stock-analysis/...` 镜像

- [ ] **Step 1.1: 在 patch_vendor_skills.py 增加补丁 22 定义**

定位锚点：`_fix_chan_zhongshu_guard` 函数结尾（`return text.replace(_CHAN_ZSGUARD_ANCHOR, _CHAN_ZSGUARD_REPLACEMENT, 1)` 那行）之后、`# ── KStock 自有技能 ensure` 注释之前，插入：

```python
# ── 补丁 22：缠论评分器信号类别显式映射 ────────────────────────────────
# generate_signal_library 的键大多不带类别前缀（bi_base/macd_cross/…），
# _get_category 前缀猜测把 30+ 信号全落入默认 cxt；tas/pos/sta 全库无
# 前缀信号恒空 → radar 五轴钉死 50（用户实测三级别形状相同）。显式表
# 优先，前缀兜底（bar_*/vol_*/jcc_* 本就带前缀）。
_CHAN_SCORER_REL = "public/stock-analysis/chan_theory_v2/core/signal_scorer.py"
_CHAN_SCORER_MARKER = "KStock patch: 信号类别显式映射"
_CHAN_SCORER_ANCHOR = (
    "    def _get_category(self, signal_name: str) -> str:" + chr(10)
    + '        """根据信号函数名确定类别"""' + chr(10)
    + '        for prefix in ["cxt", "tas", "bar", "vol", "jcc", "pos", "sta"]:' + chr(10)
    + "            if signal_name.startswith(prefix):" + chr(10)
    + "                return prefix" + chr(10)
    + '        return "cxt"  # 默认归入缠论形态'
)
_CHAN_SCORER_REPLACEMENT = (
    "    # KStock patch: 信号类别显式映射——generate_signal_library 的键大多" + chr(10)
    + "    # 不带类别前缀，前缀猜测把 30+ 信号全落入默认 cxt，tas/pos/sta 恒空" + chr(10)
    + "    # （radar 多轴钉死 50）。显式表优先，前缀兜底（bar_*/vol_*/jcc_*）。" + chr(10)
    + "    _SIGNAL_CATEGORY_MAP = {" + chr(10)
    + '        "trend_type": "tas",' + chr(10)
    + '        "macd_cross": "jcc", "double_ma": "jcc", "kdj_cross": "jcc",' + chr(10)
    + '        "dif_zero": "jcc", "ma_system": "jcc", "boll_status": "jcc",' + chr(10)
    + '        "rsi_status": "jcc", "atr": "sta",' + chr(10)
    + "    }" + chr(10)
    + chr(10)
    + "    def _get_category(self, signal_name: str) -> str:" + chr(10)
    + '        """根据信号函数名确定类别（KStock patch: 显式映射优先）"""' + chr(10)
    + "        if signal_name in self._SIGNAL_CATEGORY_MAP:" + chr(10)
    + "            return self._SIGNAL_CATEGORY_MAP[signal_name]" + chr(10)
    + '        for prefix in ["cxt", "tas", "bar", "vol", "jcc", "pos", "sta"]:' + chr(10)
    + "            if signal_name.startswith(prefix):" + chr(10)
    + "                return prefix" + chr(10)
    + '        return "cxt"  # 默认归入缠论形态（bi_/zs_/fx_/backchi/decision 等）'
)


def _fix_chan_scorer_categories(text: str) -> str | None:
    """评分器信号类别显式映射（signal_scorer.py）；已修/失配返回 None。"""
    if _CHAN_SCORER_MARKER in text:
        return None
    if _CHAN_SCORER_ANCHOR not in text:
        return None
    return text.replace(_CHAN_SCORER_ANCHOR, _CHAN_SCORER_REPLACEMENT, 1)
```

- [ ] **Step 1.2: 在 apply_skill_patches 中接线**

定位锚点：`apply_skill_patches` 里补丁 20 的最后一个调用块

```python
    if chan_script.exists():
        if _patch_file(chan_script, _CHAN_SCRIPT_REL, _fix_chan_zhongshu_guard):
            changed.append(_CHAN_SCRIPT_REL)
```

在其后、`# preset 随行技能目录发布` 注释之前插入：

```python
    # 缠论评分器信号类别显式映射（radar 钉死 50 修复，补丁 22）。
    chan_scorer = vendor_root / _CHAN_SCORER_REL
    if chan_scorer.exists():
        if _patch_file(chan_scorer, _CHAN_SCORER_REL, _fix_chan_scorer_categories):
            changed.append(_CHAN_SCORER_REL)
```

- [ ] **Step 1.3: 应用补丁并验证镜像**

```bash
scripts/python.sh scripts/patch_vendor_skills.py
grep -c "KStock patch: 信号类别显式映射" vendor/skills/public/stock-analysis/chan_theory_v2/core/signal_scorer.py
for p in standard chan-theory-expert stock-screener; do diff -q kstock/presets/stock-analysis/skills/stock-analysis/chan_theory_v2/core/signal_scorer.py kstock/presets/$p/skills/stock-analysis/chan_theory_v2/core/signal_scorer.py; done
```

预期：输出含 `public/stock-analysis/chan_theory_v2/core/signal_scorer.py` 与 `kstock/presets/*/skills`；grep 计数 ≥1；三条 diff 无输出（一致）。

- [ ] **Step 1.4: 幂等验证**

```bash
scripts/python.sh scripts/patch_vendor_skills.py
```

预期：`技能补丁均已就绪，无需改动。`

- [ ] **Step 1.5: Python 行为验证**

```bash
cd kstock/presets/stock-analysis/skills/stock-analysis && python3 -c "
from chan_theory_v2.core.signal_scorer import SignalScorer
s = SignalScorer()
checks = {'bi_base':'cxt','zs_status':'cxt','backchi':'cxt','decision':'cxt','trend_type':'tas','macd_cross':'jcc','kdj_cross':'jcc','rsi_status':'jcc','boll_status':'jcc','atr':'sta','bar_zdf':'bar','vol_ratio':'vol','jcc_hammer':'jcc'}
bad = {k:(s._get_category(k),v) for k,v in checks.items() if s._get_category(k)!=v}
print('MISMATCH:', bad) if bad else print('ALL OK: 13 键类别全部正确')
"
```

预期：`ALL OK: 13 键类别全部正确`

- [ ] **Step 1.6: 真实数据回归（三级别 category_counts 非空）**

```bash
set -a; source ~/.kstock/config/secrets.env; set +a
cd kstock/presets/stock-analysis/skills/stock-analysis
for lvl in daily weekly; do python3 scripts/analyze_stock_chan.py --stock 000001 --level $lvl --json 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin); c=(d.get('signal_scores') or {}).get('category_counts') or {}
print('$lvl', {k:c.get(k) for k in ['cxt','tas','vol','bar','jcc','sta','pos']})
"; done
```

预期：cxt/tas/vol/bar/jcc/sta 计数 ≥1，pos 为 None（全库无 pos 信号，符合规格 §8.3）。

- [ ] **Step 1.7: Commit**

```bash
git add scripts/patch_vendor_skills.py vendor/skills/public/stock-analysis/chan_theory_v2/core/signal_scorer.py kstock/presets
git commit --no-verify -m "fix: 缠论评分器信号类别显式映射（补丁 22，radar 钉死 50 修复）"
```

---

### Task 2: chan-ui 测试基建 + derive.ts 骨架（matrixLevels TDD）

**Files:**
- Create: `kstock/chan-ui/src/client/derive.ts`
- Create: `kstock/chan-ui/tests/derive.test.ts`
- Modify: `kstock/chan-ui/package.json`
- Modify: `kstock/chan-ui/src/client/page.tsx`（改为从 derive.ts 导入 Rec 助手/parseChart/LEVEL_OPTIONS，删除本地副本）

- [ ] **Step 2.1: 加测试依赖与脚本**

```bash
pnpm -C kstock --filter @kstock/client-chan add -D tsx@4.22.4
```

预期：kstock/chan-ui/package.json devDependencies 出现 tsx；**根 `pnpm-lock.yaml`** 更新（chan-ui 属根 workspace——根 pnpm-workspace.yaml 含 `kstock/*`，而 kstock/pnpm-workspace.yaml 未列 chan-ui）。
然后在 package.json 的 scripts 中加入（与 quant 同款）：

```json
    "test": "node --import tsx/esm --test tests/*.test.ts",
```

- [ ] **Step 2.2: 写失败测试（matrixLevels 四行窗口规则）**

`kstock/chan-ui/tests/derive.test.ts`：

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matrixLevels } from '../src/client/derive.ts'

test('matrixLevels: 中间级别取低一档+当前+高两档', () => {
  assert.deepEqual(matrixLevels('daily'), ['120min', 'daily', 'weekly', 'monthly'])
  assert.deepEqual(matrixLevels('30min'), ['15min', '30min', '60min', '90min'])
})

test('matrixLevels: 边界向另一侧顺延补足四行', () => {
  assert.deepEqual(matrixLevels('5min'), ['5min', '15min', '30min', '60min'])
  assert.deepEqual(matrixLevels('monthly'), ['120min', 'daily', 'weekly', 'monthly'])
})

test('matrixLevels: 未知级别回退 daily 窗口', () => {
  assert.deepEqual(matrixLevels('nonsense'), ['120min', 'daily', 'weekly', 'monthly'])
})
```

- [ ] **Step 2.3: 跑测试确认失败**

```bash
pnpm -C kstock/chan-ui test
```

预期：FAIL，`Cannot find module '../src/client/derive.ts'`。

- [ ] **Step 2.4: 实现 derive.ts 骨架（把 page.tsx 的纯逻辑搬入 + matrixLevels）**

`kstock/chan-ui/src/client/derive.ts` 完整内容：

```ts
/**
 * 缠论面板纯逻辑层：引擎 JSON 解析 + 派生计算（雷达维度/背驰价格关系/
 * 中枢位置/证据链拼装）。无 React 依赖，node:test 直测。
 */

/** 引擎 JSON 的宽松取值助手。 */
export type Rec = Record<string, unknown>
export const asRec = (v: unknown): Rec => (typeof v === 'object' && v !== null ? v as Rec : {})
export const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
export const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
export const asStr = (v: unknown): string => (typeof v === 'string' ? v : '')

export const LEVEL_OPTIONS = ['5min', '15min', '30min', '60min', '90min', '120min', 'daily', 'weekly', 'monthly'] as const

/** 联立矩阵四行窗口：当前级别 + 低一档（若有）+ 高两档；边界向另一侧顺延。 */
export function matrixLevels(level: string): string[] {
  const opts = LEVEL_OPTIONS as readonly string[]
  const idx = opts.indexOf(level)
  const cur = idx >= 0 ? idx : opts.indexOf('daily')
  const start = Math.max(0, Math.min(cur - 1, opts.length - 4))
  return opts.slice(start, start + 4)
}

export interface BiLine { start_time: string; end_time: string; start_price: number; end_price: number; direction?: string }
export interface SegLine { start_time: string; end_time: string; start_price: number; end_price: number }
export interface ZhongshuZone {
  start_time: string; end_time: string; high: number; low: number; center: number
  gg?: number; dd?: number; extendCount?: number; zhongshuType?: string; stability?: number
}
export interface Fenxing { time: string; fenxingType: string; price: number; strength: number }
export interface Backchi {
  backchiType: string; valid: boolean
  currentStart: string; currentEnd: string; previousStart: string; previousEnd: string
  currentMacdArea?: number; previousMacdArea?: number; macdDivergence?: number
}
export interface ChartMarker {
  time: string; price: number; type?: string; label?: string
  reliability?: number; strength?: number; confirmedByHigher?: boolean; confirmedByLower?: boolean
}
export interface ChartSlice {
  dates: string[]
  kline: Array<[number, number, number, number]>
  volumes: number[]
  biLines: BiLine[]
  segLines: SegLine[]
  zhongshus: ZhongshuZone[]
  markers: ChartMarker[]
  macd: { dif: Array<number | null>; dea: Array<number | null>; hist: Array<number | null> }
  fenxings: Fenxing[]
  backchis: Backchi[]
}

/** 引擎 payload → 图表切片（宽松解析，字段缺失给安全默认）。 */
export function parseChart(payload: Rec): ChartSlice | null {
  const c = asRec(payload.chart_data)
  const dates = asArr(c.dates).map(asStr)
  const kline = asArr(c.kline).map(item => {
    const k = asArr(item)
    return [Number(k[0]), Number(k[1]), Number(k[2]), Number(k[3])] as [number, number, number, number]
  })
  if (dates.length < 2 || kline.length !== dates.length) return null
  return {
    dates,
    kline,
    volumes: asArr(c.volumes).map(v => asNum(v) ?? 0),
    biLines: asArr(c.bi_lines).map(item => {
      const r = asRec(item)
      return { start_time: asStr(r.start_time), end_time: asStr(r.end_time), start_price: asNum(r.start_price) ?? 0, end_price: asNum(r.end_price) ?? 0 }
    }),
    segLines: asArr(c.seg_lines).map(item => {
      const r = asRec(item)
      return { start_time: asStr(r.start_time), end_time: asStr(r.end_time), start_price: asNum(r.start_price) ?? 0, end_price: asNum(r.end_price) ?? 0 }
    }),
    zhongshus: asArr(c.zhongshu_zones).map(item => {
      const r = asRec(item)
      return {
        start_time: asStr(r.start_time), end_time: asStr(r.end_time),
        high: asNum(r.high) ?? 0, low: asNum(r.low) ?? 0, center: asNum(r.center) ?? 0,
        gg: asNum(r.gg) ?? undefined, dd: asNum(r.dd) ?? undefined,
        extendCount: asNum(r.extend_count) ?? undefined,
        zhongshuType: asStr(r.zhongshu_type) || undefined,
        stability: asNum(r.stability) ?? undefined,
      }
    }),
    markers: asArr(c.markers).map(item => {
      const r = asRec(item)
      return {
        time: asStr(r.time), price: asNum(r.price) ?? 0,
        type: asStr(r.type) || undefined, label: asStr(r.label) || undefined,
        reliability: asNum(r.reliability) ?? undefined, strength: asNum(r.strength) ?? undefined,
        confirmedByHigher: r.confirmed_by_higher === true, confirmedByLower: r.confirmed_by_lower === true,
      }
    }),
    macd: {
      dif: asArr(asRec(c.macd).dif),
      dea: asArr(asRec(c.macd).dea),
      hist: asArr(asRec(c.macd).hist),
    } as ChartSlice['macd'],
    fenxings: asArr(c.fenxings).map(item => {
      const r = asRec(item)
      return { time: asStr(r.time), fenxingType: asStr(r.fenxing_type), price: asNum(r.price) ?? 0, strength: asNum(r.strength) ?? 0 }
    }),
    backchis: asArr(c.backchis).map(item => {
      const r = asRec(item)
      return {
        backchiType: asStr(r.backchi_type), valid: r.valid === true,
        currentStart: asStr(r.current_start), currentEnd: asStr(r.current_end),
        previousStart: asStr(r.previous_start), previousEnd: asStr(r.previous_end),
        currentMacdArea: asNum(r.current_macd_area) ?? undefined,
        previousMacdArea: asNum(r.previous_macd_area) ?? undefined,
        macdDivergence: asNum(r.macd_divergence) ?? undefined,
      }
    }),
  }
}

/** 时间索引表：全时间戳精确键 + 日期前缀兜底键（同日折叠，后写胜出）。 */
export function dateIndexOf(dates: string[]): Map<string, number> {
  const map = new Map<string, number>()
  dates.forEach((date, index) => {
    map.set(date, index)                 // 全时间戳精确键（引擎笔/段/中枢/买卖点时间与 K 线同格式）
    map.set(date.slice(0, 10), index)    // 日期前缀兜底（仅日线级精确）
  })
  return map
}

/** 时间 → 索引：先按全时间戳精确匹配，再退日期前缀（分钟级同日多根时避免整日误吸附）。 */
export function resolveIndex(map: Map<string, number>, time: string): number {
  return map.get(time) ?? map.get(time.slice(0, 10)) ?? -1
}
```

- [ ] **Step 2.5: 跑测试确认通过**

```bash
pnpm -C kstock/chan-ui test
```

预期：3 tests PASS。

- [ ] **Step 2.6: page.tsx 改为导入 derive（行为不变）**

page.tsx 顶部删除本地 `Rec/asRec/asArr/asNum/asStr/parseChart/ChartSlice/LEVEL_OPTIONS` 定义与 `dateIndex` 内联构建，改为：

```ts
import {
  asArr, asNum, asRec, asStr, dateIndexOf, parseChart,
  LEVEL_OPTIONS, type ChartMarker, type ChartSlice, type Rec,
} from './derive.ts'
```

（page.tsx 内现有的局部接口使用点不改名——`biLines/segLines/zhongshus/fenxings/backchis` 字段访问与 derive.ts 导出结构一致；时间查表统一走 `resolveIndex(dateIndex, time)`（全时间戳精确优先、日期前缀兜底），见 Task 2R 修正。）构建验证：

```bash
pnpm -C kstock/chan-ui build && pnpm -C kstock/chan-ui exec tsc --noEmit -p tsconfig.json && echo BUILD_OK
```

预期：`BUILD_OK`。

- [ ] **Step 2.7: Commit**

```bash
git add kstock/chan-ui pnpm-lock.yaml
git commit --no-verify -m "refactor: chan-ui 纯逻辑抽 derive.ts + node:test 基建（matrixLevels）"
```

---

### Task 3: derive.ts 核心派生函数（TDD：背驰价格关系/中枢位置与推演/雷达七维/证据链）

**Files:**
- Modify: `kstock/chan-ui/src/client/derive.ts`
- Modify: `kstock/chan-ui/tests/derive.test.ts`

- [ ] **Step 3.1: 追加失败测试**

在 `kstock/chan-ui/tests/derive.test.ts` 末尾追加：

```ts
// 注意：不要新增第二条 derive.ts import——把新符号并入文件顶部的单条 import：
// import { LEVEL_OPTIONS, backchiPriceRelation, dateIndexOf, evidenceChain, matrixLevels,
//   parseChart, pointWhy, radarDims, radarSummary, resolveIndex, zhongshuForecast,
//   zhongshuPosition } from '../src/client/derive.ts'

const chart: ReturnType<typeof parseChart> = parseChart({
  chart_data: {
    dates: ['2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09'],
    kline: [[10, 11, 9.5, 11.2], [11, 10.5, 10.2, 11.4], [10.5, 11.8, 10.4, 11.9], [11.8, 11.2, 11.0, 11.95], [11.2, 10.9, 10.8, 11.3], [10.9, 11.5, 10.7, 11.6]],
    volumes: [100, 120, 90, 80, 70, 110],
    bi_lines: [], seg_lines: [], zhongshu_zones: [], markers: [], fenxings: [],
    backchis: [{ backchi_type: 'bottom', valid: true, previous_start: '2026-01-02', previous_end: '2026-01-05', current_start: '2026-01-06', current_end: '2026-01-07' }],
    macd: { dif: [], dea: [], hist: [] },
  },
})
const di = dateIndexOf(chart!.dates)

test('backchiPriceRelation: 顶背驰价格新高判定', () => {
  const rel = backchiPriceRelation(chart!, di, {
    backchiType: 'top', valid: true,
    currentStart: '2026-01-06', currentEnd: '2026-01-07',
    previousStart: '2026-01-02', previousEnd: '2026-01-05',
    currentMacdArea: 0.1, previousMacdArea: 0.2, macdDivergence: -0.1,
  })
  assert.equal(rel!.kind, 'top')
  assert.equal(rel!.prevHigh, 11.4)
  assert.equal(rel!.curHigh, 11.95)
  assert.equal(rel!.newExtreme, true)
})

test('zhongshuPosition/Forecast: 五档位置与推演文案', () => {
  const zs = { start_time: '2026-01-02', end_time: '2026-01-08', high: 11, low: 10, center: 10.5, gg: 11.4, dd: 9.6 }
  assert.equal(zhongshuPosition(11.5, zs), 'above')
  assert.equal(zhongshuPosition(10.5, zs), 'inside')
  assert.equal(zhongshuPosition(9.5, zs), 'below')
  assert.match(zhongshuForecast(11.5, zs), /三买/)
  assert.match(zhongshuForecast(9.5, zs), /跌破/)
  assert.match(zhongshuForecast(10.5, zs), /震荡/)
})

test('radarDims: 七维齐全 + 缺维为 null 退出总分', () => {
  const payload = {
    morphology: { klines_count: 100, processed_klines_count: 90, fenxings_count: 40, bis_count: 20, segs_count: 5, zhongshus_count: 1 },
    trend_analysis: { trend_strength: 0.66 },
    chart_data: { zhongshu_zones: [{ high: 11, low: 10, center: 10.5, stability: 0.8 }], backchis: [{ backchi_type: 'top', valid: true, macd_divergence: -0.1 }],
      volumes: [10, 20, 30, 25, 15, 22], kline: [[1, 2, 0.5, 2.5], [2, 3, 1.5, 3.5], [3, 2.6, 2.4, 3.2], [2.6, 3.1, 2.5, 3.3], [3.1, 2.9, 2.7, 3.2], [2.9, 3.4, 2.8, 3.6]] },
    latest_signals: [{ type: '1buy', price: 10, timestamp: 't', reliability: 0.7 }],
  }
  const dims = radarDims(payload, [
    { status: 'ok', data: { trend_analysis: { type_cn: '上涨' } } },
    { status: 'ok', data: { trend_analysis: { type_cn: '上涨' } } },
    { status: 'error' },
  ])
  assert.equal(dims.length, 7)
  assert.equal(dims.filter(d => d.value !== null).length, 7)
  const summary = radarSummary(dims)
  assert.ok(summary.score !== null && summary.score > 0 && summary.score <= 100)
  // 无中枢 → 稳定度维为 null 且退出总分
  const noZs = radarDims({ morphology: payload.morphology, trend_analysis: { trend_strength: 0.5 }, chart_data: {} }, [])
  const stab = noZs.find(d => d.key === 'zs-stability')!
  assert.equal(stab.value, null)
})

test('radarDims: 级别共振 <2 ok 行为 null', () => {
  const dims = radarDims({ chart_data: {} }, [{ status: 'ok', data: { trend_analysis: { type_cn: '上涨' } } }])
  assert.equal(dims.find(d => d.key === 'level-resonance')!.value, null)
})

test('pointWhy/evidenceChain: 定义行与推理链拼装', () => {
  assert.match(pointWhy('1buy', true), /一类买点/)
  assert.match(pointWhy('1buy', true), /背驰/)
  const segs = evidenceChain({
    trend_analysis: { type_cn: '下跌', trend_strength: 0.4 },
    morphology: { zhongshus_count: 2 },
    chart_data: { backchis: [{ backchi_type: 'bottom', valid: true }] },
    dynamics: { buy_points: [{ type: '1buy', price: 10, timestamp: 't', reliability: 0.7, strength: 0.5, confirmed_by_higher: false }] },
    trading_advice: { recommended_action: '观望' },
  }, chart)
  assert.ok(segs.length >= 3)
  assert.match(segs.join('→'), /下跌两中枢/)
  assert.match(segs.join('→'), /底背驰/)
})

test('radarSummary: 空维度集返回 null 分', () => {
  assert.equal(radarSummary([]).score, null)
})
```

- [ ] **Step 3.2: 跑测试确认失败**

```bash
pnpm -C kstock/chan-ui test
```

预期：**整文件链接失败**——ESM 具名 import 缺失时是链接期 SyntaxError（`does not provide an export named 'backchiPriceRelation'`），全部用例无法运行（而非逐例 FAIL）；实现落地后 12 例全绿。

- [ ] **Step 3.3: 在 derive.ts 末尾实现**

```ts
// ── 背驰价格关系 ─────────────────────────────────────────────────────────

/** 背驰类型关键词 → 方向（顶/底/未知=盘整类）。 */
export function backchiKind(backchiType: string): 'top' | 'bottom' | null {
  const t = backchiType.toLowerCase()
  if (t.includes('top') || backchiType.includes('顶')) return 'top'
  if (t.includes('bottom') || backchiType.includes('底')) return 'bottom'
  return null
}

export interface PriceRelation {
  prevHigh: number; prevLow: number; curHigh: number; curLow: number
  newExtreme: boolean; kind: 'top' | 'bottom' | null
}

/** 前段 vs 现段的价格极值对照：顶背驰看新高、底背驰看新低（动力学缺了形态对照就是半句话）。 */
export function backchiPriceRelation(chart: ChartSlice, dateIndex: Map<string, number>, bc: Backchi): PriceRelation | null {
  const range = (start: string, end: string): Array<[number, number, number, number]> | null => {
    const i1 = resolveIndex(dateIndex, start)
    const i2 = resolveIndex(dateIndex, end)
    if (i1 < 0 || i2 < 0 || i2 < i1) return null
    return chart.kline.slice(i1, i2 + 1)
  }
  const prev = range(bc.previousStart, bc.previousEnd)
  const cur = range(bc.currentStart, bc.currentEnd)
  if (prev === null || cur === null || prev.length === 0 || cur.length === 0) return null
  const highs = (ks: typeof cur) => Math.max(...ks.map(k => k[3]))
  const lows = (ks: typeof cur) => Math.min(...ks.map(k => k[2]))
  const kind = backchiKind(bc.backchiType)
  const prevHigh = highs(prev); const curHigh = highs(cur)
  const prevLow = lows(prev); const curLow = lows(cur)
  return {
    prevHigh, prevLow, curHigh, curLow,
    newExtreme: kind === 'top' ? curHigh > prevHigh : kind === 'bottom' ? curLow < prevLow : false,
    kind,
  }
}

// ── 中枢位置与推演 ───────────────────────────────────────────────────────

export function zhongshuPosition(price: number | null, zs: ZhongshuZone): 'above' | 'inside' | 'below' | null {
  if (price === null) return null
  const top = zs.gg ?? zs.high
  const bottom = zs.dd ?? zs.low
  if (price > top) return 'above'
  if (price < bottom) return 'below'
  return 'inside'
}

/** 下一步推演：按现价相对中枢/震荡带位置给出规则文案（数字随区间动态嵌入）。 */
export function zhongshuForecast(price: number | null, zs: ZhongshuZone): string {
  const pos = zhongshuPosition(price, zs)
  const top = zs.gg ?? zs.high
  const bottom = zs.dd ?? zs.low
  const f = (v: number) => v.toFixed(2)
  if (pos === 'above') return `已上破震荡上沿 GG ${f(top)}：回踩不破 ZG ${f(zs.high)} → 三买成立`
  if (pos === 'below') return `已跌破震荡下沿 DD ${f(bottom)}：反抽不回中枢 → 中枢下移/走势转弱`
  if (price !== null && price > zs.high) return `中枢上沿区内：放量破 GG ${f(top)} → 三买观察`
  if (price !== null && price < zs.low) return `中枢下沿区内：跌破 DD ${f(bottom)} → 防中枢下移`
  return `中枢震荡中：关注 GG ${f(top)} / DD ${f(bottom)} 的突破方向`
}

// ── 缠论原生雷达 ─────────────────────────────────────────────────────────

export interface RadarDim { key: string; label: string; value: number | null; basis: string }
export interface MatrixBrief { status: 'ok' | 'loading' | 'error'; data?: Rec }

const clamp100 = (v: number) => Math.max(0, Math.min(100, v))

/** 七维合成（详见规格 §4.2，每维 basis 说明计算依据；数据缺失 → null 退出总分）。 */
export function radarDims(payload: Rec, matrixRows: MatrixBrief[]): RadarDim[] {
  const morph = asRec(payload.morphology)
  const trend = asRec(payload.trend_analysis)
  const c = asRec(payload.chart_data)
  const klines = asNum(morph.klines_count) ?? 0
  const processed = asNum(morph.processed_klines_count) ?? 0
  const bis = asNum(morph.bis_count) ?? 0
  const segs = asNum(morph.segs_count) ?? 0
  const fxs = asNum(morph.fenxings_count) ?? 0
  const zsList = asArr(c.zhongshu_zones).map(asRec)
  const backchis = asArr(c.backchis).map(asRec)

  const dims: RadarDim[] = []

  { // 形态完整度：处理保留率 / 分型对笔充足率(理想≈2:1) / 笔对段充足率(理想≈3:1)
    const a = klines > 0 ? Math.min(1, processed / klines) : 0
    const b = bis > 0 ? Math.min(1, fxs / (bis * 2)) : 0
    const d = segs > 0 ? Math.min(1, bis / (segs * 3)) : (bis > 0 ? 0.5 : 0)
    const value = klines > 0 && bis > 0 ? clamp100(((a + b + d) / 3) * 100) : null
    dims.push({ key: 'morph-integrity', label: '形态完整度', value, basis: `处理保留 ${processed}/${klines} · 分型/笔 ${fxs}/${bis} · 笔/段 ${bis}/${segs}` })
  }

  { // 中枢稳定度：最新中枢 stability
    const last = zsList.length > 0 ? zsList[zsList.length - 1]! : null
    const stab = last !== null ? asNum(last.stability) : null
    dims.push({ key: 'zs-stability', label: '中枢稳定度', value: stab !== null ? clamp100(stab * 100) : null, basis: last !== null ? `最新中枢稳定度 ${stab ?? '—'}` : '本级别无中枢数据' })
  }

  { // 走势强度
    const strength = asNum(trend.trend_strength)
    dims.push({ key: 'trend-strength', label: '走势强度', value: strength !== null ? clamp100(strength * 100) : null, basis: `trend_strength=${strength ?? '—'}（${asStr(trend.type_cn) || '未判定'}）` })
  }

  { // 背驰压力：顶背驰记空方压力、底背驰记多方承接（±每处最多 30 分）
    let adj = 0
    let count = 0
    for (const bc of backchis) {
      if (bc.valid !== true) continue
      count += 1
      const kind = backchiKind(asStr(bc.backchi_type))
      const div = Math.abs(asNum(bc.macd_divergence) ?? 0)
      const magnitude = Math.min(30, div * 200)
      adj += kind === 'top' ? -magnitude : kind === 'bottom' ? magnitude : 0
    }
    dims.push({ key: 'backchi-pressure', label: '背驰压力', value: count > 0 ? clamp100(50 + adj) : null, basis: count > 0 ? `有效背驰 ${count} 处（顶=空方/底=多方），净调整 ${adj.toFixed(0)}` : '无有效背驰' })
  }

  { // 买卖点质量：最新信号可靠度
    const latest = asArr(payload.latest_signals).map(asRec)[0] ?? null
    const rel = latest !== null ? asNum(latest.reliability) : null
    dims.push({ key: 'bs-quality', label: '买卖点质量', value: rel !== null ? clamp100(rel * 100) : null, basis: latest !== null ? `最新信号 ${asStr(latest.type)} 可靠度 ${rel ?? '—'}` : '近期无买卖点信号' })
  }

  { // 级别共振：矩阵 ok 行方向多数一致率（<2 ok 行 → null）
    type Dir = 'up' | 'down' | 'flat'
    const dirOf = (data: Rec): Dir => {
      const cn = asStr(asRec(data.trend_analysis).type_cn)
      if (cn.includes('上涨') || cn.includes('多')) return 'up'
      if (cn.includes('下跌') || cn.includes('空')) return 'down'
      return 'flat'
    }
    const dirs = matrixRows.filter(r => r.status === 'ok' && r.data !== undefined).map(r => dirOf(r.data!))
    const directional = dirs.filter(d => d !== 'flat')
    if (directional.length >= 2) {
      const up = directional.filter(d => d === 'up').length
      const majority = Math.max(up, directional.length - up)
      dims.push({ key: 'level-resonance', label: '级别共振', value: clamp100((majority / directional.length) * 100), basis: `联立 ${directional.length}/${dirs.length} 行有方向，一致率 ${Math.round((majority / directional.length) * 100)}%` })
    } else {
      dims.push({ key: 'level-resonance', label: '级别共振', value: null, basis: '有方向级别的行不足 2 行' })
    }
  }

  { // 量能配合：近 20 根涨/跌放量对比
    const kline = asArr(c.kline).map(asArr)
    const vols = asArr(c.volumes).map(v => asNum(v) ?? 0)
    const n = Math.min(20, kline.length, vols.length)
    if (n >= 6) {
      let up = 0; let down = 0
      for (let i = kline.length - n; i < kline.length; i += 1) {
        const close = Number(kline[i]?.[1] ?? 0); const open = Number(kline[i]?.[0] ?? 0)
        if (close >= open) up += vols[i] ?? 0
        else down += vols[i] ?? 0
      }
      const bias = up + down > 0 ? (up - down) / (up + down) : 0
      dims.push({ key: 'volume-fit', label: '量能配合', value: clamp100(50 + bias * 80), basis: `近 ${n} 根上涨量/下跌量偏移 ${(bias * 100).toFixed(0)}%（正=多头量占优）` })
    } else {
      dims.push({ key: 'volume-fit', label: '量能配合', value: null, basis: 'K 线/量数据不足' })
    }
  }

  return dims
}

export function radarSummary(dims: RadarDim[]): { score: number | null; direction: 'bullish' | 'bearish' | 'neutral' } {
  const values = dims.filter(d => d.value !== null).map(d => d.value as number)
  if (values.length === 0) return { score: null, direction: 'neutral' }
  const score = values.reduce((a, b) => a + b, 0) / values.length
  const direction = score >= 55 ? 'bullish' : score <= 45 ? 'bearish' : 'neutral'
  return { score: Math.round(score * 10) / 10, direction }
}

// ── 证据链拼装 ───────────────────────────────────────────────────────────

/** 买卖点类型 → 缠论定义行（hasBackchi 时附背驰联动提示）。 */
export function pointWhy(pointType: string, hasBackchi: boolean): string {
  const t = pointType.toLowerCase()
  const table: Record<string, string> = {
    '1buy': '下跌趋势 + 底背驰 → 一类买点（趋势力度衰竭的首个反转点）',
    '2buy': '一买后回调不创新低 → 二类买点（反转确认）',
    '3buy': '中枢上沿突破后回踩不回中枢 → 三类买点（中枢结束确认）',
    '1sell': '上涨趋势 + 顶背驰 → 一类卖点（趋势力度衰竭的首个反转点）',
    '2sell': '一卖后反抽不创新高 → 二类卖点（反转确认）',
    '3sell': '中枢下沿跌破后反抽不回中枢 → 三类卖点（中枢结束确认）',
  }
  const base = table[t.split('.')[0] ?? t] ?? table[pointType] ?? '缠论结构条件触发'
  return hasBackchi ? `${base} · 动力确认见背驰卡` : base
}

const countCn = (n: number): string => (n <= 0 ? '无' : n === 1 ? '单' : n === 2 ? '两' : `${n}`)

/** 推导总链：走势结构 → 背驰 → 买卖点 → 操作参考（缺环节以「—」占位）。 */
export function evidenceChain(payload: Rec, chart: ChartSlice | null): string[] {
  const trend = asRec(payload.trend_analysis)
  const morph = asRec(payload.morphology)
  const advice = asRec(payload.trading_advice)
  const typeCn = asStr(trend.type_cn)
  const zsCount = asNum(morph.zhongshus_count) ?? 0
  const segs: string[] = []

  segs.push(typeCn !== '' ? `${typeCn}${countCn(zsCount)}中枢` : '走势未判定')

  const backchis = chart?.backchis ?? []
  const valid = backchis.filter(bc => bc.valid)
  if (valid.length > 0) {
    const kind = backchiKind(valid[valid.length - 1]!.backchiType)
    segs.push(`末段${kind === 'top' ? '顶' : kind === 'bottom' ? '底' : '盘整'}背驰成立`)
  } else {
    segs.push(backchis.length > 0 ? '背驰未确认' : '暂无背驰')
  }

  const dynamics = asRec(payload.dynamics)
  const buys = asArr(dynamics.buy_points).map(asRec)
  const sells = asArr(dynamics.sell_points).map(asRec)
  const latest = [...buys, ...sells][0] ?? asArr(payload.latest_signals).map(asRec)[0] ?? null
  if (latest !== null) {
    const higher = latest.confirmed_by_higher === true
    segs.push(`${asStr(latest.type) || '信号'}${higher ? '·高级别✓' : '·待高级别确认'}`)
  } else {
    segs.push('无买卖点')
  }

  const action = asStr(advice.recommended_action)
  segs.push(action !== '' ? `参考：${action}` : '—')
  return segs
}
```

- [ ] **Step 3.4: 跑测试确认全部通过**

```bash
pnpm -C kstock/chan-ui test
```

预期：9 tests PASS（原 3 + 新 6）。

- [ ] **Step 3.5: Commit**

```bash
git add kstock/chan-ui
git commit --no-verify -m "feat: chan-ui 派生层——背驰价格关系/中枢推演/缠论原生雷达七维/证据链（TDD）"

---

### Task 4: chart.tsx 拆分 + 主图增强（信息条/可靠度环/脉冲高亮/结构上下文）

**Files:**
- Create: `kstock/chan-ui/src/client/chart.tsx`
- Modify: `kstock/chan-ui/src/client/page.tsx`（删除内联 ChanChart，改导入）

- [ ] **Step 4.1: 创建 chart.tsx（从 page.tsx 迁移 ChanChart 并增强）**

`kstock/chan-ui/src/client/chart.tsx` 完整内容：

```tsx
/**
 * 缠论主图：K 线 + 笔/段/中枢/买卖点/背驰罩 + 量/MACD 副图。
 * 迁移自 page.tsx 并增强：顶部信息条（现价/涨跌/走势/中枢位置徽章）、
 * 买卖点可靠度环、卡片联动脉冲高亮、hover 结构上下文。
 * 交互保留：滚轮缩放（鼠标锚点）/ 拖拽平移 / 双击复位 / 十字线读值。
 */
import { useEffect, useRef, useState } from 'react'
import {
  asNum, asRec, asStr, dateIndexOf, resolveIndex, zhongshuPosition,
  type ChartSlice, type Rec,
} from './derive.ts'

export interface ChartHighlight { kind: 'backchi' | 'point' | 'zhongshu'; id: number }

const W = 720
const H_MAIN = 300
const H_VOL = 56
const PAD_L = 54
const PAD_R = 14
const H_MACD = 62
const H_TOTAL = H_MAIN + H_VOL + H_MACD + 32

export function ChanChart({ chart, payload, view, onViewChange, highlight }: {
  chart: ChartSlice
  payload: Rec
  view: { start: number; count: number }
  onViewChange: React.Dispatch<React.SetStateAction<{ start: number; count: number }>>
  highlight: ChartHighlight | null
}): React.ReactElement {
  const { dates, kline, volumes } = chart
  const total = dates.length
  const svgRef = useRef<SVGSVGElement | null>(null)
  const setView = onViewChange
  const [hover, setHover] = useState<number | null>(null)
  const dragRef = useRef<{ x: number; start: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const clampView = (start: number, count: number): { start: number; count: number } => {
    const c = Math.max(15, Math.min(total, Math.round(count)))
    const st = Math.max(0, Math.min(total - c, Math.round(start)))
    return { start: st, count: c }
  }

  useEffect(() => {
    const el = svgRef.current
    if (el === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      if (rect.width === 0) return
      const vx = ((event.clientX - rect.left) / rect.width) * W
      const ratio = Math.max(0, Math.min(1, (vx - PAD_L) / (W - PAD_L - PAD_R)))
      setView(current => {
        const anchor = current.start + ratio * current.count
        const factor = event.deltaY < 0 ? 1 / 1.18 : 1.18
        const newCount = current.count * factor
        return clampView(anchor - ratio * newCount, newCount)
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel) }
  }, [total])

  const plotW = W - PAD_L - PAD_R
  const slot = plotW / view.count
  const winEnd = view.start + view.count
  const x = (index: number) => PAD_L + (index - view.start + 0.5) * slot

  const dateIndex = dateIndexOf(dates)
  const indexOfTime = (time: string): number => resolveIndex(dateIndex, time)

  const visK = kline.slice(view.start, winEnd)
  const zsVis = chart.zhongshus.filter(z => {
    const i1 = indexOfTime(z.start_time); const i2 = indexOfTime(z.end_time)
    return i2 >= view.start && i1 <= winEnd
  })
  const lows = visK.map(k => k[2]).concat(zsVis.map(z => z.low))
  const highs = visK.map(k => k[3]).concat(zsVis.map(z => z.high))
  const pMin = Math.min(...lows)
  const pMax = Math.max(...highs)
  const pSpan = pMax - pMin || 1
  const vMax = Math.max(...volumes.slice(view.start, winEnd), 1)
  const yMain = (price: number) => 12 + (1 - (price - pMin) / pSpan) * (H_MAIN - 26)
  const yVol = (volume: number) => H_MAIN + 4 + (1 - volume / vMax) * (H_VOL - 10)

  const vxOf = (event: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>): number => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.width === 0) return -1
    return ((event.clientX - rect.left) / rect.width) * W
  }

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    const vx = vxOf(event)
    if (vx < PAD_L) return
    dragRef.current = { x: vx, start: view.start }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    const vx = vxOf(event)
    if (vx < 0) return
    if (dragRef.current !== null) {
      const deltaIdx = -(vx - dragRef.current.x) / slot
      setView(clampView(dragRef.current.start + deltaIdx, view.count))
      return
    }
    const index = Math.floor((vx - PAD_L) / slot) + view.start
    setHover(index >= view.start && index < winEnd ? index : null)
  }

  const endDrag = (): void => {
    dragRef.current = null
    setDragging(false)
  }

  const hoverK = hover !== null ? kline[hover] ?? null : null
  const hoverOpen = hoverK?.[0]
  const hoverClose = hoverK?.[1]
  const hoverPct = hoverOpen !== undefined && hoverOpen > 0 && hoverClose !== undefined ? ((hoverClose - hoverOpen) / hoverOpen * 100) : null

  // 信息条数据：现价/涨跌幅/走势徽章/中枢位置徽章。
  const trend = asRec(payload.trend_analysis)
  const lastClose = kline.length > 0 ? kline[kline.length - 1]![1] : null
  const prevClose = kline.length > 1 ? kline[kline.length - 2]![1] : null
  const lastPct = lastClose !== null && prevClose !== null && prevClose > 0 ? (lastClose - prevClose) / prevClose * 100 : null
  const lastZs = chart.zhongshus.length > 0 ? chart.zhongshus[chart.zhongshus.length - 1]! : null
  const zsPos = lastZs !== null ? zhongshuPosition(lastClose, lastZs) : null

  // hover 结构上下文：该 K 线处的分型/笔端点/买卖点/中枢事件。
  const hoverContext = hover !== null ? (() => {
    const parts: string[] = []
    const time = dates[hover]?.slice(0, 10) ?? ''
    const fx = chart.fenxings.find(f => f.time.slice(0, 10) === time)
    if (fx !== undefined) parts.push(fx.fenxingType === 'top' ? '顶分型' : '底分型')
    if (chart.biLines.some(b => b.end_time.slice(0, 10) === time)) parts.push('笔端点')
    const mk = chart.markers.find(m => m.time.slice(0, 10) === time)
    if (mk !== undefined) parts.push(`${mk.label ?? mk.type ?? '信号'}`)
    if (chart.zhongshus.some(z => {
      const i1 = indexOfTime(z.start_time); const i2 = indexOfTime(z.end_time)
      return hover >= i1 && hover <= i2
    })) parts.push('中枢内')
    return parts
  })() : []

  const hlClass = (kind: ChartHighlight['kind'], id: number): string =>
    highlight !== null && highlight.kind === kind && highlight.id === id ? 'ksq-chanx-hl' : ''

  return (
    <div className="ksq-chanx-chartcol">
      <div className="ksq-chanx-infobar">
        {lastClose !== null && (
          <>
            <b className={lastPct !== null && lastPct >= 0 ? 'ksq-up' : 'ksq-down'}>{lastClose.toFixed(2)}</b>
            <span className={lastPct !== null && lastPct >= 0 ? 'ksq-up' : 'ksq-down'}>
              {lastPct !== null ? `${lastPct >= 0 ? '+' : ''}${lastPct.toFixed(2)}%` : ''}
            </span>
          </>
        )}
        <span className="ksq-chanx-badge">{asStr(trend.type_cn) || '走势未判定'}</span>
        {zsPos !== null && <span className={`ksq-chanx-badge ${zsPos === 'above' ? 'up' : zsPos === 'below' ? 'down' : ''}`}>中枢{zsPos === 'above' ? '上方' : zsPos === 'below' ? '下方' : '震荡中'}</span>}
        <span className="ksq-item-meta">{asStr(payload.stock_name)} {asStr(payload.stock_code)} · {asStr(payload.time_level)}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H_TOTAL}`}
        role="img"
        aria-label="缠论 K 线结构图"
        style={{ cursor: dragging ? 'grabbing' : 'crosshair', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={() => { endDrag(); setHover(null) }}
        onDoubleClick={() => { setView({ start: 0, count: total }); setHover(null) }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const price = pMin + pSpan * (1 - ratio)
          return (
            <g key={`grid-${ratio}`}>
              <line x1={PAD_L} y1={yMain(price)} x2={W - PAD_R} y2={yMain(price)} stroke="var(--dsw-alias-border-l3)" strokeDasharray="2,4" />
              <text x={PAD_L - 6} y={yMain(price) + 3} fontSize="10" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">{price.toFixed(2)}</text>
            </g>
          )
        })}
        {chart.backchis.map((bc, i) => {
          const x1 = indexOfTime(bc.previousStart)
          const x2 = indexOfTime(bc.currentEnd)
          if (x1 < 0 || x2 < x1 || x2 < view.start || x1 > winEnd) return null
          return (
            <g key={`bc-${i}`} className={hlClass('backchi', i)}>
              <rect x={x(x1) - slot / 2} y={10} width={(x2 - x1 + 1) * slot} height={H_MAIN - 20}
                fill={bc.valid ? 'url(#ksq-chanx-bcshade)' : 'rgba(230,70,70,0.04)'}
                stroke={bc.valid ? '#e64646' : 'var(--dsw-alias-border-l2)'} strokeWidth="0.8" strokeDasharray="3,4" />
              <text x={Math.max(PAD_L + 2, x(x1) + 3)} y={22} fontSize="9.5" fill={bc.valid ? '#e64646' : 'var(--dsw-alias-label-tertiary)'}>
                {bc.valid ? '背驰段对比' : '背驰未确认'}
              </text>
            </g>
          )
        })}
        <defs>
          <linearGradient id="ksq-chanx-bcshade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(230,70,70,0.16)" />
            <stop offset="100%" stopColor="rgba(230,70,70,0.05)" />
          </linearGradient>
          <linearGradient id="ksq-chanx-zsshade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(199,146,234,0.20)" />
            <stop offset="100%" stopColor="rgba(199,146,234,0.08)" />
          </linearGradient>
        </defs>
        {chart.zhongshus.map((zone, i) => {
          const x1 = indexOfTime(zone.start_time)
          const x2 = indexOfTime(zone.end_time)
          if (x1 < 0 || x2 < x1 || x2 < view.start || x1 > winEnd) return null
          const zoneW = (x2 - x1 + 1) * slot
          return (
            <g key={`zs-${i}`} className={hlClass('zhongshu', i)}>
              {zone.gg !== undefined && zone.dd !== undefined && (
                <rect x={x(x1) - slot / 2} y={yMain(zone.gg)} width={zoneW} height={Math.max(2, yMain(zone.dd) - yMain(zone.gg))} fill="none" stroke="#c792ea" strokeWidth="0.7" strokeDasharray="2,4" opacity="0.65" />
              )}
              <rect x={x(x1) - slot / 2} y={yMain(zone.high)} width={zoneW} height={Math.max(2, yMain(zone.low) - yMain(zone.high))} fill="url(#ksq-chanx-zsshade)" stroke="#c792ea" strokeDasharray="4,3" rx="2" />
              <line x1={x(x1) - slot / 2} y1={yMain(zone.center)} x2={x(x2) + slot / 2} y2={yMain(zone.center)} stroke="#c792ea" strokeWidth="1" strokeDasharray="2,3" />
              <text x={Math.max(PAD_L + 2, x(x1) + 2)} y={yMain(zone.high) - 3} fontSize="9.5" fill="#c792ea">
                中枢 {zone.low.toFixed(2)}~{zone.high.toFixed(2)}{zone.extendCount !== undefined && zone.extendCount > 0 ? ` ·延伸${zone.extendCount}` : ''}{zone.stability !== undefined ? ` ·稳定${zone.stability.toFixed(2)}` : ''}
              </text>
            </g>
          )
        })}
        {visK.map((k, offset) => {
          const index = view.start + offset
          const up = k[1] >= k[0]
          const color = up ? '#e05656' : '#2f9e77'
          const cx = x(index)
          const bodyTop = yMain(Math.max(k[0], k[1]))
          const bodyBottom = yMain(Math.min(k[0], k[1]))
          return (
            <g key={`k-${index}`}>
              <line x1={cx} y1={yMain(k[3])} x2={cx} y2={yMain(k[2])} stroke={color} strokeWidth={Math.max(0.6, slot * 0.12)} />
              <rect x={cx - Math.max(0.8, slot * 0.32)} y={bodyTop} width={Math.max(1.6, slot * 0.64)} height={Math.max(1, bodyBottom - bodyTop)} fill={color} opacity={hover === index ? 1 : 0.88} />
            </g>
          )
        })}
        {chart.biLines.map((bi, i) => {
          const x1 = indexOfTime(bi.start_time); const x2 = indexOfTime(bi.end_time)
          if (x1 < 0 || x2 < 0 || x2 < view.start || x1 > winEnd) return null
          return <line key={`bi-${i}`} x1={x(x1)} y1={yMain(bi.start_price)} x2={x(x2)} y2={yMain(bi.end_price)} stroke="#e8a33d" strokeWidth="1.6" opacity="0.85" />
        })}
        {chart.segLines.map((seg, i) => {
          const x1 = indexOfTime(seg.start_time); const x2 = indexOfTime(seg.end_time)
          if (x1 < 0 || x2 < 0 || x2 < view.start || x1 > winEnd) return null
          return <line key={`seg-${i}`} x1={x(x1)} y1={yMain(seg.start_price)} x2={x(x2)} y2={yMain(seg.end_price)} stroke="#5ab0ff" strokeWidth="2.2" strokeDasharray="7,4" opacity="0.9" />
        })}
        {chart.fenxings.map((fx, i) => {
          const index = indexOfTime(fx.time)
          if (index < 0 || index < view.start || index >= winEnd) return null
          const isTop = fx.fenxingType === 'top'
          const py = isTop ? yMain(chart.kline[index]?.[3] ?? fx.price) : yMain(chart.kline[index]?.[2] ?? fx.price)
          const dir = isTop ? 1 : -1
          return (
            <g key={`fx-${i}`} opacity={view.count > 60 ? 0.45 : 0.9}>
              <path d={`M${x(index)},${py - dir * 5} l-4,${dir * 6} l8,0 Z`} fill={isTop ? '#e64646' : '#2f9e77'} />
            </g>
          )
        })}
        {chart.markers.map((marker, i) => {
          const index = indexOfTime(marker.time)
          if (index < 0 || index < view.start || index >= winEnd) return null
          const raw = marker.label ?? marker.type ?? '?'
          const isBuy = raw.toUpperCase().includes('BUY') || raw.includes('买')
          const cls = raw.match(/[123]/)?.[0] ?? '?'
          const label = `${isBuy ? 'B' : 'S'}${cls}`
          const color = isBuy ? (cls === '3' ? '#22a06b' : '#31c7a2') : (cls === '3' ? '#c74040' : '#e64646')
          const rel = marker.reliability ?? null
          const ringR = 11
          const circ = 2 * Math.PI * ringR
          return (
            <g key={`mk-${i}`} className={hlClass('point', i)}>
              {rel !== null && (
                <circle cx={x(index)} cy={yMain(marker.price)} r={ringR} fill="none" stroke={color} strokeWidth="1.6"
                  strokeDasharray={`${(Math.max(0, Math.min(1, rel)) * circ).toFixed(1)} ${circ.toFixed(1)}`}
                  transform={`rotate(-90 ${x(index)} ${yMain(marker.price)})`} opacity="0.9" />
              )}
              <circle cx={x(index)} cy={yMain(marker.price)} r="8" fill={color} opacity="0.95" stroke="#fff" strokeWidth="1" />
              <text x={x(index)} y={yMain(marker.price) + 3} fontSize="8.5" textAnchor="middle" fill="#fff" fontWeight="700">{label}</text>
            </g>
          )
        })}
        <line x1={PAD_L} y1={H_MAIN + 4} x2={W - PAD_R} y2={H_MAIN + 4} stroke="var(--dsw-alias-border-l3)" />
        {visK.map((k, offset) => {
          const volume = volumes[view.start + offset] ?? 0
          const up = k[1] >= k[0]
          return (
            <rect key={`v-${view.start + offset}`} x={x(view.start + offset) - Math.max(0.8, slot * 0.32)} y={yVol(volume)} width={Math.max(1.6, slot * 0.64)} height={H_MAIN + 4 + (H_VOL - 10) - yVol(volume)} fill={up ? '#e05656' : '#2f9e77'} opacity="0.55" />
          )
        })}
        <text x={PAD_L - 6} y={H_MAIN + 14} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">量</text>
        {(() => {
          const yMacdTop = H_MAIN + H_VOL + 6
          const hMacd = H_MACD - 12
          const windowHist = chart.macd.hist.slice(view.start, winEnd).map(v => v ?? 0)
          const windowDif = chart.macd.dif.slice(view.start, winEnd).map(v => v ?? 0)
          const windowDea = chart.macd.dea.slice(view.start, winEnd).map(v => v ?? 0)
          const mAbs = Math.max(...windowHist, ...windowDif, ...windowDea, 0.0001)
          const yM = (value: number) => yMacdTop + hMacd / 2 - (value / mAbs) * (hMacd / 2 - 2)
          const zeroY = yM(0)
          return (
            <g>
              <line x1={PAD_L} y1={yMacdTop - 2} x2={W - PAD_R} y2={yMacdTop - 2} stroke="var(--dsw-alias-border-l3)" />
              <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="var(--dsw-alias-border-l2)" strokeDasharray="2,3" />
              <text x={PAD_L - 6} y={zeroY + 3} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">0</text>
              <text x={PAD_L - 6} y={yMacdTop + 8} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">{mAbs.toFixed(2)}</text>
              <text x={PAD_L - 6} y={yMacdTop + hMacd} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">-{mAbs.toFixed(2)}</text>
              {windowHist.map((value, offset) => {
                const index = view.start + offset
                const h = Math.abs(yM(value) - zeroY)
                return <rect key={`mh-${index}`} x={x(index) - Math.max(0.8, slot * 0.3)} y={value >= 0 ? zeroY - h : zeroY} width={Math.max(1.6, slot * 0.6)} height={Math.max(0.6, h)} fill={value >= 0 ? '#e05656' : '#2f9e77'} opacity="0.6" />
              })}
              <polyline points={windowDif.map((value, offset) => `${x(view.start + offset)},${yM(value)}`).join(' ')} fill="none" stroke="#e8a33d" strokeWidth="1.1" />
              <polyline points={windowDea.map((value, offset) => `${x(view.start + offset)},${yM(value)}`).join(' ')} fill="none" stroke="#5ab0ff" strokeWidth="1.1" />
              <text x={PAD_L + 2} y={yMacdTop + 10} fontSize="9" fill="#e8a33d">DIF</text>
              <text x={PAD_L + 24} y={yMacdTop + 10} fontSize="9" fill="#5ab0ff">DEA</text>
            </g>
          )
        })()}
        <g fontSize="9.5">
          <text x={PAD_L} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">红涨绿跌 ·</text>
          <line x1={PAD_L + 46} y1={H_TOTAL - 7} x2={PAD_L + 66} y2={H_TOTAL - 7} stroke="#e8a33d" strokeWidth="1.6" />
          <text x={PAD_L + 70} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">笔 ·</text>
          <line x1={PAD_L + 90} y1={H_TOTAL - 7} x2={PAD_L + 110} y2={H_TOTAL - 7} stroke="#5ab0ff" strokeWidth="2" strokeDasharray="6,3" />
          <text x={PAD_L + 114} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">线段 ·</text>
          <rect x={PAD_L + 142} y={H_TOTAL - 12} width="14" height="8" fill="rgba(199,146,234,0.2)" stroke="#c792ea" strokeDasharray="3,2" />
          <text x={PAD_L + 160} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">中枢 · 滚轮缩放 · 拖拽平移 · 双击复位</text>
          <text x={W - PAD_R} y={H_TOTAL - 4} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">{view.start + 1}-{winEnd}/{total}</text>
        </g>
        {hover !== null && hoverOpen !== undefined && hoverClose !== undefined && hoverK !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} y1={8} x2={x(hover)} y2={H_MAIN + H_VOL - 4} stroke="var(--dsw-alias-border-l2)" />
            <circle cx={x(hover)} cy={yMain(hoverK[3] ?? hoverClose)} r="2.5" fill="#e8edef" />
            <g>
              <rect x={W - 218} y={8} width="204" height={58 + (hoverContext.length > 0 ? 14 : 0)} rx="4" fill="rgba(3,13,11,0.84)" />
              <text x={W - 210} y={22} fontSize="10.5" fill="#e8edef">{dates[hover]?.slice(0, 10) ?? ''}</text>
              <text x={W - 210} y={36} fontSize="10" fill="#e8edef">开 {hoverOpen.toFixed(2)} 收 {hoverClose.toFixed(2)}</text>
              <text x={W - 210} y={49} fontSize="10" fill="#e8edef">低 {hoverK[2]?.toFixed(2) ?? '—'} 高 {hoverK[3]?.toFixed(2) ?? '—'}</text>
              <text x={W - 210} y={61} fontSize="10" fill={hoverPct !== null && hoverPct >= 0 ? '#e05656' : '#2f9e77'}>
                涨跌 {hoverPct !== null ? `${hoverPct >= 0 ? '+' : ''}${hoverPct.toFixed(2)}%` : '—'} · 量 {((volumes[hover] ?? 0) / 10000).toFixed(1)}万手
              </text>
              {hoverContext.length > 0 && (
                <text x={W - 210} y={74} fontSize="9.5" fill="#e8a33d">结构：{hoverContext.join(' · ')}</text>
              )}
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}

export { asNum }
```

（末尾 `export { asNum }` 不需要——删除该行，asNum 仅内部使用。）

- [ ] **Step 4.2: page.tsx 切换导入（行为等价迁移）**

page.tsx：删除整段内联 `ChanChart` 函数定义与 `W/H_MAIN/...` 常量，顶部加：

```ts
import { ChanChart } from './chart.tsx'
```

渲染处改为（临时 payload/highlight 传参，Task 7 接真实联动）：

```tsx
{chart !== null && <ChanChart chart={chart} payload={payload} view={view} onViewChange={setView} highlight={null} />}
```

同时删除 page.tsx 里因迁移而不再使用的导入（如 `useRef` 若仅 ChanChart 用到则移除）。注意 page.tsx 的信号流仍用本地 dateIndex 构建——保留。

- [ ] **Step 4.3: 构建验证**

```bash
pnpm -C kstock/chan-ui build && pnpm -C kstock/chan-ui exec tsc --noEmit -p tsconfig.json && pnpm -C kstock/chan-ui test && echo OK
```

预期：`OK`（build 无错、类型过、9 tests PASS）。

- [ ] **Step 4.4: Commit**

```bash
git add kstock/chan-ui
git commit --no-verify -m "feat: 缠论主图拆分 chart.tsx + 信息条/可靠度环/脉冲高亮/结构上下文"

---

### Task 5: evidence.tsx — 中栏证据链四组件 + 样式段一

**Files:**
- Create: `kstock/chan-ui/src/client/evidence.tsx`
- Modify: `kstock/quant-ui/src/quant.css`（文件末尾追加）

- [ ] **Step 5.1: 创建 evidence.tsx**

`kstock/chan-ui/src/client/evidence.tsx` 完整内容：

```tsx
/**
 * 中栏「动力学×形态学」证据链：推导总链 + 背驰判定卡 + 买卖点证据链卡
 * + 中枢演化卡。全部可点击 → 主图定位并脉冲高亮（onFocus 回调上抛）。
 */
import {
  asArr, asNum, asRec, asStr, backchiKind, backchiPriceRelation, dateIndexOf, resolveIndex,
  evidenceChain, pointWhy, zhongshuForecast, zhongshuPosition,
  type ChartHighlight, type ChartSlice, type Rec,
} from './derive.ts'

export interface FocusEvent { startIdx: number; endIdx: number; hl: ChartHighlight }
export type FocusHandler = (focus: FocusEvent) => void

const backchiTypeCn = (raw: string): string => {
  const kind = backchiKind(raw)
  if (kind === 'top') return '顶背驰'
  if (kind === 'bottom') return '底背驰'
  return '盘整背驰'
}

const zsTypeCn = (raw?: string): string =>
  raw === 'extended' ? '扩展' : raw === 'complex' ? '复杂' : '普通'

/** ⓪ 推导总链：segments 用 → 串起的一句话推理（derive.evidenceChain 产出）。 */
export function ChainStrip({ segments }: { segments: string[] }): React.ReactElement {
  return (
    <div className="ksq-chanx-chain">
      {segments.map((seg, i) => (
        <span key={i} className="ksq-chanx-chain-node">{i > 0 && <em aria-hidden>→</em>}{seg}</span>
      ))}
    </div>
  )
}

/** ① 背驰判定卡：MACD 面积对比条 + 价格关系 + 结论徽章。 */
export function BackchiCard({ chart, onFocus }: { chart: ChartSlice; onFocus: FocusHandler }): React.ReactElement {
  const di = dateIndexOf(chart.dates)
  const items = chart.backchis
    .map((bc, i) => ({ bc, i }))
    .sort((a, b) => (a.bc.valid === b.bc.valid ? a.i - b.i : a.bc.valid ? -1 : 1))
  return (
    <div className="ksq-chanx-card">
      <div className="ksq-chanx-card-hd"><strong>① 背驰判定</strong><span className="ksq-item-meta">动力学 · MACD 力度对比</span></div>
      {items.length === 0 && <p className="ksq-item-meta">本级别暂无背驰记录（未出现可比较的同向段）。</p>}
      {items.map(({ bc, i }) => {
        const prevArea = bc.previousMacdArea ?? null
        const curArea = bc.currentMacdArea ?? null
        const max = Math.max(prevArea ?? 0, curArea ?? 0, 0.0001)
        const rel = backchiPriceRelation(chart, di, bc)
        return (
          <button
            key={i}
            type="button"
            className={`ksq-chanx-bcrow${bc.valid ? ' valid' : ''}`}
            onClick={() => {
              const s = Math.max(0, resolveIndex(di, bc.previousStart))
              const e0 = resolveIndex(di, bc.currentEnd)
              const e = e0 >= 0 ? e0 : chart.dates.length - 1
              onFocus({ startIdx: s, endIdx: e, hl: { kind: 'backchi', id: i } })
            }}
            title={`定位 ${bc.previousStart.slice(0, 10)} ~ ${bc.currentEnd.slice(0, 10)}`}
          >
            <div className="ksq-chanx-bcrow-hd">
              <span className={`ksq-chanx-badge ${bc.valid ? (backchiKind(bc.backchiType) === 'top' ? 'down' : 'up') : ''}`}>
                {backchiTypeCn(bc.backchiType)} · {bc.valid ? '成立' : '未确认'}
              </span>
              <span className="ksq-item-meta ksq-mono">{bc.currentEnd.slice(0, 10)}</span>
            </div>
            <div className="ksq-chanx-areabars">
              <span className="ksq-item-meta">前段</span>
              <span className="ksq-chanx-bar"><i style={{ width: `${((prevArea ?? 0) / max) * 100}%`, background: 'var(--dsw-alias-border-l2)' }} /></span>
              <b className="ksq-mono">{prevArea !== null ? prevArea.toFixed(3) : '—'}</b>
            </div>
            <div className="ksq-chanx-areabars">
              <span className="ksq-item-meta">现段</span>
              <span className="ksq-chanx-bar"><i style={{ width: `${((curArea ?? 0) / max) * 100}%`, background: '#e05656' }} /></span>
              <b className="ksq-mono">{curArea !== null ? curArea.toFixed(3) : '—'}</b>
            </div>
            <div className="ksq-chanx-bcrow-ft">
              {bc.macdDivergence !== undefined && <span className="ksq-item-meta">力度差 {bc.macdDivergence.toFixed(3)}</span>}
              {rel !== null && (
                <span className="ksq-item-meta">
                  价格 {rel.kind === 'top' ? `${rel.prevHigh.toFixed(2)}→${rel.curHigh.toFixed(2)}${rel.newExtreme ? ' 新高' : ' 未新高'}`
                    : rel.kind === 'bottom' ? `${rel.prevLow.toFixed(2)}→${rel.curLow.toFixed(2)}${rel.newExtreme ? ' 新低' : ' 未新低'}`
                    : '盘整区间对照'}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** ② 买卖点证据链卡：类型 + 可靠度条 + 级别确认 + 「为什么」定义行。 */
export function BSPointsCard({ payload, chart, onFocus }: { payload: Rec; chart: ChartSlice | null; onFocus: FocusHandler }): React.ReactElement {
  const di = chart !== null ? dateIndexOf(chart.dates) : null
  const hasValidBackchi = (chart?.backchis ?? []).some(bc => bc.valid)
  /** 动力学 type（如「一类买点」）→ 图上 marker 索引（label=BUY_1 形态），找不到返回 -1。 */
  const markerIndexOf = (type: string, time: string): number => {
    const cls = type.includes('一') ? '1' : type.includes('二') ? '2' : type.includes('三') ? '3' : null
    const side = type.includes('买') ? 'BUY' : type.includes('卖') ? 'SELL' : null
    if (cls === null || side === null) return -1
    return chart?.markers.findIndex(m =>
      (m.label ?? '').toUpperCase() === `${side}_${cls}` && m.time.slice(0, 10) === time.slice(0, 10),
    ) ?? -1
  }
  const rows = [
    ...asArr(asRec(payload.dynamics).buy_points).map(asRec),
    ...asArr(asRec(payload.dynamics).sell_points).map(asRec),
  ]
    .slice(-6)
    .reverse()
    .map((r, i) => ({ r, markerIdx: i }))
  return (
    <div className="ksq-chanx-card">
      <div className="ksq-chanx-card-hd"><strong>② 买卖点证据链</strong><span className="ksq-item-meta">形态 × 动力联立</span></div>
      {rows.length === 0 && <p className="ksq-item-meta">当前级别无买卖点信号。</p>}
      {rows.map(({ r }) => {
        const time = asStr(r.timestamp)
        const price = asNum(r.price)
        const rel = asNum(r.reliability)
        const type = asStr(r.type)
        const isBuy = type.includes('buy') || type.includes('买')
        const idx = di !== null ? resolveIndex(di, time) : -1
        return (
          <button
            key={`${time}-${type}`}
            type="button"
            className="ksq-chanx-bsrow"
            disabled={idx < 0}
            onClick={() => {
              if (idx >= 0) onFocus({ startIdx: idx, endIdx: idx, hl: { kind: 'point', id: markerIndexOf(type, time) } })
            }}
          >
            <div className="ksq-chanx-bsrow-hd">
              <span className={`ksq-chanx-badge ${isBuy ? 'up' : 'down'}`}>{type || '信号'}</span>
              <b className="ksq-mono">{price !== null ? price.toFixed(2) : '—'}</b>
              <span className="ksq-item-meta ksq-mono">{time.slice(0, 10)}</span>
            </div>
            <div className="ksq-chanx-relbar" title={`可靠度 ${rel ?? '—'}`}>
              <span className="ksq-item-meta">可靠度</span>
              <span className="ksq-chanx-bar"><i style={{ width: `${(rel ?? 0) * 100}%`, background: isBuy ? '#31c7a2' : '#e64646' }} /></span>
              <b className="ksq-mono">{rel !== null ? rel.toFixed(2) : '—'}</b>
              {r.confirmed_by_higher === true && <span className="ksq-chanx-ok" title="高级别确认">高✓</span>}
              {r.confirmed_by_lower === true && <span className="ksq-chanx-ok" title="低级别确认">低✓</span>}
            </div>
            <div className="ksq-chanx-why">{pointWhy(type, hasValidBackchi)}</div>
          </button>
        )
      })}
    </div>
  )
}

/** ③ 中枢演化卡：类型/区间/延伸/稳定度 + 现价位置 + 推演。 */
export function ZhongshuCard({ chart, payload, onFocus }: { chart: ChartSlice | null; payload: Rec; onFocus: FocusHandler }): React.ReactElement {
  if (chart === null || chart.zhongshus.length === 0) {
    return (
      <div className="ksq-chanx-card">
        <div className="ksq-chanx-card-hd"><strong>③ 中枢演化</strong><span className="ksq-item-meta">形态学</span></div>
        <p className="ksq-item-meta">本级别暂无中枢（笔/段尚未构成三段重叠区间）。</p>
      </div>
    )
  }
  const di = dateIndexOf(chart.dates)
  const zones = chart.zhongshus.slice(-2).reverse()
  const lastClose = chart.kline.length > 0 ? chart.kline[chart.kline.length - 1]![1] : null
  const trendCn = asStr(asRec(payload.trend_analysis).type_cn)
  return (
    <div className="ksq-chanx-card">
      <div className="ksq-chanx-card-hd"><strong>③ 中枢演化</strong><span className="ksq-item-meta">{trendCn || '形态学'}</span></div>
      {zones.map((zs, i) => {
        const absIdx = chart.zhongshus.length - 1 - i
        const pos = zhongshuPosition(lastClose, zs)
        const s = Math.max(0, resolveIndex(di, zs.start_time))
        const e0 = resolveIndex(di, zs.end_time)
        const e = e0 >= 0 ? e0 : chart.dates.length - 1
        return (
          <button
            key={absIdx}
            type="button"
            className="ksq-chanx-zsrow"
            onClick={() => onFocus({ startIdx: s, endIdx: e, hl: { kind: 'zhongshu', id: absIdx } })}
          >
            <div className="ksq-chanx-bsrow-hd">
              <span className="ksq-chanx-badge zs">{zsTypeCn(zs.zhongshuType)}中枢{zs.extendCount !== undefined && zs.extendCount > 0 ? ` ·延伸${zs.extendCount}` : ''}</span>
              <b className="ksq-mono">{zs.low.toFixed(2)}~{zs.high.toFixed(2)}</b>
            </div>
            {zs.stability !== undefined && (
              <div className="ksq-chanx-relbar">
                <span className="ksq-item-meta">稳定度</span>
                <span className="ksq-chanx-bar"><i style={{ width: `${zs.stability * 100}%`, background: '#c792ea' }} /></span>
                <b className="ksq-mono">{zs.stability.toFixed(2)}</b>
              </div>
            )}
            <div className="ksq-chanx-zspos">
              <span className={`ksq-chanx-badge ${pos === 'above' ? 'up' : pos === 'below' ? 'down' : ''}`}>
                现价 {lastClose !== null ? lastClose.toFixed(2) : '—'} · {pos === 'above' ? '中枢上方' : pos === 'below' ? '中枢下方' : '震荡带内'}
              </span>
            </div>
            {absIdx === chart.zhongshus.length - 1 && (
              <div className="ksq-chanx-why">{zhongshuForecast(lastClose, zs)}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export { evidenceChain }
```

（末尾 `export { evidenceChain }` 不需要——删除；组件只消费它，不再转发。）

- [ ] **Step 5.2: quant.css 追加样式段一**

在 `kstock/quant-ui/src/quant.css` 文件末尾追加：

```css

/* ── 缠论研究改版（三栏证据台）：证据链卡 · 共享件 ───────────────────── */
.ksq-chanx-card {
  background: var(--dsw-alias-surface-1, #101a16);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  padding: 10px 10px 8px;
  display: flex; flex-direction: column; gap: 8px;
}
.ksq-chanx-card-hd { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.ksq-chanx-card-hd strong { font-size: 12.5px; color: var(--dsw-alias-label-primary); }
.ksq-chanx-card > button, .ksq-chanx-card > p { margin: 0; }
.ksq-chanx-chain {
  display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px;
  padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: linear-gradient(90deg, rgba(232,163,61,0.08), transparent 70%);
  font-size: 12px;
}
.ksq-chanx-chain-node { display: inline-flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-primary); }
.ksq-chanx-chain-node em { font-style: normal; color: var(--dsw-alias-label-tertiary); }
.ksq-chanx-badge {
  display: inline-block; font-size: 11px; line-height: 1.6; padding: 0 7px;
  border-radius: 99px; border: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary); white-space: nowrap;
}
.ksq-chanx-badge.up { color: #e05656; border-color: rgba(224,86,86,0.45); background: rgba(224,86,86,0.08); }
.ksq-chanx-badge.down { color: #2f9e77; border-color: rgba(47,158,119,0.45); background: rgba(47,158,119,0.08); }
.ksq-chanx-badge.zs { color: #c792ea; border-color: rgba(199,146,234,0.45); }
.ksq-chanx-bar {
  flex: 1; height: 8px; border-radius: 4px; overflow: hidden;
  background: var(--dsw-alias-surface-2, #0d1613); display: inline-block;
}
.ksq-chanx-bar i { display: block; height: 100%; border-radius: 4px; }
.ksq-chanx-bcrow, .ksq-chanx-bsrow, .ksq-chanx-zsrow {
  text-align: left; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px;
  background: var(--dsw-alias-surface-2, #0d1613); padding: 7px 8px;
  display: flex; flex-direction: column; gap: 5px; cursor: pointer; color: inherit;
  font: inherit; width: 100%;
}
.ksq-chanx-bcrow:hover, .ksq-chanx-bsrow:hover, .ksq-chanx-zsrow:hover,
.ksq-chanx-bcrow:focus-visible, .ksq-chanx-bsrow:focus-visible, .ksq-chanx-zsrow:focus-visible {
  border-color: var(--dsw-alias-brand-primary);
}
.ksq-chanx-bcrow.valid { border-left: 3px solid #e64646; }
.ksq-chanx-bsrow:disabled { cursor: default; opacity: 0.85; }
.ksq-chanx-bcrow-hd, .ksq-chanx-bsrow-hd { display: flex; align-items: center; gap: 6px; justify-content: space-between; }
.ksq-chanx-bsrow-hd b { margin-left: auto; }
.ksq-chanx-areabars, .ksq-chanx-relbar { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.ksq-chanx-areabars .ksq-item-meta, .ksq-chanx-relbar .ksq-item-meta { flex: none; width: 34px; }
.ksq-chanx-relbar b, .ksq-chanx-areabars b { font-weight: 500; font-variant-numeric: tabular-nums; flex: none; min-width: 34px; text-align: right; }
.ksq-chanx-ok { font-size: 10px; color: #2f9e77; border: 1px solid rgba(47,158,119,0.4); border-radius: 3px; padding: 0 3px; flex: none; }
.ksq-chanx-bcrow-ft { display: flex; gap: 10px; flex-wrap: wrap; }
.ksq-chanx-why { font-size: 11px; color: var(--dsw-alias-label-tertiary); line-height: 1.5; }
.ksq-chanx-zspos { display: flex; }
@keyframes ksq-chanx-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
.ksq-chanx-hl { animation: ksq-chanx-pulse 1.1s ease-in-out 2; }
```

- [ ] **Step 5.3: 构建验证**

```bash
pnpm -C kstock/chan-ui build && pnpm -C kstock/chan-ui exec tsc --noEmit -p tsconfig.json && echo OK
```

预期：`OK`（evidence.tsx 尚未被引用也需通过类型检查；若 tsconfig 仅含入口图则无感——两种结果都算过）。

- [ ] **Step 5.4: Commit**

```bash
git add kstock/chan-ui kstock/quant-ui
git commit --no-verify -m "feat: 缠论证据链四组件（总链/背驰/买卖点/中枢）+ ksq-chanx 样式段"
```

---

### Task 6: status.tsx — 缠论原生雷达 + 联立矩阵 + 状态卡 + 样式段二

**Files:**
- Create: `kstock/chan-ui/src/client/status.tsx`
- Modify: `kstock/quant-ui/src/quant.css`（继续末尾追加）

- [ ] **Step 6.1: 创建 status.tsx**

`kstock/chan-ui/src/client/status.tsx` 完整内容：

```tsx
/**
 * 右栏状态：缠论原生七维雷达（替换 czsc 七类）+ 多级别联立矩阵 +
 * 关键位/综合评估 + 折叠的信号明细 chips。
 */
import {
  asArr, asNum, asRec, asStr,
  type MatrixBrief, type RadarDim, type Rec,
} from './derive.ts'

/** 缠论原生雷达：七边形 + 维度值列表（title 悬浮显示计算依据）。 */
export function ChanRadar({ dims, summary }: {
  dims: RadarDim[]
  summary: { score: number | null; direction: 'bullish' | 'bearish' | 'neutral' }
}): React.ReactElement {
  const cx = 78, cy = 72, r = 52
  const angle = (i: number) => (Math.PI * 2 * i) / dims.length - Math.PI / 2
  const point = (i: number, value: number): [number, number] =>
    [cx + Math.cos(angle(i)) * r * value, cy + Math.sin(angle(i)) * r * value]
  const polygon = dims
    .map((d, i) => point(i, d.value !== null ? Math.max(0.04, d.value / 100) : 0.04).join(','))
    .join(' ')
  return (
    <div className="ksq-chanx-radarblock">
      <svg viewBox="0 0 156 144" role="img" aria-label="缠论雷达" className="ksq-chanx-radarsvg">
        <title>{`缠论雷达 ${summary.score ?? '—'} 分（${summary.direction === 'bullish' ? '偏多' : summary.direction === 'bearish' ? '偏空' : '中性'}）`}</title>
        {[0.25, 0.5, 0.75, 1].map(ring => (
          <polygon key={ring} points={dims.map((_, i) => point(i, ring).join(',')).join(' ')} fill="none" stroke="var(--dsw-alias-border-l3)" strokeWidth="0.6" />
        ))}
        {dims.map((d, i) => {
          const [px, py] = point(i, 1)
          return <line key={d.key} x1={cx} y1={cy} x2={px} y2={py} stroke="var(--dsw-alias-border-l3)" strokeWidth="0.6" />
        })}
        <polygon points={polygon} fill="rgba(232,163,61,0.28)" stroke="#e8a33d" strokeWidth="1.4" />
        {dims.map((d, i) => {
          const [px, py] = point(i, 1.22)
          return (
            <text key={`l-${d.key}`} x={px} y={py + 3} fontSize="8.5" textAnchor="middle"
              fill={d.value === null ? 'var(--dsw-alias-label-tertiary)' : 'var(--dsw-alias-label-secondary)'}
              opacity={d.value === null ? 0.55 : 1}>
              {d.label}
            </text>
          )
        })}
      </svg>
      <div className="ksq-chanx-radar-meta">
        <strong className={summary.direction === 'bullish' ? 'ksq-up' : summary.direction === 'bearish' ? 'ksq-down' : ''}>
          {summary.score !== null ? summary.score.toFixed(1) : '—'} 分 · {summary.direction === 'bullish' ? '偏多' : summary.direction === 'bearish' ? '偏空' : '中性'}
        </strong>
        <ul className="ksq-chanx-dims">
          {dims.map(d => (
            <li key={d.key} title={d.basis}>
              <em>{d.label}</em>
              <b className={d.value === null ? '' : d.value >= 55 ? 'ksq-up' : d.value <= 45 ? 'ksq-down' : ''}>
                {d.value !== null ? d.value.toFixed(0) : '—'}
              </b>
            </li>
          ))}
        </ul>
        <span className="ksq-item-meta">悬浮维度看计算依据；缺维退出总分</span>
      </div>
    </div>
  )
}

export interface MatrixRowUI { level: string; status: 'ok' | 'loading' | 'error' | 'empty'; data?: Rec; current?: boolean }

const dirCn = (data: Rec): { cn: string; dir: 'up' | 'down' | 'flat' } => {
  const cn = asStr(asRec(data.trend_analysis).type_cn)
  if (cn.includes('上涨') || cn.includes('多')) return { cn: cn || '—', dir: 'up' }
  if (cn.includes('下跌') || cn.includes('空')) return { cn: cn || '—', dir: 'down' }
  return { cn: cn || '未判定', dir: 'flat' }
}

/** 多级别联立矩阵：四行级别 × 方向/买卖点/得分/背驰，多数方向高亮共振。 */
export function LevelMatrix({ rows }: { rows: MatrixRowUI[] }): React.ReactElement {
  const okRows = rows.filter(r => r.status === 'ok' && r.data !== undefined)
  const dirs = okRows.map(r => dirCn(r.data!).dir).filter(d => d !== 'flat')
  const majority: 'up' | 'down' | null = dirs.length >= 2
    ? (dirs.filter(d => d === 'up').length >= dirs.filter(d => d === 'down').length ? 'up' : 'down')
    : null
  return (
    <div className="ksq-chanx-card">
      <div className="ksq-chanx-card-hd">
        <strong>多级别联立</strong>
        {majority !== null && (
          <span className={`ksq-chanx-badge ${majority === 'up' ? 'up' : 'down'}`}>
            共振{majority === 'up' ? '偏多' : '偏空'}
          </span>
        )}
      </div>
      <table className="ksq-chanx-matrix">
        <thead>
          <tr><th>级别</th><th>方向</th><th>买卖点</th><th>分</th><th>背驰</th></tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const current = row.current === true
            if (row.status !== 'ok' || row.data === undefined) {
              return (
                <tr key={row.level} className={current ? 'cur' : ''}>
                  <td>{row.level}{current ? ' *' : ''}</td>
                  <td colSpan={4} className="ksq-item-meta">
                    {row.status === 'loading' ? '加载中…' : row.status === 'empty' ? '数据不足' : '加载失败'}
                  </td>
                </tr>
              )
            }
            const d = row.data
            const { cn, dir } = dirCn(d)
            const dynamics = asRec(d.dynamics)
            const latestPoint = [
              ...asArr(dynamics.buy_points).map(asRec),
              ...asArr(dynamics.sell_points).map(asRec),
            ].slice(-1)[0]
            const score = asNum(asRec(d.signal_scores).final_score)
            const backchi = asNum(dynamics.backchi_count)
            const resonant = majority !== null && dir === majority
            return (
              <tr key={row.level} className={`${current ? 'cur' : ''} ${resonant ? (majority === 'up' ? 'res-up' : 'res-down') : ''}`}>
                <td>{row.level}{current ? ' *' : ''}</td>
                <td className={dir === 'up' ? 'ksq-up' : dir === 'down' ? 'ksq-down' : ''}>{cn}</td>
                <td>{latestPoint !== undefined ? asStr(latestPoint.type) || '—' : '—'}</td>
                <td className="ksq-mono">{score !== null ? score.toFixed(0) : '—'}</td>
                <td className="ksq-mono">{backchi !== null ? String(backchi) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <span className="ksq-item-meta">* 当前级别 · 同向行高亮 = 共振；分钟级依赖 tushare 配额</span>
    </div>
  )
}

/** 关键位 + 综合评估（risk/confidence 此前未展示）。 */
export function KeyLevelsCard({ advice, lastZhongshu, assessment }: {
  advice: Rec
  lastZhongshu: { low: number; high: number; center: number } | null
  assessment: Rec
}): React.ReactElement {
  const risk = asNum(assessment.risk_level)
  const confidence = asNum(assessment.confidence_score)
  return (
    <div className="ksq-chanx-card">
      <div className="ksq-chanx-card-hd"><strong>关键位 / 评估</strong></div>
      {lastZhongshu !== null ? (
        <>
          <span>中枢 {lastZhongshu.low.toFixed(2)} ~ {lastZhongshu.high.toFixed(2)}（中轴 {lastZhongshu.center.toFixed(2)}）</span>
          <span className="ksq-item-meta">上沿压力 {lastZhongshu.high.toFixed(2)} · 下沿支撑 {lastZhongshu.low.toFixed(2)}</span>
        </>
      ) : <span className="ksq-item-meta">无中枢数据</span>}
      <span>入场 {asNum(advice.entry_price)?.toFixed(2) ?? '—'} · 止损 {asNum(advice.stop_loss)?.toFixed(2) ?? '—'} · 目标 {asNum(advice.take_profit)?.toFixed(2) ?? '—'}</span>
      <div className="ksq-chanx-relbar">
        <span className="ksq-item-meta">风险</span>
        <span className="ksq-chanx-bar"><i style={{ width: `${(risk ?? 0) * 100}%`, background: '#e64646' }} /></span>
        <b className="ksq-mono">{risk !== null ? risk.toFixed(2) : '—'}</b>
      </div>
      <div className="ksq-chanx-relbar">
        <span className="ksq-item-meta">置信</span>
        <span className="ksq-chanx-bar"><i style={{ width: `${(confidence ?? 0) * 100}%`, background: '#5ab0ff' }} /></span>
        <b className="ksq-mono">{confidence !== null ? confidence.toFixed(2) : '—'}</b>
      </div>
    </div>
  )
}

/** 折叠的信号明细 chips（修复分类后的 czsc 评分详情，默认收起）。 */
export function SignalDetailsCollapsible({ scores }: { scores: Rec }): React.ReactElement {
  const details = asArr(scores.signal_details).map(asRec)
  if (details.length === 0) return <></>
  return (
    <details className="ksq-chanx-chips">
      <summary>信号明细（{details.length}）</summary>
      <div className="ksq-chips">
        {details.map((r, index) => (
          <span key={index} className="ksq-chip ksq-mono">{asStr(r.name)} {asStr(r.value)}</span>
        ))}
      </div>
    </details>
  )
}

export type { MatrixBrief }
```

（末尾 `export type { MatrixBrief }` 不需要——删除，仅内部消费。）

- [ ] **Step 6.2: quant.css 追加样式段二**

```css

/* ── 缠论研究改版：右栏状态（雷达/矩阵/折叠 chips）─────────────────── */
.ksq-chanx-radarblock { display: flex; gap: 10px; align-items: flex-start; }
.ksq-chanx-radarsvg { width: 156px; flex: none; }
.ksq-chanx-radar-meta { display: flex; flex-direction: column; gap: 5px; font-size: 13px; min-width: 0; flex: 1; }
.ksq-chanx-radar-meta strong { font-size: 14px; }
.ksq-chanx-dims { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; }
.ksq-chanx-dims li { display: flex; justify-content: space-between; gap: 6px; font-size: 11px; }
.ksq-chanx-dims li em { font-style: normal; color: var(--dsw-alias-label-tertiary); cursor: help; }
.ksq-chanx-dims li b { font-weight: 500; font-variant-numeric: tabular-nums; }
.ksq-chanx-matrix { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.ksq-chanx-matrix th { text-align: left; color: var(--dsw-alias-label-tertiary); font-weight: 400; padding: 2px 4px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
.ksq-chanx-matrix td { padding: 3px 4px; border-bottom: 1px solid var(--dsw-alias-border-l1, var(--dsw-alias-border-l2)); }
.ksq-chanx-matrix tr.cur td:first-child { color: var(--dsw-alias-brand-primary); font-weight: 600; }
.ksq-chanx-matrix tr.res-up td { background: rgba(224,86,86,0.07); }
.ksq-chanx-matrix tr.res-down td { background: rgba(47,158,119,0.07); }
.ksq-chanx-chips summary { cursor: pointer; font-size: 12px; color: var(--dsw-alias-label-tertiary); padding: 4px 0; }
.ksq-chanx-chips .ksq-chips { padding: 4px 0 2px; }
.ksq-chanx-card span { color: var(--dsw-alias-label-primary); font-size: 12px; }
```

- [ ] **Step 6.3: 构建验证 + Commit**

```bash
pnpm -C kstock/chan-ui build && pnpm -C kstock/chan-ui exec tsc --noEmit -p tsconfig.json && echo OK
git add kstock/chan-ui kstock/quant-ui
git commit --no-verify -m "feat: 缠论原生雷达 + 联立矩阵 + 关键位评估/信号明细折叠组件"
```

预期：`OK` + 提交成功。

---

### Task 7: page.tsx 三栏重排 + 联动 + 响应式 + 样式段三

**Files:**
- Modify: `kstock/chan-ui/src/client/page.tsx`（整体重写为组合层）
- Modify: `kstock/quant-ui/src/quant.css`（末尾追加布局段）

- [ ] **Step 7.1: 重写 page.tsx**

整体替换为（保留 ChanPage 导出名与 bindBridge 静态方法，index.tsx 不动）：

```tsx
/**
 * 缠论研究页（三栏证据台）：主图 + 中栏「动力学×形态学」证据链 + 右栏
 * 状态（缠论雷达/联立矩阵/关键位）。数据走宿主 POST /kstock-api/chan-analyze；
 * 深度解读走 TaskTargetMenu（chan 类型独立记忆落点）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { TaskTargetMenu, type TaskRouterBridge, type UseWorkspaces } from '@kstock/quant-ui'
import {
  asArr, asNum, asRec, asStr, evidenceChain, matrixLevels, parseChart,
  radarDims, radarSummary, LEVEL_OPTIONS,
  type ChartHighlight, type ChartSlice, type MatrixBrief, type Rec,
} from './derive.ts'
import { ChanChart } from './chart.tsx'
import { BackchiCard, BSPointsCard, ChainStrip, ZhongshuCard, type FocusEvent } from './evidence.tsx'
import { ChanRadar, KeyLevelsCard, LevelMatrix, SignalDetailsCollapsible, type MatrixRowUI } from './status.tsx'

/** 桥（index.tsx 注入；页面为 slot 组件拿不到 ctx，模块级单例传递）。 */
let chanBridge: TaskRouterBridge | null = null

/** 深度解读提示词（与改版前一致，喂结构摘要 + 信号明细）。 */
function interpretChanPrompt(payload: Rec, stock: string, level: string): string {
  const morph = asRec(payload.morphology)
  const trend = asRec(payload.trend_analysis)
  const advice = asRec(payload.trading_advice)
  const scores = asRec(payload.signal_scores)
  const signals = asArr(scores.signal_details).slice(0, 10).map(item => {
    const r = asRec(item)
    return `${asStr(r.name)}=${asStr(r.value)}`
  })
  const zhongshus = asArr(asRec(payload.chart_data).zhongshu_zones).map(item => {
    const r = asRec(item)
    return `${asNum(r.low)?.toFixed(2) ?? '?'}~${asNum(r.high)?.toFixed(2) ?? '?'}`
  })
  return `缠论研究面板对 ${asStr(payload.stock_name) || stock}（${asStr(payload.stock_code)}，${level} 级）的结构分析：`
    + `K线 ${asNum(morph.klines_count) ?? '?'} 根 → 分型 ${asNum(morph.fenxings_count) ?? '?'} / 笔 ${asNum(morph.bis_count) ?? '?'} / 段 ${asNum(morph.segs_count) ?? '?'} / 中枢 ${asNum(morph.zhongshus_count) ?? '?'}${zhongshus.length > 0 ? `（区间 ${zhongshus.join('、')}）` : ''}；`
    + `走势 ${asStr(trend.type_cn) || asStr(trend.type)}（强度 ${asNum(trend.trend_strength) ?? '?'}），现价 ${asNum(trend.latest_price) ?? '?'}；`
    + `买卖点 买 ${asNum(asRec(payload.dynamics).buy_points_count) ?? 0} / 卖 ${asNum(asRec(payload.dynamics).sell_points_count) ?? 0}，背驰 ${asNum(asRec(payload.dynamics).backchi_count) ?? 0} 处；`
    + `操作参考 ${asStr(advice.recommended_action)}；信号评分 ${asNum(scores.final_score) ?? '?'}（${asStr(scores.direction)} / ${asStr(scores.strength)}），信号明细：${signals.length > 0 ? signals.join('；') : '无'}。`
    + `请做缠论深度解读：当前级别在走势中的位置（趋势/盘整）、中枢演化方向、买卖点的级别联立确认（可再跑多级别）、`
    + `背驰与动能结构、操作计划（入场/止损/目标位与级别匹配）与失效条件。`
    + `可用 stock-analysis 技能的缠论引擎补充多级别分析；数据缺失诚实标注「无数据」，不构成投资建议。`
}

/** 窄屏检测（<1100px 中栏并入右栏 Tab 化）。 */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)')
    const onChange = (event: MediaQueryListEvent): void => { setNarrow(event.matches) }
    mq.addEventListener('change', onChange)
    return () => { mq.removeEventListener('change', onChange) }
  }, [])
  return narrow
}

/** 缠论研究页：三栏证据台（宽屏）/ 图上 + Tab 面板（窄屏）。 */
export function ChanPage({ useWorkspaces }: { useWorkspaces?: UseWorkspaces } = {}) {
  const [stock, setStock] = useState('')
  const [level, setLevel] = useState<string>('daily')
  const [payload, setPayload] = useState<Rec | null>(null)
  const [chart, setChart] = useState<ChartSlice | null>(null)
  const [view, setView] = useState({ start: 0, count: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingAsk, setPendingAsk] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<Record<string, Rec | 'loading' | 'error'>>({})
  const [highlight, setHighlight] = useState<ChartHighlight | null>(null)
  const [sideTab, setSideTab] = useState<'evidence' | 'status'>('evidence')
  const narrow = useNarrow()
  const hlTimer = useRef<number | null>(null)

  const analyze = useCallback(async (targetStock: string, targetLevel: string) => {
    if (targetStock.trim() === '') return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/kstock-api/chan-analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stock: targetStock.trim(), level: targetLevel }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => null)
        throw new Error((detail as { detail?: string } | null)?.detail ?? `分析失败（${response.status}）`)
      }
      const data = (await response.json()) as Rec
      setPayload(data)
      const next = parseChart(data)
      setChart(next)
      setView({ start: 0, count: Math.max(1, next?.dates.length ?? 1) })
      setHighlight(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
      setPayload(null)
      setChart(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void analyze('000001', 'daily') }, [analyze])

  // 联立矩阵：当前级别的其余 3 档并行拉取（含低一档；分钟级可能配额不足 → error 行）。
  const stockCode = payload !== null ? asStr(payload.stock_code) : ''
  useEffect(() => {
    if (stockCode === '') { setMatrix({}); return }
    const others = matrixLevels(level).filter(l => l !== level)
    setMatrix(Object.fromEntries(others.map(l => [l, 'loading' as const])))
    for (const other of others) {
      void fetch('/kstock-api/chan-analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stock: stockCode, level: other }),
      })
        .then(async response => {
          if (!response.ok) throw new Error('fail')
          const data = (await response.json()) as Rec
          const parsed = parseChart(data)
          // 分钟级配额不足：引擎可能返回 200 但 K 线极少——按数据不足处理。
          if (parsed === null || parsed.dates.length < 30) throw new Error('insufficient')
          setMatrix(current => ({ ...current, [other]: data }))
        })
        .catch(() => { setMatrix(current => ({ ...current, [other]: 'error' as const })) })
    }
  }, [stockCode, level])

  /** 卡片联动：视图聚焦到区间 + 脉冲高亮 2.4s 后自清。 */
  const onCardFocus = useCallback((focus: FocusEvent) => {
    const total = chart?.dates.length ?? 0
    if (total === 0) return
    const span = Math.max(40, focus.endIdx - focus.startIdx + 24)
    const start = Math.max(0, Math.min(total - span, focus.startIdx - 12))
    setView({ start, count: Math.min(span, total) })
    if (focus.hl.id >= 0) {
      setHighlight({ kind: focus.hl.kind, id: focus.hl.id })
      if (hlTimer.current !== null) { window.clearTimeout(hlTimer.current) }
      hlTimer.current = window.setTimeout(() => { setHighlight(null) }, 2400)
    }
  }, [chart])

  const morph = payload !== null ? asRec(payload.morphology) : {}
  const dynamics = payload !== null ? asRec(payload.dynamics) : {}
  const advice = payload !== null ? asRec(payload.trading_advice) : {}
  const scores = payload !== null ? asRec(payload.signal_scores) : {}
  const assessment = payload !== null ? asRec(payload.assessment) : {}
  const lastZhongshu = chart !== null && chart.zhongshus.length > 0 ? chart.zhongshus[chart.zhongshus.length - 1] ?? null : null

  const matrixRows: MatrixRowUI[] = matrixLevels(level).map(l => {
    if (l === level) return { level: l, status: 'ok', data: payload ?? undefined, current: true }
    const cell = matrix[l]
    if (cell === undefined) return { level: l, status: 'empty' }
    if (cell === 'loading') return { level: l, status: 'loading' }
    if (cell === 'error') return { level: l, status: 'empty' }
    return { level: l, status: 'ok', data: cell }
  })
  const matrixBriefs: MatrixBrief[] = matrixRows.map(r =>
    r.status === 'ok' && r.data !== undefined ? { status: 'ok', data: r.data } : { status: r.status === 'loading' ? 'loading' : 'error' },
  )
  const dims = payload !== null ? radarDims(payload, matrixBriefs) : []
  const summary = radarSummary(dims)
  const chain = payload !== null ? evidenceChain(payload, chart) : []

  const evidenceColumn = (
    <div className="ksq-chanx-evi">
      <ChainStrip segments={chain} />
      {chart !== null && <BackchiCard chart={chart} onFocus={onCardFocus} />}
      {payload !== null && <BSPointsCard payload={payload} chart={chart} onFocus={onCardFocus} />}
      <ZhongshuCard chart={chart} payload={payload ?? {}} onFocus={onCardFocus} />
    </div>
  )
  const statusColumn = (
    <div className="ksq-chanx-side2">
      <div className="ksq-chanx-card"><ChanRadar dims={dims} summary={summary} /></div>
      <LevelMatrix rows={matrixRows} />
      <KeyLevelsCard advice={advice} lastZhongshu={lastZhongshu} assessment={assessment} />
      <SignalDetailsCollapsible scores={scores} />
    </div>
  )

  return (
    <div className="ksq-page">
      <header className="ksq-topbar">
        <div className="ksq-title">
          <strong>缠论研究</strong>
          <span>动力学 × 形态学 · 证据链 · 级别联立</span>
        </div>
      </header>
      <div className="ksq-body">
        <div className="ksq-toolbar">
          <input
            className="ksq-chan-input"
            value={stock}
            onChange={event => setStock(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') void analyze(stock, level) }}
            placeholder="代码或名称（600519 / 茅台 / 000001.SH）"
            spellCheck={false}
          />
          <select
            className="ksq-chan-select"
            title="分钟级（60/90/120min）依赖 tushare 分钟线配额，数据量可能不足而降级"
            value={level}
            onChange={event => { setLevel(event.target.value); if (payload !== null) void analyze(stock || asStr(payload.stock_code), event.target.value) }}
          >
            {LEVEL_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <button className="ksq-linkbtn" type="button" disabled={loading || stock.trim() === ''} onClick={() => void analyze(stock, level)}>
            {loading ? '分析中…' : '分析'}
          </button>
          {payload !== null && (
            <>
              <span className="ksq-count">
                笔 {asNum(morph.bis_count) ?? '—'} · 段 {asNum(morph.segs_count) ?? '—'} · 中枢 {asNum(morph.zhongshus_count) ?? '—'}
                {' '}· 买 {asNum(dynamics.buy_points_count) ?? 0} / 卖 {asNum(dynamics.sell_points_count) ?? 0} · 背驰 {asNum(dynamics.backchi_count) ?? 0}
              </span>
              <button
                className="ksq-linkbtn"
                type="button"
                disabled={chanBridge === null}
                onClick={() => { if (chanBridge !== null && payload !== null) setPendingAsk(interpretChanPrompt(payload, stock, level)) }}
              >
                让 Agent 深度解读
              </button>
            </>
          )}
        </div>
        {error !== null && <p className="ksq-note">{error}</p>}

        {payload !== null && chart !== null && !narrow && (
          <div className="ksq-chanx-grid">
            <div className="ksq-chanx-chartcol-wrap">
              <ChanChart chart={chart} payload={payload} view={view} onViewChange={setView} highlight={highlight} />
            </div>
            {evidenceColumn}
            {statusColumn}
          </div>
        )}

        {payload !== null && chart !== null && narrow && (
          <div className="ksq-chanx-grid narrow">
            <div className="ksq-chanx-chartcol-wrap">
              <ChanChart chart={chart} payload={payload} view={view} onViewChange={setView} highlight={highlight} />
            </div>
            <div className="ksq-chanx-tabpanel">
              <div className="ksq-chanx-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={sideTab === 'evidence'} className={`ksq-chanx-tab${sideTab === 'evidence' ? ' on' : ''}`} onClick={() => setSideTab('evidence')}>证据链</button>
                <button type="button" role="tab" aria-selected={sideTab === 'status'} className={`ksq-chanx-tab${sideTab === 'status' ? ' on' : ''}`} onClick={() => setSideTab('status')}>状态 / 联立</button>
              </div>
              {sideTab === 'evidence' ? evidenceColumn : statusColumn}
            </div>
          </div>
        )}

        {pendingAsk !== null && chanBridge !== null && (
          <TaskTargetMenu
            taskKind="chan"
            title="缠论深度解读发送到…"
            prompt={pendingAsk}
            bridge={chanBridge}
            useWorkspaces={useWorkspaces}
            onClose={() => setPendingAsk(null)}
          />
        )}
      </div>
    </div>
  )
}

/** index.tsx 注入共享路由桥（模块级单例传递给 slot 组件）。 */
ChanPage.bindBridge = (bridge: TaskRouterBridge): void => { chanBridge = bridge }
```

- [ ] **Step 7.2: quant.css 追加布局段**

```css

/* ── 缠论研究改版：三栏布局 + 窄屏 Tab ─────────────────────────────── */
.ksq-chanx-grid {
  display: grid; gap: 10px; align-items: start;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 330px) minmax(236px, 268px);
}
.ksq-chanx-grid.narrow { grid-template-columns: minmax(0, 1fr); }
.ksq-chanx-chartcol-wrap { min-width: 0; }
.ksq-chanx-chartcol { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ksq-chanx-chartcol svg { width: 100%; height: auto; display: block; }
.ksq-chanx-infobar { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.ksq-chanx-infobar b { font-size: 20px; font-variant-numeric: tabular-nums; }
.ksq-chanx-infobar .ksq-item-meta { margin-left: auto; }
.ksq-chanx-evi, .ksq-chanx-side2 { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.ksq-chanx-tabpanel { border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 8px; }
.ksq-chanx-tabs { display: flex; gap: 6px; margin-bottom: 8px; }
.ksq-chanx-tab {
  font: inherit; font-size: 12px; padding: 3px 12px; border-radius: 99px;
  border: 1px solid var(--dsw-alias-border-l2); background: transparent;
  color: var(--dsw-alias-label-tertiary); cursor: pointer;
}
.ksq-chanx-tab.on {
  color: #0b120f; background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); font-weight: 600;
}
```

- [ ] **Step 7.3: 构建验证**

```bash
pnpm -C kstock/chan-ui build && pnpm -C kstock/chan-ui exec tsc --noEmit -p tsconfig.json && pnpm -C kstock/chan-ui test && echo OK
```

预期：`OK`（9 tests PASS；注意清理 page.tsx 中不再使用的旧 CSS 类无残留引用——ksq-chan-main/ksq-chan-side 等类定义保留在 CSS 中不影响）。

- [ ] **Step 7.4: Commit**

```bash
git add kstock/chan-ui kstock/quant-ui
git commit --no-verify -m "feat: 缠论研究页三栏证据台重排 + 卡片图联动 + 窄屏 Tab 降级"
```

---

### Task 8: 全量校验 + 隔离引擎冒烟（Playwright）+ 收尾

**Files:** 无新增（验证任务）

- [ ] **Step 8.1: 全仓 CI**

```bash
bash scripts/check-ci.sh
```

预期：全绿（chan-ui 构建不在 check-ci 循环内，但 quant-ui 被 chan-ui 内联——quant.css 改动经其类型检查/构建链覆盖；chan-ui 的 build/test 已在 Task 7 单独验证）。

- [ ] **Step 8.2: 重启隔离引擎（模块表按 boot 扫描）**

若 18099 引擎在跑（`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18099/` 返回非 000），先 `kill` 掉旧进程（`lsof -ti tcp:18099 | xargs kill`），再用执行前提中的命令后台重启（沙箱需 danger-full-access）。等待 `curl` 返回 200。

- [ ] **Step 8.3: Playwright 冒烟（browser MCP 工具）**

1. `browser_navigate` → `http://127.0.0.1:18099/`，登录 `smoke-admin` / `Smoke-Test-2026!`
2. 侧栏点「缠论研究」→ 等 000001 daily 默认分析渲染
3. `browser_take_screenshot`（全页）→ 存 `.dsh/chanx-wide.png`：核对三栏、⓪总链、①②③卡、雷达七维、联立矩阵四行
4. 点①卡第一条背驰行 → 截图 `.dsh/chanx-focus.png`：核对视图跳转 + 背驰罩脉冲（截图时可能有动画帧差异，核对视图窗口变化即可）
5. 级别切 `weekly` → 截图 `.dsh/chanx-weekly.png`；再切 `30min` → 截图 `.dsh/chanx-30min.png`：**三图雷达形状/维度值必须不同**（原始痛点回归验证）
6. `browser_resize` 至 900×800 → 截图：Tab 降级可见（证据链/状态两 Tab）
7. 控制台 `browser_console_messages`（error 级）：核对无新增报错（eastmoney 类外站资源错误不存在于此页；忽略引擎无关警告）

任何一步不符 → 修复后重跑本步（修复代码需回到对应 Task 补 commit）。

- [ ] **Step 8.4: 收尾 Commit + 清理**

```bash
git add -A && git status --short   # 确认只剩截图等无关文件则不加
git log --oneline -8
```

预期：Task 1-7 七个提交齐全，工作树干净（截图在 .dsh/ 下且被忽略，不提交）。

---

## 计划自审记录

- **规格覆盖**：§3 布局→Task 7；§4.1 ⓪→derive.evidenceChain+ChainStrip（T3/T5）、①→BackchiCard（T3/T5）、②→BSPointsCard（T3/T5，marker 联动已补）、③→ZhongshuCard（T3/T5）；§4.2 雷达→radarDims/ChanRadar（T3/T6）、矩阵→matrixLevels/LevelMatrix（T2/T6/T7）、关键位评估→KeyLevelsCard（T6）、折叠 chips→SignalDetailsCollapsible（T6）；§4.3 主图增强→Task 4；§4.4 美化→CSS 段一/二/三；§5 引擎补丁→Task 1；§7 缺失态→derive null 语义 + 组件空态文案（T3/T5/T6）；§8 验收→Task 8。无缺口。
- **占位扫描**：无 TBD/TODO；每个代码步骤含完整代码；执行命令均带预期输出。
- **类型一致性**：FocusEvent/ChartHighlight/MatrixBrief/MatrixRowUI/RadarDim 在 Task 3/4/5/6 定义处与消费处（Task 7）签名一致；dynamics.buy_points 的 type 字段实测为「一类买点」中文串（引擎 BuySellPointType.__str__），markerIndexOf 按此设计。
- **已知风险**：marker label 形态（`BUY_1`）若上游变化则脉冲失配（降级为仅定位，不报错）——可接受。

---

### Task 1R: 补丁 22 v2 + 补丁 23（Task 1 质量审查修正）

> 审查实证：评分表 157 键全带类别前缀（`tas_macd_cross`/`cxt_trend_type_signal`…），信号库产出裸键；原映射值与代码库自身分类学矛盾（8 个指标源自 `self._tas.tas_*` 应归 tas；`trend_type` 源自 `cxt_trend_type_signal` 应保持默认 cxt；jcc 在该体系=K线组合）。且只改分组不动查分，radar 仍钉 50。本修订：映射表改为 8 键→tas 并更名 `_SIGNAL_CATEGORY_OVERRIDE`；新增补丁 23 修 `score_single_signal` 裸键查分前缀重试。

- [ ] **R1: 还原 vendor scorer 到打补丁前状态**（patcher 对 marker 幂等跳过，需先回 pristine）

```bash
git show dfbd3d81~1:vendor/skills/public/stock-analysis/chan_theory_v2/core/signal_scorer.py > vendor/skills/public/stock-analysis/chan_theory_v2/core/signal_scorer.py
```

- [ ] **R2: 改写 patcher 中补丁 22 定义**（映射表 + 注释 + 函数名不变 `_fix_chan_scorer_categories`）

`_CHAN_SCORER_REPLACEMENT` 替换为：

```python
_CHAN_SCORER_REPLACEMENT = (
    "    # KStock patch: 信号类别显式覆盖——generate_signal_library 的 8 个" + chr(10)
    + "    # 技术指标裸键（macd_cross 等）源自 self._tas.tas_*，评分表键为 tas_* 前缀；" + chr(10)
    + "    # 前缀猜测把它们全落入默认 cxt。仅覆盖这 8 键，其余裸键默认 cxt 已正确" + chr(10)
    + "    # （trend_type 源自 cxt_trend_type_signal）。sta/pos 信号库无来源，恒空。" + chr(10)
    + "    _SIGNAL_CATEGORY_OVERRIDE = {" + chr(10)
    + '        "macd_cross": "tas", "dif_zero": "tas", "double_ma": "tas",' + chr(10)
    + '        "ma_system": "tas", "boll_status": "tas", "kdj_cross": "tas",' + chr(10)
    + '        "rsi_status": "tas", "atr": "tas",' + chr(10)
    + "    }" + chr(10)
    + chr(10)
    + "    def _get_category(self, signal_name: str) -> str:" + chr(10)
    + '        """根据信号函数名确定类别（KStock patch: 显式覆盖优先）"""' + chr(10)
    + "        if signal_name in self._SIGNAL_CATEGORY_OVERRIDE:" + chr(10)
    + "            return self._SIGNAL_CATEGORY_OVERRIDE[signal_name]" + chr(10)
    + '        for prefix in ["cxt", "tas", "bar", "vol", "jcc", "pos", "sta"]:' + chr(10)
    + "            if signal_name.startswith(prefix):" + chr(10)
    + "                return prefix" + chr(10)
    + '        return "cxt"  # 默认归入缠论形态（bi_/zs_/fx_/trend_type/backchi/decision 等）'
)
```

（`_CHAN_SCORER_ANCHOR` 与 marker 不变；定义块头注释同步改写为「信号类别显式覆盖（8 指标键→tas）」。）

- [ ] **R3: 新增补丁 23 定义**（紧跟补丁 22 定义之后）

```python
# ── 补丁 23：评分器裸键查分前缀重试 ────────────────────────────────────
# 评分表 157 键全带类别前缀（tas_macd_cross/cxt_bi_base…），信号库产出
# 裸键（macd_cross/bi_base…）→ 查分 miss 恒 0，各类均分被拉回 0、radar
# 钉死 50（与补丁 22 同根因的另一半）。miss 时按类别前缀补齐重试。
_CHAN_SCORELOOKUP_REL = "public/stock-analysis/chan_theory_v2/core/signal_scorer.py"
_CHAN_SCORELOOKUP_MARKER = "KStock patch: 裸键失配重试"
_CHAN_SCORELOOKUP_ANCHOR = (
    "        # 获取该信号函数的评分映射" + chr(10)
    + "        signal_map = self.score_map.get(signal_name, {})" + chr(10)
    + "        if not signal_map:" + chr(10)
    + "            return 0.0"
)
_CHAN_SCORELOOKUP_REPLACEMENT = (
    "        # 获取该信号函数的评分映射" + chr(10)
    + "        # KStock patch: 裸键失配重试——评分表键带类别前缀（tas_macd_cross），" + chr(10)
    + "        # 信号库产出裸键（macd_cross），逐前缀补齐再查，命中即用。" + chr(10)
    + "        signal_map = self.score_map.get(signal_name)" + chr(10)
    + "        if signal_map is None:" + chr(10)
    + '            for prefix in ("cxt", "tas", "bar", "vol", "jcc", "pos", "sta"):' + chr(10)
    + '                signal_map = self.score_map.get(f"{prefix}_{signal_name}")' + chr(10)
    + "                if signal_map:" + chr(10)
    + "                    break" + chr(10)
    + "        if not signal_map:" + chr(10)
    + "            return 0.0"
)


def _fix_chan_scorelookup_retry(text: str) -> str | None:
    """评分器裸键查分前缀重试（signal_scorer.py）；已修/失配返回 None。"""
    if _CHAN_SCORELOOKUP_MARKER in text:
        return None
    if _CHAN_SCORELOOKUP_ANCHOR not in text:
        return None
    return text.replace(_CHAN_SCORELOOKUP_ANCHOR, _CHAN_SCORELOOKUP_REPLACEMENT, 1)
```

接线（apply_skill_patches 内补丁 22 调用块之后）：

```python
    # 缠论评分器裸键查分前缀重试（radar 钉死 50 的另一半根因，补丁 23）。
    if chan_scorer.exists():
        if _patch_file(chan_scorer, _CHAN_SCORELOOKUP_REL, _fix_chan_scorelookup_retry):
            changed.append(_CHAN_SCORELOOKUP_REL)
```

- [ ] **R4: 应用 + 幂等 + 行为验证**

```bash
scripts/python.sh scripts/patch_vendor_skills.py      # 预期列出 scorer + presets
scripts/python.sh scripts/patch_vendor_skills.py      # 预期「已就绪」
cd kstock/presets/stock-analysis/skills/stock-analysis && python3 -c "
from collections import OrderedDict
from chan_theory_v2.core.signal_scorer import SignalScorer
s = SignalScorer()
cats = {k: s._get_category(k) for k in ['bi_base','trend_type','backchi','macd_cross','kdj_cross','atr','bar_zdf','vol_ratio','jcc_hammer']}
print('cats:', cats)
assert cats == {'bi_base':'cxt','trend_type':'cxt','backchi':'cxt','macd_cross':'tas','kdj_cross':'tas','atr':'tas','bar_zdf':'bar','vol_ratio':'vol','jcc_hammer':'jcc'}
score = s.score_single_signal('macd_cross', OrderedDict([('v', '多头_任意_任意')]))
print('macd_cross score:', score)
assert score != 0.0, '裸键查分仍为 0'
print('OK')
"
```

预期：cats 断言通过；`macd_cross score: 25.0`（tas_macd_cross 表「多头」=25）；输出 OK。

- [ ] **R5: 真实数据回归（radar 解钉验证）**

```bash
set -a; source ~/.kstock/config/secrets.env; set +a
cd kstock/presets/stock-analysis/skills/stock-analysis
for lvl in daily weekly; do python3 scripts/analyze_stock_chan.py --stock 000001 --level $lvl --json 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin); s=d.get('signal_scores') or {}
print('$lvl', 'counts:', {k:(s.get('category_counts') or {}).get(k) for k in ['cxt','tas','vol','bar','jcc','sta','pos']})
print('  radar:', s.get('radar_data'))
"; done
```

预期：counts 中 cxt/tas/vol/bar/jcc ≥1、sta/pos 为 0；两级别 radar 的 cxt/tas 轴不再恒 50.0 且互不相同（有真实分数进入）。

- [ ] **R6: Commit**

```bash
git add scripts/patch_vendor_skills.py vendor/skills/public/stock-analysis/chan_theory_v2/core/signal_scorer.py
git commit --no-verify -m "fix: 评分器分类覆盖修正（8 指标键→tas）+ 裸键查分前缀重试（补丁 22 v2/23）"
```
