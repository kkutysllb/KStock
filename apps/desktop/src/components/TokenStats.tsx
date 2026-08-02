import { useCallback, useEffect, useMemo, useState, type PointerEvent } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Database,
  RefreshCw,
} from "lucide-react";
import {
  getTokenStats,
  isTokenStatsApiError,
  type TokenStatsDay,
  type TokenStatsResponse,
} from "../lib/tokenStatsClient";

type StatCard = {
  label: string;
  value: string;
  detail: string;
  icon: typeof CheckCircle2;
  accent: string;
};

const formatNumber = (value: number) => new Intl.NumberFormat("zh-CN").format(value || 0);

const CHART_WIDTH = 600;
const CHART_TOP = 26;
const CHART_BASELINE = 148;
const CHART_HEIGHT = CHART_BASELINE - CHART_TOP;

function chartX(index: number, count: number) {
  return count <= 1 ? CHART_WIDTH / 2 : (index / (count - 1)) * CHART_WIDTH;
}

function chartY(value: number, max: number) {
  return CHART_BASELINE - (value / Math.max(max, 1)) * CHART_HEIGHT;
}

function nearestDayIndex(event: PointerEvent<SVGSVGElement>, count: number) {
  if (count <= 1) return 0;
  const bounds = event.currentTarget.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(bounds.width, 1)));
  return Math.round(ratio * (count - 1));
}

