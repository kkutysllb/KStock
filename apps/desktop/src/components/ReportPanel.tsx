import { FileText } from "lucide-react";
import { normalizeMarkdown } from "../lib/markdown";

interface ReportPanelProps {
  reportMarkdown: string;
}

export function ReportPanel({ reportMarkdown }: ReportPanelProps) {
  return (
    <section className="panel report-panel" aria-label="报告">
      <div className="panel-heading">
        <div>
          <h2>报告</h2>
          <p>Markdown 预览</p>
        </div>
        <FileText size={16} />
      </div>
      <pre className="report-preview">{normalizeMarkdown(reportMarkdown)}</pre>
    </section>
  );
}
