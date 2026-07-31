export function App() {
  return (
    <div className="app-shell">
      <aside className="panel panel-left" aria-label="会话">
        <h2>会话</h2>
        <p>等待对话记录。</p>
      </aside>
      <main className="panel panel-main" aria-label="工作区">
        <header className="app-header">
          <h1>KStock</h1>
          <p>股票量化智能体桌面端</p>
        </header>
        <label className="message-label" htmlFor="message-input">
          消息输入
        </label>
        <textarea
          id="message-input"
          className="message-input"
          placeholder="输入你的研究问题，例如：分析贵州茅台最近一季财报，并生成报告。"
        />
      </main>
      <aside className="panel panel-right" aria-label="报告">
        <h2>报告</h2>
        <p>等待生成结果。</p>
      </aside>
    </div>
  );
}
