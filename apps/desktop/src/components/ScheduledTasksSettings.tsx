/**
 * 定时任务设置：管理周期性自动研究任务（引擎 scheduled-tasks + scheduler）。
 *
 * 任务由 gateway 内置 scheduler 到期自动执行（每次生成新线程跑 prompt，
 * 产物进入报告库）；桌面端负责创建/暂停/删除，任务完成经轮询发系统通知。
 * 注意：桌面 App 需保持运行（gateway 是其子进程）；停机期间错过的触发
 * 会在下次启动后补跑。
 */

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Pause, Play, Plus, Trash2 } from "lucide-react";
import {
  createScheduledTask,
  deleteScheduledTask,
  isScheduledTaskApiError,
  listScheduledTaskRuns,
  listScheduledTasks,
  pauseScheduledTask,
  resumeScheduledTask,
  type ScheduledTask,
  type ScheduledTaskRun,
} from "../lib/scheduledTasksClient";

const WEEKDAYS = [
  { value: "1", label: "周一" },
  { value: "2", label: "周二" },
  { value: "3", label: "周三" },
  { value: "4", label: "周四" },
  { value: "5", label: "周五" },
  { value: "6", label: "周六" },
  { value: "0", label: "周日" },
];

const DEFAULT_WEEKLY_PROMPT =
  "请生成本周 A 股市场全景周报：覆盖主要指数周度表现与资金流向、" +
  "板块轮动与行业强弱、市场联动指标（期指基差、期权隐含波动率、两融、" +
  "北向资金）、下周关注要点，并按报告交付规范输出 HTML 看板报告。";

function formatNextRun(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    enabled: "已启用",
    paused: "已暂停",
    running: "执行中",
    completed: "已完成（一次性）",
    failed: "失败",
    cancelled: "已取消",
    success: "成功",
    interrupted: "被中断",
    queued: "排队中",
  };
  return map[status] ?? status;
}

