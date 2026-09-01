/**
 * 因子库视图：因子列表 + 版本时间线 + 检验运行 + 跨版本对比。
 *
 * 与策略库视图（StrategiesLibrary.tsx）同构：因子是持续迭代的活资产，
 * 版本不可变（改定义/参数=新版本），检验运行锁定「因子版本 × 股票池 ×
 * 数据区间 × 检验配置」四元组；对比视图对齐口径并叠加累计 IC 曲线。
 * 「重跑本版本」把编排 prompt 预填到工作台输入框。
 * 样式复用 strategies-* 通用库布局类（列表/详情/时间线/表格）。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, FlaskConical, Play, RefreshCw } from "lucide-react";
import {
  compareFactorRuns,
  getFactorRunIcSeries,
  isFactorsApiError,
  listFactors,
  listFactorRuns,
  listFactorVersions,
  type Factor,
  type FactorRunComparison,
  type FactorRunIcSeries,
  type FactorRunSummary,
  type FactorVersion,
} from "../lib/factorsClient";

const RUN_COLORS = ["#e8a33d", "#5ab0ff", "#22a06b", "#c792ea", "#e64646", "#8ee6c8"];

const CATEGORY_LABELS: Record<string, string> = {
  value: "价值",
  momentum: "动量",
  quality: "质量",
  low_vol: "低波动",
  size: "规模",
  growth: "成长",
  custom: "自定义",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** 数值语义着色：IC/IR/多空差为正绿、负红；IC>0 占比按方向稳定性阈值。 */
function metricClass(key: string, value: unknown): string {
  if (typeof value !== "number") return "";
  if (key === "ic_positive_pct") return value >= 55 ? "value-up" : value < 50 ? "value-down" : "";
  if (key === "ic_mean" || key === "ir" || key === "long_short_spread_pct") {
    return value > 0 ? "value-up" : value < 0 ? "value-down" : "";
  }
  return "";
}

function metric(run: FactorRunSummary, key: string): string {
  const value = run.metrics?.[key];
  if (typeof value === "number") return String(value);
  return "—";
}

function statusBadge(status: string): { label: string; tone: string } {
  const map: Record<string, { label: string; tone: string }> = {
    researching: { label: "研究中", tone: "live" },
    adopted: { label: "已采用", tone: "good" },
    paused: { label: "已暂停", tone: "idle" },
    rejected: { label: "已否定", tone: "bad" },
  };
  return map[status] ?? { label: status, tone: "idle" };
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", { hour12: false });
}

/** IC 序列归一化：兼容 [{date, ic}] 与数值数组，输出累计 IC（0 起点）。 */
function cumulativeIc(raw: FactorRunIcSeries["ic_series"]): number[] {
  let values: number[] = [];
  if (Array.isArray(raw)) {
    const asObjects = raw.every(
      (item) => typeof item === "object" && item !== null && typeof item.ic === "number",
    );
    if (asObjects) {
      values = (raw as Array<{ ic: number }>).map((item) => item.ic);
    } else {
      values = (raw as unknown[]).filter((item): item is number => typeof item === "number");
    }
  }
  const out: number[] = [];
  let acc = 0;
  for (const value of values) {
    acc += Number.isFinite(value) ? value : 0;
    out.push(acc);
  }
  return out;
}

