import { useMemo, useState } from "react";
import { ChatPanel } from "../components/ChatPanel";
import { ReportPanel } from "../components/ReportPanel";
import { SkillDrawer } from "../components/SkillDrawer";
import { StatusBar } from "../components/StatusBar";
import { WorkspaceSidebar } from "../components/WorkspaceSidebar";
import {
  appendMessageToSession,
  buildReportMarkdown,
  createSeedSessions,
  createSession,
  DEFAULT_ACTIVE_SKILLS,
  synthesizeAssistantReply,
  type ChatSession
} from "../lib/sessionStore";

export function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => createSeedSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);
  const [draft, setDraft] = useState("");

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );

  const handleNewSession = () => {
    const nextSession = createSession("新研究会话");
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionId(nextSession.id);
    setDraft("");
  };

  const handleSend = () => {
    const input = draft.trim();
    if (!input || !activeSession) {
      return;
    }

    const assistantReply = synthesizeAssistantReply(input);
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSession.id) {
          return session;
        }
        const nextSession = appendMessageToSession(session, "user", input);
        const withAssistant = appendMessageToSession(
          nextSession,
          "assistant",
          assistantReply.message
        );
        return {
          ...withAssistant,
          reportMarkdown: buildReportMarkdown({
            ...withAssistant,
            activeSkills: assistantReply.activeSkills
          }),
          activeSkills: assistantReply.activeSkills
        };
      })
    );
    setDraft("");
  };

  const handleLoadSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setDraft("");
  };

  const reportMarkdown = activeSession?.reportMarkdown ?? buildReportMarkdown(createSession());

  return (
    <div className="app-frame">
      <WorkspaceSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleLoadSession}
        onCreateSession={handleNewSession}
      />
      <main className="app-main">
        <ChatPanel
          session={activeSession}
          draft={draft}
          onDraftChange={setDraft}
          onSend={handleSend}
          onRefresh={handleNewSession}
        />
        <StatusBar
          sessionCount={sessions.length}
          activeSkillCount={activeSession?.activeSkills.length ?? DEFAULT_ACTIVE_SKILLS.length}
          syncLabel="本地已同步"
        />
      </main>
      <aside className="app-aside" aria-label="报告与技能">
        <ReportPanel reportMarkdown={reportMarkdown} />
        <SkillDrawer skills={activeSession?.activeSkills ?? DEFAULT_ACTIVE_SKILLS} />
      </aside>
    </div>
  );
}
