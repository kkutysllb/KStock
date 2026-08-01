import { useCallback, useEffect, useState } from "react";
import { ExternalLink, File, FileText, FolderOpen } from "lucide-react";
import {
  getAvailableSkills,
  isExtensionsApiError,
  type SkillInfo,
} from "../lib/extensionsClient";

/**
 * 报告输出设置页。
 *
 * 展示：
 * 1. 默认输出格式（Markdown 只读，PDF/DOCX 占位灰显）
 * 2. 报告技能状态（analysis-report / chart-visualization 的 enabled 状态）
 * 3. 输出目录路径格式说明
 *
 * 不实现 PDF/DOCX 实际导出（后续扩展）。「打开报告目录」依赖具体会话的
 * thread_id，设置页无会话上下文，故只展示路径格式。
 */
interface ReportSettingsProps {
  /** 跳转到「插件与技能」管理页（用户可在此启用/禁用技能）。 */
  onNavigateToExtensions: () => void;
}

const REPORT_SKILL_IDS = ["analysis-report", "chart-visualization"];

const SKILL_LABELS: Record<string, string> = {
  "analysis-report": "投研报告技能",
  "chart-visualization": "图表可视化技能",
};

export function ReportSettings({ onNavigateToExtensions }: ReportSettingsProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getAvailableSkills();
      setSkills(resp.skills.filter((s) => REPORT_SKILL_IDS.includes(s.name)));
    } catch (err) {
      setError(isExtensionsApiError(err) ? err.message : "加载报告技能状态失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const getSkillState = (name: string): SkillInfo | undefined =>
    skills.find((s) => s.name === name);

  return (
    <div className="report-settings">
      {/* 输出格式 */}
      <section className="settings-card" aria-label="输出格式">
        <strong>默认输出格式</strong>
        <p className="runtime-config-desc">
          Agent 生成的报告以 Markdown 格式写入 thread 的 outputs 目录，
          通过 <code>present_files</code> 工具在右侧面板呈现。
        </p>
        <div className="report-format-grid">
          <div className="report-format-option active">
            <FileText size={18} />
            <div>
              <strong>Markdown</strong>
              <span>当前默认</span>
            </div>
          </div>
          <div className="report-format-option disabled" aria-disabled="true">
            <File size={18} />
            <div>
              <strong>PDF</strong>
              <span>规划中</span>
            </div>
          </div>
          <div className="report-format-option disabled" aria-disabled="true">
            <File size={18} />
            <div>
              <strong>DOCX</strong>
              <span>规划中</span>
            </div>
          </div>
        </div>
      </section>

      {/* 报告技能状态 */}
      <section className="settings-card" aria-label="报告技能状态">
        <strong>报告技能状态</strong>
        <p className="runtime-config-desc">
          投研报告与图表可视化依赖 QiLin 技能，下方展示当前启用状态。
        </p>
        {loading ? (
          <p className="memory-loading">加载技能状态…</p>
        ) : error ? (
          <p className="auth-error" role="alert">{error}</p>
        ) : (
          <div className="report-skills">
            {REPORT_SKILL_IDS.map((id) => {
              const skill = getSkillState(id);
              const installed = !!skill;
              const enabled = !!skill?.enabled;
              return (
                <div key={id} className="report-skill-row">
                  <div>
                    <strong>{SKILL_LABELS[id] || id}</strong>
                    <span className="report-skill-id">{id}</span>
                  </div>
                  <span
                    className={`report-skill-status ${enabled ? "on" : "off"} ${!installed ? "missing" : ""}`}
                  >
                    {!installed ? "未安装" : enabled ? "已启用" : "已禁用"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <button type="button" className="link-button" onClick={onNavigateToExtensions}>
          <ExternalLink size={13} /> 前往「插件与技能」管理
        </button>
      </section>

      {/* 输出目录 */}
      <section className="settings-card" aria-label="输出目录">
        <strong>报告输出目录</strong>
        <p className="runtime-config-desc">
          Agent 将报告产物写入每个会话的 outputs 目录，路径格式如下：
        </p>
        <div className="report-output-path">
          <FolderOpen size={15} />
          <code>&lt;数据根&gt;/threads/{"{thread_id}"}/user-data/outputs/</code>
        </div>
        <p className="runtime-config-desc">
          切换到具体会话后，可在工作区右侧面板查看该会话的报告产物。
        </p>
      </section>
    </div>
  );
}