function IcOverlay({ series }: { series: Array<{ label: string; values: number[]; color: string }> }) {
  const drawable = series.filter((item) => item.values.length >= 2);
  if (drawable.length === 0) return null;
  const width = 560;
  const height = 240;
  const padLeft = 46;
  const padBottom = 26;
  const maxLen = Math.max(...drawable.map((item) => item.values.length));
  const allValues = drawable.flatMap((item) => item.values);
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const span = max - min || 1;
  const x = (index: number, length: number) =>
    padLeft + (index / Math.max(1, length - 1)) * (width - padLeft - 12);
  const y = (value: number) => 14 + (1 - (value - min) / span) * (height - padBottom - 14);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="版本累计 IC 曲线叠加对比" style={{ maxWidth: "100%", height: "auto" }}>
      <line x1={padLeft} y1={y(0)} x2={width - 12} y2={y(0)} stroke="#3a4650" strokeDasharray="3,3" />
      <text x={padLeft - 6} y={y(0) + 4} fontSize="10" textAnchor="end" fill="#8f98a2">0</text>
      <text x={padLeft - 6} y={y(max) + 4} fontSize="10" textAnchor="end" fill="#8f98a2">{max.toFixed(2)}</text>
      <text x={padLeft - 6} y={y(min) + 4} fontSize="10" textAnchor="end" fill="#8f98a2">{min.toFixed(2)}</text>
      {drawable.map((item) => (
        <polyline
          key={item.label}
          points={item.values.map((value, index) => `${x(index, item.values.length)},${y(value)}`).join(" ")}
          fill="none"
          stroke={item.color}
          strokeWidth="2"
        />
      ))}
      {drawable.map((item, row) => (
        <g key={`legend-${item.label}`}>
          <rect x={padLeft + row * 120} y={height - 14} width="10" height="10" fill={item.color} />
          <text x={padLeft + row * 120 + 15} y={height - 5} fontSize="11" fill="#c9cdd4">
            {item.label}（{item.values.length === maxLen ? `${item.values.length}期` : `${item.values.length}/${maxLen}期`}）
          </text>
        </g>
      ))}
    </svg>
  );
}

