/**
 * 报告库 主区面板：页头 + 库 Section。
 */

import { ReportsSection } from './section.tsx'

export function ReportsPage() {
  return (
    <div className="ksq-page">
      <header className="ksq-topbar">
        <div className="ksq-title">
          <strong>报告库</strong>
          <span>研究报告归档：日期分组与看板预览</span>
        </div>
      </header>
      <ReportsSection />
    </div>
  )
}
