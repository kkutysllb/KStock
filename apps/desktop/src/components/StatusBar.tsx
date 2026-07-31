import { Activity } from "lucide-react";

interface StatusBarProps {
  sessionCount: number;
  activeSkillCount: number;
  syncLabel: string;
}

export function StatusBar({ sessionCount, activeSkillCount, syncLabel }: StatusBarProps) {
  return (
    <footer className="status-bar" aria-label="状态栏">
      <span>
        <Activity size={14} />
        <strong>引擎就绪</strong>
      </span>
      <span>会话 {sessionCount}</span>
      <span>技能 {activeSkillCount}</span>
      <span>{syncLabel}</span>
    </footer>
  );
}