export function FactorsLibrary({
  onBack,
  onRerun,
}: {
  onBack: () => void;
  /** 预填重跑 prompt 并回到工作台。 */
  onRerun: (prompt: string) => void;
}) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<FactorVersion[]>([]);
  const [runs, setRuns] = useState<FactorRunSummary[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<FactorRunComparison | null>(null);
  const [icSeriesList, setIcSeriesList] = useState<FactorRunIcSeries[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setFactors(await listFactors());
    } catch (err) {
      setError(isFactorsApiError(err) ? err.message : "加载因子库失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 手动刷新：列表 + 选中因子的版本/检验详情一起重拉（agent 刚跑完检验时靠它看到新数据）。 */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const list = await listFactors();
      setFactors(list);
      if (selectedId) {
        const [versionList, runList] = await Promise.all([
          listFactorVersions(selectedId),
          listFactorRuns(selectedId),
        ]);
        setVersions(versionList);
        setRuns(runList);
      }
    } catch (err) {
      setError(isFactorsApiError(err) ? err.message : "刷新因子库失败");
    } finally {
      setRefreshing(false);
    }
  }, [selectedId]);

  const selected = factors.find((item) => item.factor_id === selectedId) ?? null;

  const loadDetail = useCallback(async (factorId: string) => {
    setDetailLoading(true);
    setCompareIds([]);
    setComparison(null);
    setIcSeriesList([]);
    setError(null);
    try {
      const [versionList, runList] = await Promise.all([
        listFactorVersions(factorId),
        listFactorRuns(factorId),
      ]);
      setVersions(versionList);
      setRuns(runList);
    } catch (err) {
      setError(isFactorsApiError(err) ? err.message : "加载因子详情失败");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const toggleCompare = (runId: string) => {
    setCompareIds((current) =>
      current.includes(runId)
        ? current.filter((id) => id !== runId)
        : current.length >= 4
          ? current
          : [...current, runId],
    );
  };

  useEffect(() => {
    if (!selectedId || compareIds.length < 2) {
      setComparison(null);
      setIcSeriesList([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [result, ...series] = await Promise.all([
          compareFactorRuns(selectedId, compareIds),
          ...compareIds.map((runId) => getFactorRunIcSeries(selectedId, runId).catch(() => null)),
        ]);
        if (!active) return;
        setComparison(result);
        setIcSeriesList(series.filter((item): item is FactorRunIcSeries => item !== null));
      } catch (err) {
        if (active) setError(isFactorsApiError(err) ? err.message : "对比加载失败");
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId, compareIds]);

  const rerunPrompt = (version: FactorVersion) =>
    `请重跑因子库中的因子：先用 factor_get_latest 读取 ${selected?.name ?? "因子"}（${selectedId}），` +
    `若当前版本已是 v${version.version} 则直接使用其因子定义与参数；检验要求——按「因子研究场景」编排构造面板并做 IC/IR 分析与分层回测，` +
    `股票池、数据区间与检验配置与该版本最近一次 run 保持一致（如无历史 run 则用沪深300+中证500 成分、近 3 年数据、5 分层），` +
    `跑完后按编排用 factor_record_run 入库新 run（config 原样抄录检验配置，metrics 抄录 ic_summary 与 backtest 关键字段）。`;

  const icSeriesData = useMemo(
    () =>
      icSeriesList.map((item, index) => ({
        label: `v${item.version}`,
        values: cumulativeIc(item.ic_series),
        color: RUN_COLORS[index % RUN_COLORS.length],
      })),
    [icSeriesList],
  );

  const metricKeys = [
    ["ic_mean", "IC 均值"],
    ["ir", "IR"],
    ["ic_positive_pct", "IC>0 占比 %"],
    ["long_short_spread_pct", "多空分层差 %"],
    ["n_periods", "检验期数"],
  ] as const;

  return (
    <main className="strategies-library report-library-page" aria-label="因子库">
      <div className="report-library-topbar">
        <div className="report-library-topbar-leading">
          <button className="icon-ghost" type="button" onClick={onBack} aria-label="返回任务页面" title="返回任务页面">
            <ArrowLeft size={17} />
          </button>
          <div className="report-library-title">
            <strong>因子库</strong>
            <span>版本化的因子资产：版本时间线 · 检验运行 · 跨版本对比</span>
          </div>
        </div>
        <div className="report-library-topbar-actions">
          <span className="report-count"><FlaskConical size={13} />{factors.length} 个因子</span>
          <button
            className="icon-ghost"
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label="刷新因子库"
            title="刷新因子库"
          >
            <RefreshCw size={16} className={refreshing ? "spin" : undefined} />
          </button>
        </div>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <div className="strategies-layout">
        <aside className="strategies-list">
          {loading ? (
            <p className="memory-loading">加载因子库…</p>
          ) : factors.length === 0 ? (
            <p className="strategies-hint">暂无因子。在任务里让 agent 做「因子研究/因子挖掘」并入库版本后，这里会出现因子资产。</p>
          ) : (
            factors.map((factor) => (
              <button
                key={factor.factor_id}
                type="button"
                className={`strategies-item ${factor.factor_id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(factor.factor_id)}
              >
                <span className="strategies-item-name">
                  <span className={`strategies-dot tone-${statusBadge(factor.status).tone}`} aria-hidden="true" />
                  {factor.name}
                </span>
                <span className="strategies-item-meta">
                  {categoryLabel(factor.category)} · v{factor.current_version} · {statusBadge(factor.status).label}
                  {factor.latest_run && typeof factor.latest_run.metrics?.ic_mean === "number" && (
                    <span className={`strategies-chip ${metricClass("ic_mean", factor.latest_run.metrics.ic_mean)}`}>
                      IC {metric(factor.latest_run, "ic_mean")}
                    </span>
                  )}
                  {factor.latest_run && typeof factor.latest_run.metrics?.ir === "number" && (
                    <span className={`strategies-chip ${metricClass("ir", factor.latest_run.metrics.ir)}`}>
                      IR {metric(factor.latest_run, "ir")}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </aside>

        <section className="strategies-detail">
          {!selected ? (
            <p className="strategies-hint">从左侧选择一个因子查看版本时间线与检验对比。</p>
          ) : detailLoading ? (
            <p className="memory-loading">加载因子详情…</p>
          ) : (
            <>
              <header className="strategies-identity">
                <div className="strategies-identity-head">
                  <h2>{selected.name}</h2>
                  <span className={`strategies-badge tone-${statusBadge(selected.status).tone}`}>
                    {statusBadge(selected.status).label}
                  </span>
                </div>
                <p className="strategies-hypothesis">{selected.hypothesis || "（未写因子逻辑假设）"}</p>
                <p className="strategies-item-meta mono">
                  {selected.factor_id} · {categoryLabel(selected.category)} · 当前 v{selected.current_version} · 更新于 {formatDateTime(selected.updated_at)}
                </p>
              </header>

              <h3><FlaskConical size={14} /> 版本时间线</h3>
              <div className="strategies-versions">
                {versions.length === 0 ? (
                  <p className="strategies-hint">尚无版本。</p>
                ) : (
                  versions
                    .slice()
                    .reverse()
                    .map((version) => (
                      <div
                        key={version.version}
                        className={`strategies-version ${version.version === selected.current_version ? "latest" : ""}`}
                      >
                        <span className="strategies-version-node" aria-hidden="true" />
                        <div className="strategies-version-card">
                          <div className="strategies-version-head">
                            <strong>v{version.version}</strong>
                            {version.version === selected.current_version && (
                              <span className="strategies-badge tone-live">最新</span>
                            )}
                            <span className="strategies-item-meta">
                              {formatDateTime(version.created_at)} · {Math.round(version.code_bytes / 1024)}KB · sha {version.code_sha256.slice(0, 8)}
                            </span>
                          </div>
                          <p className="strategies-change-note">{version.change_note || "（无变更说明）"}</p>
                          <button className="link-button strategies-rerun" type="button" onClick={() => onRerun(rerunPrompt(version))}>
                            <Play size={12} /> 重跑本版本
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <h3>检验运行（勾选 2-4 个对比）</h3>
              {runs.length === 0 ? (
                <p className="strategies-hint">尚无检验运行记录。</p>
              ) : (
                <table className="data-table strategies-runs-table">
                  <thead>
                    <tr>
                      <th>对比</th>
                      <th>run</th>
                      <th>版本</th>
                      <th>股票池</th>
                      <th>区间</th>
                      <th>IC 均值</th>
                      <th>IR</th>
                      <th>IC&gt;0 %</th>
                      <th>多空差 %</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.run_id} className={compareIds.includes(run.run_id) ? "selected" : ""}>
                        <td>
                          <input
                            type="checkbox"
                            checked={compareIds.includes(run.run_id)}
                            onChange={() => toggleCompare(run.run_id)}
                            aria-label={`对比 run ${run.run_id}`}
                          />
                        </td>
                        <td className="mono" title={run.run_id}>{run.run_id.slice(5, 13)}</td>
                        <td>v{run.version}</td>
                        <td>{run.universe || "—"}</td>
                        <td>{run.data_start || "?"} ~ {run.data_end || "?"}</td>
                        <td className={`num ${metricClass("ic_mean", run.metrics?.ic_mean)}`}>{metric(run, "ic_mean")}</td>
                        <td className={`num ${metricClass("ir", run.metrics?.ir)}`}>{metric(run, "ir")}</td>
                        <td className={`num ${metricClass("ic_positive_pct", run.metrics?.ic_positive_pct)}`}>{metric(run, "ic_positive_pct")}</td>
                        <td className={`num ${metricClass("long_short_spread_pct", run.metrics?.long_short_spread_pct)}`}>{metric(run, "long_short_spread_pct")}</td>
                        <td>{formatDateTime(run.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {comparison && (
                <div className="strategies-compare">
                  <h3>版本对比{comparison.comparable ? "（同口径，可严格对比）" : "（口径不一致，仅供参考）"}</h3>
                  {!comparison.comparable && comparison.notes.map((note) => <p key={note} className="strategies-note">{note}</p>)}
                  <table className="data-table strategies-runs-table">
                    <thead>
                      <tr>
                        <th>指标</th>
                        {comparison.runs.map((run) => (
                          <th key={run.run_id} className="mono">v{run.version} · {run.run_id.slice(5, 13)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metricKeys.map(([key, label]) => (
                        <tr key={key}>
                          <td className="metric-name">{label}</td>
                          {comparison.runs.map((run) => (
                            <td key={run.run_id} className={`num ${metricClass(key, run.metrics?.[key])}`}>{metric(run, key)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {icSeriesData.length >= 2 ? (
                    <div className="strategies-equity-chart">
                      <h4>累计 IC 曲线叠加</h4>
                      <IcOverlay series={icSeriesData} />
                    </div>
                  ) : (
                    <p className="strategies-note">所选运行缺少 IC 序列数据（factor_record_run 未存 ic_series），无法叠加曲线。</p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
