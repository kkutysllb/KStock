import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ExternalLink, FileText, RefreshCw, Search, Trash2 } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { deleteReport, fetchReportHtml, listReports, type ReportLibraryItem } from "../lib/reportsClient";

interface ReportLibraryProps { onBack: () => void }

export function ReportLibrary({ onBack }: ReportLibraryProps) {
  const [reports, setReports] = useState<ReportLibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ report: ReportLibraryItem; url: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReportLibraryItem | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setReports(await listReports({ query: query.trim() || undefined })); }
    catch (err) { setError(err instanceof Error ? err.message : "报告库加载失败"); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { void reload(); }, [reload]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ReportLibraryItem[]>();
    reports.forEach((report) => {
      const date = report.generated_at.slice(0, 10) || "未标注日期";
      groups.set(date, [...(groups.get(date) ?? []), report]);
    });
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [reports]);

  const openPreview = async (report: ReportLibraryItem) => {
    setError(null);
    try {
      const html = await fetchReportHtml(report.report_id);
      setPreview({ report, url: URL.createObjectURL(new Blob([html], { type: "text/html" })) });
    } catch (err) { setError(err instanceof Error ? err.message : "报告加载失败"); }
  };

  const closePreview = () => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); };
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try { await deleteReport(pendingDelete.report_id); setPendingDelete(null); closePreview(); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "报告删除失败"); }
  };

  return (
    <main className="report-library-page" aria-label="报告库">
      <header className="report-library-header">
        <button className="icon-ghost" type="button" onClick={onBack} aria-label="返回工作台"><ArrowLeft size={18} /></button>
        <div><p className="eyebrow">Research Archive</p><h1>报告库</h1><p>按日期保存的 HTML 数据看板，和历史任务独立管理。</p></div>
        <button className="icon-ghost" type="button" onClick={() => void reload()} aria-label="刷新报告库" title="刷新"><RefreshCw size={17} /></button>
      </header>
      <div className="report-library-toolbar">
        <label className="report-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题、标的或类型" /></label>
        <span className="report-count">{reports.length} 份报告</span>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {loading ? <p className="memory-loading">加载报告库…</p> : grouped.length === 0 ? <div className="report-library-empty"><FileText size={22} /><strong>暂无归档报告</strong><span>完成研究任务后，HTML 看板会自动出现在这里。</span></div> : (
        <div className="report-library-groups">
          {grouped.map(([date, items]) => <section key={date} className="report-date-group"><h2><CalendarDays size={16} />{date}<span>{items.length}</span></h2><div className="report-card-grid">
            {items.map((report) => <article key={report.report_id} className="report-library-card"><div className="report-card-main"><FileText size={18} /><div><h3>{report.title}</h3><p>{report.symbol || "未标注标的"} · {report.report_type}</p><small>{report.period_start || "—"} 至 {report.period_end || "—"} · 风险 {report.risk_level || "未标注"}</small></div></div><div className="report-card-actions"><button type="button" className="subtle-button" onClick={() => void openPreview(report)}><ExternalLink size={14} />打开看板</button><button type="button" className="icon-ghost danger" onClick={() => setPendingDelete(report)} aria-label={`删除报告 ${report.title}`} title="删除报告"><Trash2 size={15} /></button></div></article>)}
          </div></section>)}
        </div>
      )}
      {preview && <div className="report-preview-overlay" role="dialog" aria-modal="true" aria-label={preview.report.title}><div className="report-preview-dialog"><div className="report-preview-bar"><strong>{preview.report.title}</strong><button className="subtle-button" type="button" onClick={closePreview}>关闭</button></div><iframe title={preview.report.title} src={preview.url} sandbox="allow-scripts" /></div></div>}
      <ConfirmDialog open={pendingDelete !== null} title="删除报告？" description={`将从报告库删除「${pendingDelete?.title ?? "该报告"}」及其 HTML 文件。历史任务和其他报告不受影响。`} confirmText="删除报告" onConfirm={() => void confirmDelete()} onCancel={() => setPendingDelete(null)} />
    </main>
  );
}
