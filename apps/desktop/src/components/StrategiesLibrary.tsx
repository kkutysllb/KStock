/**
 * 策略库视图：策略列表 + 版本时间线 + 回测运行 + 跨版本对比。
 *
 * 策略是持续迭代的活资产：版本不可变（改参数=新版本），回测运行锁定
 * 「策略版本 × 数据区间 × 交易规则」三元组；对比视图对齐口径并叠加
 * 净值曲线。「重跑本版本」把编排 prompt 预填到工作台输入框。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, GitBranch, Play, RefreshCw } from "lucide-react";
import {
  compareStrategyRuns,
  getStrategyRunEquity,
  isStrategiesApiError,
  listStrategies,
  listStrategyRuns,
  listStrategyVersions,
  type Strategy,
  type StrategyEquity,
  type StrategyRunComparison,
  type StrategyRunSummary,
  type StrategyVersion,
} from "../lib/strategiesClient";

const RUN_COLORS = ["#e8a33d", "#5ab0ff", "#22a06b", "#c792ea", "#e64646", "#8ee6c8"];

/** 数值语义着色：收益/夏普为正绿、负红；回撤放大显示。 */
function metricClass(key: string, value: unknown): string {
  if (typeof value !== "number") return "";
  if (key === "max_drawdown_pct") return value < -20 ? "value-down" : value < 0 ? "value-warn" : "";
  if (key === "total_return_pct" || key === "annual_return_pct" || key === "sharpe_ratio") {
    return value > 0 ? "value-up" : value < 0 ? "value-down" : "";
  }
  return "";
}

function metric(run: StrategyRunSummary, key: string): string {
  const value = run.metrics?.[key];
  if (typeof value === "number") return String(value);
  return "—";
}

function statusBadge(status: string): { label: string; tone: string } {
  const map: Record<string, { label: string; tone: string }> = {
    researching: { label: "研究中", tone: "live" },
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

/** 净值数据归一化：兼容 [{date, equity}] 与 {dates/values} 两种形态，统一为 1 起点。 */
function normalizeEquity(raw: StrategyEquity["equity"]): number[] {
  let values: number[] = [];
  if (Array.isArray(raw)) {
    const asObjects = raw.every(
      (item) => typeof item === "object" && item !== null && typeof item.equity === "number",
    );
    if (asObjects) {
      values = (raw as Array<{ equity: number }>).map((item) => item.equity);
    } else {
      values = (raw as unknown[]).filter((item): item is number => typeof item === "number");
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as { dates?: unknown; values?: unknown; equity_values?: unknown };
    const candidate = Array.isArray(record.values) ? record.values : record.equity_values;
    if (Array.isArray(candidate)) values = candidate.filter((v): v is number => typeof v === "number");
  }
  const base = values[0];
  if (!Number.isFinite(base) || base <= 0) return values;
  return values.map((value) => value / base);
}

function EquityOverlay({ series }: { series: Array<{ label: string; values: number[]; color: string }> }) {
  const drawable = series.filter((item) => item.values.length >= 2);
  if (drawable.length === 0) return null;
  const width = 560;
  const height = 240;
  const padLeft = 46;
  const padBottom = 26;
  const maxLen = Math.max(...drawable.map((item) => item.values.length));
  const allValues = drawable.flatMap((item) => item.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const x = (index: number, length: number) =>
    padLeft + (index / Math.max(1, length - 1)) * (width - padLeft - 12);
  const y = (value: number) => 14 + (1 - (value - min) / span) * (height - padBottom - 14);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="版本净值曲线叠加对比" style={{ maxWidth: "100%", height: "auto" }}>
      <line x1={padLeft} y1={y(1)} x2={width - 12} y2={y(1)} stroke="#3a4650" strokeDasharray="3,3" />
      <text x={padLeft - 6} y={y(1) + 4} fontSize="10" textAnchor="end" fill="#8f98a2">1.00</text>
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
            {item.label}（{item.values.length === maxLen ? `${item.values.length}pt` : `${item.values.length}/${maxLen}pt`}）
          </text>
        </g>
      ))}
    </svg>
  );
}

