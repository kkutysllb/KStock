/**
 * 因子库 主区面板：页头 + 库 Section。
 */

import { FactorsSection } from './section.tsx'

export function FactorsPage() {
  return (
    <div className="ksq-page">
      <header className="ksq-topbar">
        <div className="ksq-title">
          <strong>因子库</strong>
          <span>因子研究资产沉淀：IC 曲线与口径对比</span>
        </div>
      </header>
      <FactorsSection />
    </div>
  )
}
