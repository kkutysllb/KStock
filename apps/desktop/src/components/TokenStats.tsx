import { useCallback, useEffect, useMemo, useState } from "react";
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

function chartPoints(days: TokenStatsDay[], key: "input_tokens" | "output_tokens") {
  if (days.length === 0) return "";
  const max = Math.max(...days.map((day) => day[key]), 1);
  return days.map((day, index) => {
    const x = days.length === 1 ? 300 : (index / (days.length - 1)) * 600;
    const y = 148 - (day[key] / max) * 122;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function activityHeight(value: number, max: number) {
  return Math.max(3, (value / Math.max(max, 1)) * 118);
}

export function TokenStats() {
  const [stats, setStats] = useState<TokenStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const tokenMax = Math.max(...stats.days.map((day) => Math.max(day.input_tokens, day.output_tokens)), 1);
  const activityMax = Math.max(...stats.days.map((day) => Math.max(day.api_calls, day.completed_tasks)), 1);

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
          <div className="token-chart-heading"><div><strong>输入 / 输出趋势</strong><span>按天统计 Token 使用量</span></div><span className="token-chart-total">{formatNumber(stats.total_tokens)} total</span></div>
          <div className="token-line-legend"><span className="token-line-legend-input">输入</span><span className="token-line-legend-output">输出</span></div>
          <svg className="token-line-chart" viewBox="0 0 600 170" role="img" aria-label="输入和输出 Token 趋势图">
            {[26, 67, 108, 148].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} className="token-chart-grid" />)}
            <polyline points={chartPoints(stats.days, "input_tokens")} className="token-chart-line token-chart-line--input" />
            <polyline points={chartPoints(stats.days, "output_tokens")} className="token-chart-line token-chart-line--output" />
          </svg>
          <div className="token-chart-axis"><span>{stats.days[0]?.date.slice(5) ?? "-"}</span><span>{stats.days[Math.floor(stats.days.length / 2)]?.date.slice(5) ?? "-"}</span><span>{stats.days[stats.days.length - 1]?.date.slice(5) ?? "-"}</span></div>
          <span className="sr-only">趋势最大值 {formatNumber(tokenMax)} Token</span>
        </article>

        <article className="token-chart-card">
          <div className="token-chart-heading"><div><strong>任务与 API 活跃度</strong><span>每日完成任务和调用次数</span></div><span className="token-chart-total">{formatNumber(stats.total_runs)} runs</span></div>
          <div className="token-bar-legend"><span className="token-bar-legend-tasks">任务</span><span className="token-bar-legend-api">API</span></div>
          <div className="token-bar-chart" role="img" aria-label="每日任务完成次数和 API 调用次数柱状图">
            {stats.days.map((day) => (
              <div className="token-bar-day" key={day.date} title={`${day.date}: ${day.completed_tasks} 个任务，${day.api_calls} 次 API 调用`}>
                <span className="token-bar token-bar--tasks" style={{ height: `${activityHeight(day.completed_tasks, activityMax)}px` }} />
                <span className="token-bar token-bar--api" style={{ height: `${activityHeight(day.api_calls, activityMax)}px` }} />
              </div>
            ))}
          </div>
          <div className="token-chart-axis"><span>{stats.days[0]?.date.slice(5) ?? "-"}</span><span>{stats.days[Math.floor(stats.days.length / 2)]?.date.slice(5) ?? "-"}</span><span>{stats.days[stats.days.length - 1]?.date.slice(5) ?? "-"}</span></div>
          <span className="sr-only">活跃度最大值 {formatNumber(activityMax)}</span>
        </article>
      </div>

      {error && <p className="token-stats-inline-error" role="status">{error}</p>}
    </section>
  );
}