export function StrategiesLibrary({
  onBack,
  onRerun,
}: {
  onBack: () => void;
  /** 预填重跑 prompt 并回到工作台。 */
  onRerun: (prompt: string) => void;
}) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [runs, setRuns] = useState<StrategyRunSummary[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<StrategyRunComparison | null>(null);
  const [equities, setEquities] = useState<StrategyEquity[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setStrategies(await listStrategies());
    } catch (err) {
      setError(isStrategiesApiError(err) ? err.message : "加载策略库失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 手动刷新：列表 + 选中策略的版本/回测详情一起重拉（agent 刚跑完回测时靠它看到新数据）。 */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const list = await listStrategies();
      setStrategies(list);
      if (selectedId) {
        const [versionList, runList] = await Promise.all([
          listStrategyVersions(selectedId),
          listStrategyRuns(selectedId),
        ]);
        setVersions(versionList);
        setRuns(runList);
      }
    } catch (err) {
      setError(isStrategiesApiError(err) ? err.message : "刷新策略库失败");
    } finally {
      setRefreshing(false);
    }
  }, [selectedId]);

  const selected = strategies.find((item) => item.strategy_id === selectedId) ?? null;

  const loadDetail = useCallback(async (strategyId: string) => {
    setDetailLoading(true);
    setCompareIds([]);
    setComparison(null);
    setEquities([]);
    setError(null);
    try {
      const [versionList, runList] = await Promise.all([
        listStrategyVersions(strategyId),
        listStrategyRuns(strategyId),
      ]);
      setVersions(versionList);
      setRuns(runList);
    } catch (err) {
      setError(isStrategiesApiError(err) ? err.message : "加载策略详情失败");
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
      setEquities([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [result, ...curves] = await Promise.all([
          compareStrategyRuns(selectedId, compareIds),
          ...compareIds.map((runId) => getStrategyRunEquity(selectedId, runId).catch(() => null)),
        ]);
        if (!active) return;
        setComparison(result);
        setEquities(curves.filter((item): item is StrategyEquity => item !== null));
      } catch (err) {
        if (active) setError(isStrategiesApiError(err) ? err.message : "对比加载失败");
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId, compareIds]);

  const rerunPrompt = (version: StrategyVersion) =>
    `请重跑策略库中的策略：先用 strategy_get_latest 读取 ${selected?.name ?? "策略"}（${selectedId}），` +
    `若当前版本已是 v${version.version} 则直接使用；回测要求——策略代码与参数采用 v${version.version} 版本，` +
    `数据区间与交易规则与该版本最近一次回测保持一致（如无历史 run 则用近 2 年日线 + 默认 A 股规则），` +
    `跑完后按编排用 strategy_record_backtest 入库新 run（rules 原样抄录 a_share_rules 回显）。`;

  const equitySeries = useMemo(
    () =>
      equities.map((item, index) => ({
        label: `v${item.version}`,
        values: normalizeEquity(item.equity),
        color: RUN_COLORS[index % RUN_COLORS.length],
      })),
    [equities],
  );

  const metricKeys = [
    ["total_return_pct", "总收益 %"],
    ["annual_return_pct", "年化 %"],
    ["sharpe_ratio", "夏普"],
    ["max_drawdown_pct", "最大回撤 %"],
    ["win_rate_pct", "胜率 %"],
    ["trade_count", "交易次数"],
  ] as const;

  return (
    <main className="strategies-library report-library-page" aria-label="策略库">
      <div className="report-library-topbar">
        <div className="report-library-topbar-leading">
          <button className="icon-ghost" type="button" onClick={onBack} aria-label="返回任务页面" title="返回任务页面">
            <ArrowLeft size={17} />
          </button>
          <div className="report-library-title">
            <strong>策略库</strong>
            <span>版本化的策略资产：版本时间线 · 回测运行 · 跨版本对比</span>
          </div>
        </div>
        <div className="report-library-topbar-actions">
          <span className="report-count"><GitBranch size={13} />{strategies.length} 个策略</span>
          <button
            className="icon-ghost"
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label="刷新策略库"
            title="刷新策略库"
          >
            <RefreshCw size={16} className={refreshing ? "spin" : undefined} />
          </button>
        </div>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <div className="strategies-layout">
        <aside className="strategies-list">
          {loading ? (
            <p className="memory-loading">加载策略库…</p>
          ) : strategies.length === 0 ? (
            <p className="strategies-hint">暂无策略。在任务里让 agent 做「策略研究回测」并入库版本后，这里会出现策略资产。</p>
          ) : (
            strategies.map((strategy) => (
              <button
                key={strategy.strategy_id}
                type="button"
                className={`strategies-item ${strategy.strategy_id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(strategy.strategy_id)}
              >
                <span className="strategies-item-name">
                  <span className={`strategies-dot tone-${statusBadge(strategy.status).tone}`} aria-hidden="true" />
                  {strategy.name}
                </span>
                <span className="strategies-item-meta">
                  v{strategy.current_version} · {statusBadge(strategy.status).label}
                  {strategy.latest_run && typeof strategy.latest_run.metrics?.total_return_pct === "number" && (
                    <span className={`strategies-chip ${metricClass("total_return_pct", strategy.latest_run.metrics.total_return_pct)}`}>
                      收益 {metric(strategy.latest_run, "total_return_pct")}%
                    </span>
                  )}
                  {strategy.latest_run && typeof strategy.latest_run.metrics?.max_drawdown_pct === "number" && (
                    <span className={`strategies-chip ${metricClass("max_drawdown_pct", strategy.latest_run.metrics.max_drawdown_pct)}`}>
                      回撤 {metric(strategy.latest_run, "max_drawdown_pct")}%
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </aside>

        <section className="strategies-detail">
          {!selected ? (
            <p className="strategies-hint">从左侧选择一个策略查看版本时间线与回测对比。</p>
          ) : detailLoading ? (
            <p className="memory-loading">加载策略详情…</p>
          ) : (
            <>
              <header className="strategies-identity">
                <div className="strategies-identity-head">
                  <h2>{selected.name}</h2>
                  <span className={`strategies-badge tone-${statusBadge(selected.status).tone}`}>
                    {statusBadge(selected.status).label}
                  </span>
                </div>
                <p className="strategies-hypothesis">{selected.hypothesis || "（未写投资假设）"}</p>
                <p className="strategies-item-meta mono">
                  {selected.strategy_id} · 当前 v{selected.current_version} · 更新于 {formatDateTime(selected.updated_at)}
                </p>
              </header>

              <h3><GitBranch size={14} /> 版本时间线</h3>
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

              <h3>回测运行（勾选 2-4 个对比）</h3>
              {runs.length === 0 ? (
                <p className="strategies-hint">尚无回测运行记录。</p>
              ) : (
                <table className="data-table strategies-runs-table">
                  <thead>
                    <tr>
                      <th>对比</th>
                      <th>run</th>
                      <th>版本</th>
                      <th>区间</th>
                      <th>总收益 %</th>
                      <th>夏普</th>
                      <th>回撤 %</th>
                      <th>交易</th>
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
                        <td>{run.data_start || "?"} ~ {run.data_end || "?"}</td>
                        <td className={`num ${metricClass("total_return_pct", run.metrics?.total_return_pct)}`}>{metric(run, "total_return_pct")}</td>
                        <td className={`num ${metricClass("sharpe_ratio", run.metrics?.sharpe_ratio)}`}>{metric(run, "sharpe_ratio")}</td>
                        <td className={`num ${metricClass("max_drawdown_pct", run.metrics?.max_drawdown_pct)}`}>{metric(run, "max_drawdown_pct")}</td>
                        <td className="num">{metric(run, "trade_count")}</td>
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
                  {equitySeries.length >= 2 ? (
                    <div className="strategies-equity-chart">
                      <h4>净值曲线叠加（归一化）</h4>
                      <EquityOverlay series={equitySeries} />
                    </div>
                  ) : (
                    <p className="strategies-note">所选运行缺少净值数据（record_run 未存 equity），无法叠加曲线。</p>
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
