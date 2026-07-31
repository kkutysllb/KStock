import { Plus } from "lucide-react";
import type { ChatSession } from "../lib/sessionStore";

interface WorkspaceSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
}

export function WorkspaceSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession
}: WorkspaceSidebarProps) {
  return (
    <aside className="panel sidebar" aria-label="会话列表">
      <div className="panel-heading">
        <div>
          <h2>会话</h2>
          <p>研究工作区</p>
        </div>
        <button className="icon-button" type="button" onClick={onCreateSession} aria-label="新建会话">
          <Plus size={16} />
        </button>
      </div>
      <div className="session-list" role="list">
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
            onClick={() => onSelectSession(session.id)}
          >
            <strong>{session.title}</strong>
            <span>{session.updatedAt}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
