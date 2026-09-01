/**
 * 选股库视图：选股方案列表 + 要求版本时间线 + 运行归档 + 跨期对比。
 *
 * 与策略库/因子库视图同构：选股方案是持续迭代的活资产，要求版本不可变
 * （调口径=新版本），运行归档锁定「要求版本 × 基准日 × 股票池 × 执行口径」，
 * 保存完整选股报告与命中清单；对比视图对齐口径并做命中重合分析
 * （以所选第一个运行为基准：保留 / 新增 / 剔除）。
 * 「重跑本方案」把编排 prompt 预填到工作台输入框。
 * 样式复用 strategies-* 通用库布局类（列表/详情/时间线/表格）。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ListChecks, Play, RefreshCw } from "lucide-react";
import {
  compareSelectionRuns,
  getSelectionRunPicks,
  getSelectionRunReport,
  isSelectionsApiError,
  listSelectionRuns,
  listSelections,
  listSelectionVersions,
  type Selection,
  type SelectionRunComparison,
  type SelectionRunPicks,
  type SelectionRunSummary,
  type SelectionVersion,
} from "../lib/selectionsClient";

/** 数值语义：共振股 > 0 绿色（多策略共振信号），其余计数中性。 */
function metricClass(key: string, value: unknown): string {
  if (typeof value !== "number") return "";
  if (key === "consensus_count") return value > 0 ? "value-up" : "";
  return "";
}

function metric(run: SelectionRunSummary, key: string): string {
  const value = run.metrics?.[key];
  if (typeof value === "number") return String(value);
  return "—";
}

