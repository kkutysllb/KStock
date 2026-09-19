/**
 * 报告库面板：按日期分组浏览归档的 HTML 看板，搜索 / 预览 / 删除。
 * 移植自 1.x components/ReportLibrary.tsx；预览 iframe 沿用 sandbox
 * allow-scripts（与服务端 CSP 头双重隔离）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteReport, fetchReportHtml, listReports, reportBlobUrl, type ReportLibraryItem } from '@kstock/quant-ui'
import { IconCalendar, IconChevronDown, IconChevronRight, IconExternal, IconFile, IconSearch, IconTrash } from '@kstock/quant-ui'
import { ConfirmDialog, Empty, ErrorLine, Loading, PreviewDialog, RefreshButton } from '@kstock/quant-ui'

export function ReportsSection() {
  const [reports, setReports] = useState<ReportLibraryItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ report: ReportLibraryItem; url: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ReportLibraryItem | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReports(await listReports({ query: query.trim() || undefined }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '报告库加载失败')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => { void reload() }, [reload])

  const grouped = useMemo(() => {
    const groups = new Map<string, ReportLibraryItem[]>()
    reports.forEach(report => {
      const date = report.generated_at.slice(0, 10) || '未标注日期'
      groups.set(date, [...(groups.get(date) ?? []), report])
    })
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [reports])

  const openPreview = async (report: ReportLibraryItem) => {
    setError(null)
    try {
      const html = await fetchReportHtml(report.report_id)
      setPreview({ report, url: reportBlobUrl(html) })
    } catch (err) {
      setError(err instanceof Error ? err.message : '报告加载失败')
    }
  }

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const toggleCollapse = useCallback((date: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }, [])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteReport(pendingDelete.report_id)
      setPendingDelete(null)
      closePreview()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '报告删除失败')
    }
  }

  return (
    <div className="ksq-body" aria-label="报告库">
      <div className="ksq-toolbar">
        <label className="ksq-search">
          <IconSearch size={14} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、标的或报告类型" />
        </label>
        <RefreshButton refreshing={loading} onClick={() => void reload()} label="刷新报告库" />
      </div>

      {error && <ErrorLine message={error} />}
      {loading ? <Loading text="加载报告库…" /> : grouped.length === 0 ? (
        <Empty
          icon={<IconFile size={22} />}
          title="暂无归档报告"
          hint="在对话里让 agent 生成 HTML 看板并归档后，这里会按日期出现报告。"
        />
      ) : (
        <div>
          {grouped.map(([date, items]) => {
            const isCollapsed = collapsed.has(date)
            const groupId = `ksq-report-group-${date}`
            return (
              <section key={date} className="ksq-report-group">
                <button
                  type="button"
                  className="ksq-report-heading"
                  onClick={() => toggleCollapse(date)}
                  aria-expanded={!isCollapsed}
                  aria-controls={groupId}
                >
                  <IconCalendar size={14} />
                  <h2>{date}</h2>
                  <span>{items.length} 份</span>
                  {isCollapsed ? <IconChevronRight size={13} /> : <IconChevronDown size={13} />}
                </button>
                {!isCollapsed && (
                  <div id={groupId} className="ksq-report-grid">
                    {items.map(report => (
                      <article key={report.report_id} className="ksq-report-card">
                        <div className="ksq-report-icon"><IconFile size={16} /></div>
                        <div className="ksq-report-copy">
                          <h3 title={report.title}>{report.title}</h3>
                          <div className="ksq-report-meta">
                            <span>{report.symbol || '未标注标的'}</span>
                            <span>{report.report_type}</span>
                            <span>{report.period_start || '—'} 至 {report.period_end || '—'}</span>
                            <span>风险 {report.risk_level || '未标注'}</span>
                          </div>
                        </div>
                        <div className="ksq-report-actions">
                          <button type="button" className="ksq-btn" onClick={() => void openPreview(report)}>
                            <IconExternal size={13} /> 打开看板
                          </button>
                          <button
                            type="button"
                            className="ksq-iconbtn danger"
                            onClick={() => setPendingDelete(report)}
                            aria-label={`删除报告 ${report.title}`}
                            title="删除报告"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {preview && (
        <PreviewDialog title={preview.report.title} onClose={closePreview}>
          <iframe title={preview.report.title} src={preview.url} sandbox="allow-scripts" />
        </PreviewDialog>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="删除报告？"
          description={`将从报告库删除「${pendingDelete.title}」及其 HTML 文件。历史任务和其他报告不受影响。`}
          confirmText="删除报告"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