export function ScheduledTasksSettings() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("A 股市场全景周报");
  const [prompt, setPrompt] = useState(DEFAULT_WEEKLY_PROMPT);
  const [weekday, setWeekday] = useState("5");
  const [time, setTime] = useState("09:30");
  const [creating, setCreating] = useState(false);
  const [expandedRuns, setExpandedRuns] = useState<Record<string, ScheduledTaskRun[]>>({});

  const reload = useCallback(async () => {
    setError(null);
    try {
      setTasks(await listScheduledTasks());
    } catch (err) {
      setError(isScheduledTaskApiError(err) ? err.message : "加载定时任务失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = async () => {
    if (creating) return;
    if (!title.trim() || !prompt.trim()) {
      setError("标题和任务指令不能为空");
      return;
    }
    const [hour, minute] = time.split(":");
    if (!/^\d{2}:\d{2}$/.test(time) || Number(hour) > 23 || Number(minute) > 59) {
      setError("执行时间格式应为 HH:MM");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createScheduledTask({
        title: title.trim(),
        prompt: prompt.trim(),
        cron: `${Number(minute)} ${Number(hour)} * * ${weekday}`,
      });
      await reload();
    } catch (err) {
      setError(isScheduledTaskApiError(err) ? err.message : "创建定时任务失败");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (task: ScheduledTask) => {
    try {
      if (task.status === "paused") await resumeScheduledTask(task.id);
      else await pauseScheduledTask(task.id);
      await reload();
    } catch (err) {
      setError(isScheduledTaskApiError(err) ? err.message : "更新任务状态失败");
    }
  };

  const handleDelete = async (task: ScheduledTask) => {
    if (!confirm(`确定删除定时任务「${task.title}」？`)) return;
    try {
      await deleteScheduledTask(task.id);
      await reload();
    } catch (err) {
      setError(isScheduledTaskApiError(err) ? err.message : "删除任务失败");
    }
  };

  const handleShowRuns = async (task: ScheduledTask) => {
    if (expandedRuns[task.id]) {
      setExpandedRuns((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      return;
    }
    try {
      const runs = await listScheduledTaskRuns(task.id, 10);
      setExpandedRuns((current) => ({ ...current, [task.id]: runs }));
    } catch (err) {
      setError(isScheduledTaskApiError(err) ? err.message : "读取执行历史失败");
    }
  };

  return (
    <section className="settings-card" aria-label="定时任务配置">
      <div className="runtime-config-header">
        <div>
          <strong>定时任务（周期性自动研究）</strong>
          <p className="runtime-config-desc">
            到期由 gateway 自动执行（每次新建任务线程），产物进入报告库并在完成时发系统通知。
            应用需保持运行；错过的触发会在下次启动后补跑。需重启 gateway 一次以启用调度器（新版本已默认启用）。
          </p>
        </div>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <div className="rcf-field">
        <label className="rcf-label" htmlFor="st-title">
          <span className="rcf-label-text">任务标题</span>
        </label>
        <div className="rcf-control">
          <input
            id="st-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A 股市场全景周报"
          />
        </div>
      </div>

      <div className="rcf-field">
        <label className="rcf-label" htmlFor="st-prompt">
          <span className="rcf-label-text">任务指令</span>
          <span className="rcf-hint">到期后作为用户消息发给 Lead Agent</span>
        </label>
        <div className="rcf-control">
          <textarea
            id="st-prompt"
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
      </div>

      <div className="rcf-field">
        <label className="rcf-label" htmlFor="st-weekday">
          <span className="rcf-label-text">执行周期</span>
        </label>
        <div className="rcf-control" style={{ display: "flex", gap: "8px" }}>
          <select
            id="st-weekday"
            value={weekday}
            onChange={(e) => setWeekday(e.target.value)}
            style={{ flex: "0 0 120px" }}
          >
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="执行时间"
            style={{ flex: "0 0 120px" }}
          />
          <button className="hero-primary" type="button" onClick={handleCreate} disabled={creating}>
            <Plus size={13} /> {creating ? "创建中…" : "创建任务"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="memory-loading">加载定时任务…</p>
      ) : tasks.length === 0 ? (
        <p className="mcp-empty">暂无定时任务。创建一个周报任务试试。</p>
      ) : (
        <div className="mcp-server-list">
          {tasks.map((task) => (
            <div key={task.id} className="mcp-server-row">
              <div className="mcp-server-info">
                <span className="mcp-server-name">{task.title}</span>
                <span className={`mcp-server-type mcp-type-${task.status === "paused" ? "sse" : "http"}`}>
                  {statusLabel(task.status)}
                </span>
                {task.last_error && (
                  <span className="mcp-server-desc" title={task.last_error}>
                    上次错误：{task.last_error.slice(0, 60)}
                  </span>
                )}
              </div>
              <div className="mcp-server-actions">
                <span className="mcp-server-desc">下次 {formatNextRun(task.next_run_at)}</span>
                <button className="link-button" type="button" onClick={() => handleShowRuns(task)}>
                  <CalendarClock size={13} /> {expandedRuns[task.id] ? "收起历史" : "执行历史"}
                </button>
                {task.status !== "completed" && task.status !== "cancelled" && (
                  <button className="link-button" type="button" onClick={() => handleToggle(task)}>
                    {task.status === "paused" ? <Play size={13} /> : <Pause size={13} />}
                    {task.status === "paused" ? "恢复" : "暂停"}
                  </button>
                )}
                <button className="link-button" type="button" onClick={() => handleDelete(task)}>
                  <Trash2 size={13} /> 删除
                </button>
              </div>
              {expandedRuns[task.id] && (
                <div style={{ width: "100%" }}>
                  {expandedRuns[task.id].length === 0 ? (
                    <p className="mcp-empty">还没有执行记录</p>
                  ) : (
                    expandedRuns[task.id].map((run) => (
                      <p key={run.id} className="mcp-server-desc">
                        {formatNextRun(run.started_at ?? run.finished_at)} · {statusLabel(run.status)}
                        {run.error ? ` · ${run.error.slice(0, 80)}` : ""}
                      </p>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
