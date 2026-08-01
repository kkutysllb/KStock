import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, FolderOpen } from "lucide-react";
import { getAvailableSkills, isExtensionsApiError, type SkillInfo } from "../lib/extensionsClient";

interface ReportSettingsProps { onNavigateToExtensions: () => void }
const REPORT_SKILL_IDS = ["analysis-report", "chart-visualization"];
const SKILL_LABELS: Record<string, string> = { "analysis-report": "投研报告技能", "chart-visualization": "图表可视化技能" };

export function ReportSettings({ onNavigateToExtensions }: ReportSettingsProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { const resp = await getAvailableSkills(); setSkills(resp.skills.filter((skill) => REPORT_SKILL_IDS.includes(skill.name))); }
    catch (err) { setError(isExtensionsApiError(err) ? err.message : "加载报告技能状态失败"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return <div className="report-settings">
    <section className="settings-card" aria-label="输出格式">
      <strong>HTML 数据看板</strong>
      <p className="runtime-config-desc">研究报告统一生成单个自包含 HTML 文件，内嵌样式、图表运行时和分析数据，可离线打开。聊天正文和思考过程仍支持 Markdown 显示。</p>
      <div className="report-format-option active"><FileText size={18} /><div><strong>HTML Dashboard</strong><span>当前唯一报告格式</span></div></div>
    </section>
    <section className="settings-card" aria-label="报告技能状态">
      <strong>报告技能状态</strong><p className="runtime-config-desc">投研报告与图表可视化依赖 QiLin 技能，下方展示当前启用状态。</p>
      {loading ? <p className="memory-loading">加载技能状态…</p> : error ? <p className="auth-error" role="alert">{error}</p> : <div className="report-skills">{REPORT_SKILL_IDS.map((id) => { const skill = skills.find((item) => item.name === id); const statusClass = "report-skill-status " + (skill?.enabled ? "on" : "off") + (!skill ? " missing" : ""); return <div key={id} className="report-skill-row"><div><strong>{SKILL_LABELS[id]}</strong><span className="report-skill-id">{id}</span></div><span className={statusClass}>{!skill ? "未安装" : skill.enabled ? "已启用" : "已禁用"}</span></div>; })}</div>}
      <button type="button" className="link-button" onClick={onNavigateToExtensions}><ExternalLink size={13} /> 前往「插件与技能」管理</button>
    </section>
    <section className="settings-card" aria-label="报告目录">
      <strong>报告库目录</strong><p className="runtime-config-desc">归档报告按当前用户和生成日期保存，与线程 outputs 分离。删除历史任务不会删除这里的报告，只有报告库中的主动删除会移除文件。</p>
      <div className="report-output-path"><FolderOpen size={15} /><code>&lt;数据根&gt;/reports/{"{user_id}"}/YYYY/MM/DD/</code></div>
    </section>
  </div>;
}
