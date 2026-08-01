// 并行 subagent 分组（引擎 task_tool 产出，按 taskId 分组）：
// - 标题行：description + model + status 徽章
// - 嵌套 steps（subagent 的 ai 消息文本 + 其工具调用，用 ToolCard 渲染）

import { AlertCircle, Check, Clock, Loader2, X } from "lucide-react";
import type { SubagentStep, SubagentTask } from "../lib/sessionStore";
import { ToolCard } from "./ToolCard";

interface SubagentGroupProps {
  task: SubagentTask;
  showToolCalls?: boolean;
}

export function SubagentGroup({ task, showToolCalls = true }: SubagentGroupProps) {
  return (
    <div
      className={`subagent-group status-${task.status}`}
      aria-label={`子代理 ${task.description ?? task.taskId}`}
    >
      <div className="subagent-header">
        <SubagentStatusIcon status={task.status} />
        <span className="subagent-description">{task.description ?? "子任务"}</span>
        {task.model && <span className="subagent-model">{task.model}</span>}
        <span className="subagent-status-label">{statusLabel(task.status)}</span>
      </div>
      {task.steps.length > 0 && (
        <div className="subagent-steps">
          {task.steps.map((step) => (
            <SubagentStepView key={step.index} step={step} showToolCalls={showToolCalls} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubagentStepView({ step, showToolCalls }: { step: SubagentStep; showToolCalls: boolean }) {
  return (
    <div className="subagent-step">
      {step.text && <div className="subagent-step-text">{step.text}</div>}
      {showToolCalls && step.toolCalls?.map((tc) => <ToolCard key={tc.id} call={tc} />)}
    </div>
  );
}

function SubagentStatusIcon({ status }: { status: SubagentTask["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 size={13} className="spin" />;
    case "completed":
      return <Check size={13} />;
    case "failed":
      return <AlertCircle size={13} />;
    case "cancelled":
      return <X size={13} />;
    case "timed_out":
      return <Clock size={13} />;
  }
}

function statusLabel(status: SubagentTask["status"]): string {
  switch (status) {
    case "running":
      return "进行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    case "timed_out":
      return "超时";
  }
}
