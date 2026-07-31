import { FileText } from "lucide-react";
import { Markdown } from "../lib/markdown";

interface ReportPanelProps {
  reportMarkdown: string;
}

export function ReportPanel({ reportMarkdown }: ReportPanelProps) {
  return (
    <section className="panel report-panel" aria-label="报告">
      <div className="panel-heading">
        <div>
          <h2>报告</h2>
          <p>报告预览</p>
        </div>
        <FileText size={16} />
      </div>
      <div className="report-preview">
        {reportMarkdown ? <Markdown>{reportMarkdown}</Markdown> : <p className="report-empty">暂无报告内容</p>}
      </div>
    </section>
  );
}
