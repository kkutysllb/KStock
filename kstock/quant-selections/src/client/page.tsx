/**
 * 选股库 主区面板：页头 + 库 Section。
 */

import { SelectionsSection } from './section.tsx'

export function SelectionsPage() {
  return (
    <div className="ksq-page">
      <header className="ksq-topbar">
        <div className="ksq-title">
          <strong>选股库</strong>
          <span>选股研究资产沉淀：结果快照与重合分析</span>
        </div>
      </header>
      <SelectionsSection />
    </div>
  )
}