function areaPath(days: TokenStatsDay[], key: "completed_tasks" | "api_calls", max: number) {
  if (days.length === 0) return "";
  const points = days.map((day, index) => {
    const x = chartX(index, days.length);
    const y = chartY(day[key], max);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const firstX = chartX(0, days.length).toFixed(1);
  const lastX = chartX(days.length - 1, days.length).toFixed(1);
  return `M ${firstX},${CHART_BASELINE} L ${points.join(" L ")} L ${lastX},${CHART_BASELINE} Z`;
}

function stackedBarRects(days: TokenStatsDay[], max: number) {
  if (days.length === 0) return [];
  const groupWidth = CHART_WIDTH / days.length;
  const barWidth = Math.min(16, Math.max(4, groupWidth * 0.62));
  return days.map((day, index) => {
    const total = day.input_tokens + day.output_tokens;
    const totalHeight = (total / Math.max(max, 1)) * CHART_HEIGHT;
    const inputHeight = (day.input_tokens / Math.max(max, 1)) * CHART_HEIGHT;
    const x = index * groupWidth + (groupWidth - barWidth) / 2;
    const baseY = CHART_BASELINE - totalHeight;
    return {
      day,
      x,
      width: barWidth,
      inputY: CHART_BASELINE - inputHeight,
      inputHeight,
      outputY: baseY,
      outputHeight: totalHeight - inputHeight,
    };
  });
}

export function TokenStats() {
  const [stats, setStats] = useState<TokenStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenHoverIndex, setTokenHoverIndex] = useState<number | null>(null);
  const [activityHoverIndex, setActivityHoverIndex] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await getTokenStats(30));
    } catch (err) {
      setError(isTokenStatsApiError(err) ? err.message : "Token 统计加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const cards = useMemo<StatCard[]>(() => {
    if (!stats) return [];
    return [
      { label: "任务完成次数", value: formatNumber(stats.completed_tasks), detail: "近 30 天成功完成", icon: CheckCircle2, accent: "mint" },
      { label: "API 调用次数", value: formatNumber(stats.api_calls), detail: "模型请求累计次数", icon: Activity, accent: "blue" },
      { label: "输入 Token", value: formatNumber(stats.input_tokens), detail: "提示词与上下文", icon: ArrowDownToLine, accent: "amber" },
      { label: "输出 Token", value: formatNumber(stats.output_tokens), detail: "模型生成内容", icon: ArrowUpFromLine, accent: "violet" },
      { label: "缓存命中率", value: `${stats.cache_hit_rate.toFixed(1)}%`, detail: `${formatNumber(stats.cache_read_tokens)} 个缓存 Token`, icon: Database, accent: "teal" },
    ];
  }, [stats]);

  if (loading && !stats) {
    return (
      <section className="token-stats settings-card" aria-label="Token 统计">
        <div className="token-stats-heading"><div><strong>Token 统计</strong><p>正在读取最近 30 天的任务用量</p></div></div>
        <p className="memory-loading">加载统计数据…</p>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="token-stats settings-card" aria-label="Token 统计">
        <div className="token-stats-heading">
          <div><strong>Token 统计</strong><p>按任务和模型请求汇总用量</p></div>
          <button className="link-button" type="button" onClick={reload}><RefreshCw size={14} />重试</button>
        </div>
        <p className="token-stats-error" role="alert">{error ?? "暂无统计数据"}</p>
      </section>
    );
  }

  const tokenMax = Math.max(...stats.days.map((day) => day.input_tokens + day.output_tokens), 1);
  const taskMax = Math.max(...stats.days.map((day) => day.completed_tasks), 1);
  const apiMax = Math.max(...stats.days.map((day) => day.api_calls), 1);
  const tokenBars = stackedBarRects(stats.days, tokenMax);
  const tokenHoverDay = tokenHoverIndex === null ? null : stats.days[tokenHoverIndex] ?? null;
  const tokenHoverBar = tokenHoverIndex === null ? null : tokenBars[tokenHoverIndex] ?? null;
  const activityHoverDay = activityHoverIndex === null ? null : stats.days[activityHoverIndex] ?? null;

  return (
    <section className="token-stats" aria-label="Token 统计">
      <div className="token-stats-heading">
        <div><strong>Token 统计</strong><p>近 30 天任务消耗与模型调用概览</p></div>
        <div className="token-stats-heading-actions">
          {loading && <span className="token-stats-refreshing">更新中</span>}
          <button className="link-button" type="button" onClick={reload} disabled={loading} aria-label="刷新 Token 统计">
            <RefreshCw size={14} />刷新
          </button>
        </div>
      </div>

      <div className="token-stats-cards">
        {cards.map(({ label, value, detail, icon: Icon, accent }) => (
          <article className={`token-stat-card token-stat-card--${accent}`} key={label}>
            <div className="token-stat-card-top"><span>{label}</span><Icon size={15} /></div>
            <strong>{value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>

      <div className="token-stats-charts">
        <article className="token-chart-card">
          <div className="token-chart-heading"><div><strong>输入 / 输出 Token</strong><span>按天堆叠显示 Token 使用量</span></div><span className="token-chart-total">{formatNumber(stats.total_tokens)} total</span></div>
          <div className="token-stack-legend"><span className="token-stack-legend-input">输入</span><span className="token-stack-legend-output">输出</span></div>
          <div className="token-chart-plot">
            <svg
              className="token-stack-chart"
              viewBox="0 0 600 170"
              role="img"
              aria-label="输入和输出 Token 堆叠柱状图"
              onPointerMove={(event) => setTokenHoverIndex(nearestDayIndex(event, stats.days.length))}
              onPointerLeave={() => setTokenHoverIndex(null)}
            >
              {[26, 67, 108, 148].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} className="token-chart-grid" />)}
              {tokenBars.map(({ day, x, width, inputY, inputHeight, outputY, outputHeight }) => (
                <g key={day.date}>
                  <rect x={x} y={inputY} width={width} height={inputHeight} className="token-stack-bar token-stack-bar--input" />
                  <rect x={x} y={outputY} width={width} height={outputHeight} className="token-stack-bar token-stack-bar--output" />
                </g>
              ))}
              {tokenHoverBar && (
                <g className="token-chart-hover-marks" aria-hidden="true">
                  <line x1={tokenHoverBar.x + tokenHoverBar.width / 2} x2={tokenHoverBar.x + tokenHoverBar.width / 2} y1={CHART_TOP} y2={CHART_BASELINE} className="token-chart-crosshair" />
                  <circle cx={tokenHoverBar.x + tokenHoverBar.width / 2} cy={tokenHoverBar.inputY} r="4" className="token-chart-point token-chart-point--input" />
                  <circle cx={tokenHoverBar.x + tokenHoverBar.width / 2} cy={tokenHoverBar.outputY} r="4" className="token-chart-point token-chart-point--output" />
                </g>
              )}
              <rect x="0" y="0" width={CHART_WIDTH} height="170" className="token-chart-hit-area" />
            </svg>
            {tokenHoverDay && tokenHoverBar && (
              <div
                className={`token-chart-tooltip ${tokenHoverIndex !== null && tokenHoverIndex >= stats.days.length / 2 ? "align-end" : ""}`}
                style={{ left: `${((tokenHoverBar.x + tokenHoverBar.width / 2) / CHART_WIDTH) * 100}%` }}
                role="tooltip"
              >
                <strong>{tokenHoverDay.date}</strong>
                <div className="token-chart-tooltip-row token-tooltip-input"><span>输入</span><b>{formatNumber(tokenHoverDay.input_tokens)}</b></div>
                <div className="token-chart-tooltip-row token-tooltip-output"><span>输出</span><b>{formatNumber(tokenHoverDay.output_tokens)}</b></div>
                <div className="token-chart-tooltip-row token-tooltip-total"><span>合计</span><b>{formatNumber(tokenHoverDay.total_tokens)}</b></div>
              </div>
            )}
          </div>
          <div className="token-chart-axis"><span>{stats.days[0]?.date.slice(5) ?? "-"}</span><span>{stats.days[Math.floor(stats.days.length / 2)]?.date.slice(5) ?? "-"}</span><span>{stats.days[stats.days.length - 1]?.date.slice(5) ?? "-"}</span></div>
          <span className="sr-only">每日输入输出堆叠最大值 {formatNumber(tokenMax)} Token</span>
        </article>

        <article className="token-chart-card">
          <div className="token-chart-heading"><div><strong>任务 / API 活跃度</strong><span>双轴面积图，按各自数量级显示</span></div><span className="token-chart-total">{formatNumber(stats.api_calls)} calls</span></div>
          <div className="token-area-legend"><span className="token-area-legend-tasks">任务完成</span><span className="token-area-legend-api">API 调用</span></div>
          <div className="token-area-axis-labels"><span>任务 {formatNumber(taskMax)}</span><span>API {formatNumber(apiMax)}</span></div>
          <div className="token-chart-plot">
            <svg
              className="token-area-chart"
              viewBox="0 0 600 170"
              role="img"
              aria-label="任务完成次数和 API 调用次数双轴面积图"
              onPointerMove={(event) => setActivityHoverIndex(nearestDayIndex(event, stats.days.length))}
              onPointerLeave={() => setActivityHoverIndex(null)}
            >
              {[26, 67, 108, 148].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} className="token-chart-grid" />)}
              <path d={areaPath(stats.days, "completed_tasks", taskMax)} className="token-area-fill token-area-fill--tasks" />
              <path d={areaPath(stats.days, "api_calls", apiMax)} className="token-area-fill token-area-fill--api" />
              {activityHoverDay && activityHoverIndex !== null && (
                <g className="token-chart-hover-marks" aria-hidden="true">
                  <line x1={chartX(activityHoverIndex, stats.days.length)} x2={chartX(activityHoverIndex, stats.days.length)} y1={CHART_TOP} y2={CHART_BASELINE} className="token-chart-crosshair" />
                  <circle cx={chartX(activityHoverIndex, stats.days.length)} cy={chartY(activityHoverDay.completed_tasks, taskMax)} r="4" className="token-chart-point token-chart-point--tasks" />
                  <circle cx={chartX(activityHoverIndex, stats.days.length)} cy={chartY(activityHoverDay.api_calls, apiMax)} r="4" className="token-chart-point token-chart-point--api" />
                </g>
              )}
              <rect x="0" y="0" width={CHART_WIDTH} height="170" className="token-chart-hit-area" />
            </svg>
            {activityHoverDay && activityHoverIndex !== null && (
              <div
                className={`token-chart-tooltip ${activityHoverIndex >= stats.days.length / 2 ? "align-end" : ""}`}
                style={{ left: `${(chartX(activityHoverIndex, stats.days.length) / CHART_WIDTH) * 100}%` }}
                role="tooltip"
              >
                <strong>{activityHoverDay.date}</strong>
                <div className="token-chart-tooltip-row token-tooltip-tasks"><span>任务完成</span><b>{formatNumber(activityHoverDay.completed_tasks)}</b></div>
                <div className="token-chart-tooltip-row token-tooltip-api"><span>API 调用</span><b>{formatNumber(activityHoverDay.api_calls)}</b></div>
              </div>
            )}
          </div>
          <div className="token-chart-axis"><span>{stats.days[0]?.date.slice(5) ?? "-"}</span><span>{stats.days[Math.floor(stats.days.length / 2)]?.date.slice(5) ?? "-"}</span><span>{stats.days[stats.days.length - 1]?.date.slice(5) ?? "-"}</span></div>
          <span className="sr-only">任务最大值 {formatNumber(taskMax)}，API 调用最大值 {formatNumber(apiMax)}</span>
        </article>
      </div>

      {error && <p className="token-stats-inline-error" role="status">{error}</p>}
    </section>
  );
}