function statusBadge(status: string): { label: string; tone: string } {
  const map: Record<string, { label: string; tone: string }> = {
    watching: { label: "跟踪中", tone: "live" },
    archived: { label: "已归档", tone: "idle" },
    closed: { label: "已停用", tone: "bad" },
  };
  return map[status] ?? { label: status, tone: "idle" };
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function criteriaSummary(version: SelectionVersion): string {
  const summary = version.criteria?.summary;
  if (typeof summary === "string" && summary.trim()) return summary;
  const keys = Object.keys(version.criteria ?? {});
  return keys.length > 0 ? `（口径字段：${keys.join(" / ")}）` : "（空口径）";
}

/** 命中清单 → 股票代码集合（对比重合分析用）。 */
function pickCodes(picks: SelectionRunPicks["picks"]): Set<string> {
  return new Set(
    picks
      .map((item) => (typeof item?.code === "string" ? item.code : null))
      .filter((code): code is string => Boolean(code)),
  );
}

export function SelectionsLibrary({
  onBack,
  onRerun,
}: {
  onBack: () => void;
  /** 预填重跑 prompt 并回到工作台。 */
  onRerun: (prompt: string) => void;
}) {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<SelectionVersion[]>([]);
  const [runs, setRuns] = useState<SelectionRunSummary[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<SelectionRunComparison | null>(null);
  const [picksList, setPicksList] = useState<SelectionRunPicks[]>([]);
  const [reportView, setReportView] = useState<{ runId: string; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setSelections(await listSelections());
    } catch (err) {
      setError(isSelectionsApiError(err) ? err.message : "加载选股库失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 手动刷新：列表 + 选中方案的版本/运行详情一起重拉（agent 刚跑完选股时靠它看到新数据）。 */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const list = await listSelections();
      setSelections(list);
      if (selectedId) {
        const [versionList, runList] = await Promise.all([
          listSelectionVersions(selectedId),
          listSelectionRuns(selectedId),
        ]);
        setVersions(versionList);
        setRuns(runList);
      }
    } catch (err) {
      setError(isSelectionsApiError(err) ? err.message : "刷新选股库失败");
    } finally {
      setRefreshing(false);
    }
  }, [selectedId]);

  const selected = selections.find((item) => item.selection_id === selectedId) ?? null;

  const loadDetail = useCallback(async (selectionId: string) => {
    setDetailLoading(true);
    setCompareIds([]);
    setComparison(null);
    setPicksList([]);
    setReportView(null);
    setError(null);
    try {
      const [versionList, runList] = await Promise.all([
        listSelectionVersions(selectionId),
        listSelectionRuns(selectionId),
      ]);
      setVersions(versionList);
      setRuns(runList);
    } catch (err) {
      setError(isSelectionsApiError(err) ? err.message : "加载方案详情失败");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const toggleCompare = (runId: string) => {
    setReportView(null);
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
      setPicksList([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [result, ...picks] = await Promise.all([
          compareSelectionRuns(selectedId, compareIds),
          ...compareIds.map((runId) => getSelectionRunPicks(selectedId, runId).catch(() => null)),
        ]);
        if (!active) return;
        setComparison(result);
        setPicksList(picks.filter((item): item is SelectionRunPicks => item !== null));
      } catch (err) {
        if (active) setError(isSelectionsApiError(err) ? err.message : "对比加载失败");
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId, compareIds]);

  const showReport = useCallback(
    async (runId: string) => {
      if (!selectedId) return;
      if (reportView?.runId === runId) {
        setReportView(null);
        return;
      }
      try {
        const result = await getSelectionRunReport(selectedId, runId);
        setReportView({ runId, text: result.report });
      } catch (err) {
        setError(isSelectionsApiError(err) ? err.message : "报告加载失败");
      }
    },
    [selectedId, reportView],
  );

  const rerunPrompt = (version: SelectionVersion) =>
    `请重跑选股库中的方案：先用 selection_get_latest 读取 ${selected?.name ?? "方案"}（${selectedId}），` +
    `若当前版本已是 v${version.version} 则直接按库内口径执行；选股要求采用 v${version.version} 版本口径，` +
    `股票池与执行口径与该版本最近一次 run 保持一致（如无历史 run 则按澄清表单默认口径），` +
    `跑完后按编排用 selection_record_run 入库新 run（report 报告全文 + picks 命中清单 + rules 口径回显）。`;

  /** 命中重合分析：以所选第一个运行为基准，统计其余运行的保留/新增/剔除。 */
  const overlapRows = useMemo(() => {
    if (picksList.length < 2) return [];
    const [base, ...rest] = picksList;
    const baseCodes = pickCodes(base.picks);
    return rest.map((item) => {
      const codes = pickCodes(item.picks);
      const kept = [...codes].filter((code) => baseCodes.has(code));
      const added = [...codes].filter((code) => !baseCodes.has(code));
      const removed = [...baseCodes].filter((code) => !codes.has(code));
      return {
        run: item,
        keptCount: kept.length,
        addedCount: added.length,
        removedCount: removed.length,
        keptSample: kept.slice(0, 5),
        addedSample: added.slice(0, 5),
      };
    });
  }, [picksList]);

  const metricKeys = [
    ["hit_count", "命中数"],
    ["strategy_count", "策略数"],
    ["consensus_count", "共振股数"],
    ["top_n", "TopN"],
  ] as const;

  return (
    <main className="strategies-library report-library-page" aria-label="选股库">
      <div className="report-library-topbar">
        <div className="report-library-topbar-leading">
          <button className="icon-ghost" type="button" onClick={onBack} aria-label="返回任务页面" title="返回任务页面">
            <ArrowLeft size={17} />
          </button>
          <div className="report-library-title">
            <strong>选股库</strong>
            <span>版本化的选股方案：要求时间线 · 运行报告归档 · 跨期命中对比</span>
          </div>
        </div>
        <div className="report-library-topbar-actions">
          <span className="report-count"><ListChecks size={13} />{selections.length} 个方案</span>
          <button
            className="icon-ghost"
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label="刷新选股库"
            title="刷新选股库"
          >
            <RefreshCw size={16} className={refreshing ? "spin" : undefined} />
          </button>
        </div>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <div className="strategies-layout">
        <aside className="strategies-list">
          {loading ? (
            <p className="memory-loading">加载选股库…</p>
          ) : selections.length === 0 ? (
            <p className="strategies-hint">暂无方案。在任务里让 agent 做「选股/策略扫描」并入库后，这里会出现选股方案资产。</p>
          ) : (
            selections.map((selection) => (
              <button
                key={selection.selection_id}
                type="button"
                className={`strategies-item ${selection.selection_id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(selection.selection_id)}
              >
                <span className="strategies-item-name">
                  <span className={`strategies-dot tone-${statusBadge(selection.status).tone}`} aria-hidden="true" />
                  {selection.name}
                </span>
                <span className="strategies-item-meta">
                  v{selection.current_version} · {statusBadge(selection.status).label}
                  {selection.latest_run && typeof selection.latest_run.metrics?.hit_count === "number" && (
                    <span className="strategies-chip">命中 {metric(selection.latest_run, "hit_count")}</span>
                  )}
                  {selection.latest_run?.trade_date && (
                    <span className="strategies-chip">{selection.latest_run.trade_date}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </aside>

        <section className="strategies-detail">
          {!selected ? (
            <p className="strategies-hint">从左侧选择一个方案查看要求时间线与运行归档。</p>
          ) : detailLoading ? (
            <p className="memory-loading">加载方案详情…</p>
          ) : (
            <>
              <header className="strategies-identity">
                <div className="strategies-identity-head">
                  <h2>{selected.name}</h2>
                  <span className={`strategies-badge tone-${statusBadge(selected.status).tone}`}>
                    {statusBadge(selected.status).label}
                  </span>
                </div>
                <p className="strategies-hypothesis">{selected.criteria || "（未写选股要求口径）"}</p>
                <p className="strategies-item-meta mono">
                  {selected.selection_id} · 当前 v{selected.current_version} · 更新于 {formatDateTime(selected.updated_at)}
                </p>
              </header>

              <h3><ListChecks size={14} /> 要求版本时间线</h3>
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
                            <span className="strategies-item-meta">{formatDateTime(version.created_at)}</span>
                          </div>
                          <p className="strategies-change-note">{criteriaSummary(version)}</p>
                          <p className="strategies-item-meta">{version.change_note || "（无变更说明）"}</p>
                          <button className="link-button strategies-rerun" type="button" onClick={() => onRerun(rerunPrompt(version))}>
                            <Play size={12} /> 重跑本版本
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <h3>运行归档（勾选 2-4 个对比）</h3>
              {runs.length === 0 ? (
                <p className="strategies-hint">尚无运行归档。</p>
              ) : (
                <table className="data-table strategies-runs-table">
                  <thead>
                    <tr>
                      <th>对比</th>
                      <th>run</th>
                      <th>版本</th>
                      <th>基准日</th>
                      <th>股票池</th>
                      <th>命中</th>
                      <th>共振</th>
                      <th>TopN</th>
                      <th>时间</th>
                      <th>报告</th>
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
                        <td>{run.trade_date || "—"}</td>
                        <td>{run.universe || "—"}</td>
                        <td className="num">{metric(run, "hit_count")}</td>
                        <td className={`num ${metricClass("consensus_count", run.metrics?.consensus_count)}`}>{metric(run, "consensus_count")}</td>
                        <td className="num">{metric(run, "top_n")}</td>
                        <td>{formatDateTime(run.created_at)}</td>
                        <td>
                          {run.report_path ? (
                            <button className="link-button" type="button" onClick={() => void showReport(run.run_id)}>
                              {reportView?.runId === run.run_id ? "收起" : "查看"}
                            </button>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportView && (
                <div className="strategies-compare">
                  <h4>运行报告（{reportView.runId.slice(5, 13)}）</h4>
                  <pre className="strategies-note strategies-report-view">{reportView.text}</pre>
                </div>
              )}

              {comparison && (
                <div className="strategies-compare">
                  <h3>运行对比{comparison.comparable ? "（同口径，可严格对比）" : "（口径不一致，仅供参考）"}</h3>
                  {!comparison.comparable && comparison.notes.map((note) => <p key={note} className="strategies-note">{note}</p>)}
                  <table className="data-table strategies-runs-table">
                    <thead>
                      <tr>
                        <th>指标</th>
                        {comparison.runs.map((run) => (
                          <th key={run.run_id} className="mono">v{run.version} · {run.trade_date || run.run_id.slice(5, 13)}</th>
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
                  {overlapRows.length >= 1 ? (
                    <div className="strategies-equity-chart">
                      <h4>命中重合分析（基准：v{picksList[0].version} · {picksList[0].trade_date || picksList[0].run_id.slice(5, 13)}）</h4>
                      <table className="data-table strategies-runs-table">
                        <thead>
                          <tr>
                            <th>run</th>
                            <th>基准日</th>
                            <th>保留</th>
                            <th>新增</th>
                            <th>剔除</th>
                            <th>保留样例</th>
                            <th>新增样例</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overlapRows.map((row) => (
                            <tr key={row.run.run_id}>
                              <td className="mono">v{row.run.version} · {row.run.run_id.slice(5, 13)}</td>
                              <td>{row.run.trade_date || "—"}</td>
                              <td className="num">{row.keptCount}</td>
                              <td className="num">{row.addedCount}</td>
                              <td className="num">{row.removedCount}</td>
                              <td className="mono">{row.keptSample.join("、") || "—"}</td>
                              <td className="mono">{row.addedSample.join("、") || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="strategies-note">所选运行缺少命中清单数据（selection_record_run 未存 picks），无法做重合分析。</p>
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
