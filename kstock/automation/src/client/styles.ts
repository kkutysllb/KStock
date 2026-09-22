/** Plugin stylesheet: one injected <style> element, all classes prefixed
 * `kyl-`. Colors ride the host design-platform alias tokens (`--dsw-alias-*`,
 * light on `:root`, dark on `body[data-ds-dark-theme]`) so both themes adapt;
 * literal fallbacks keep the panel readable on hosts without the token set.
 */

const STYLE_ID = 'kyl-automation-styles'

const CSS = `
.kyl-panel, .kyl-editor {
  /* Local aliases over the host design-platform tokens. */
  --kyl-fg: var(--dsw-alias-label-primary, #1f2329);
  --kyl-fg-secondary: var(--dsw-alias-label-secondary, #5a6472);
  --kyl-fg-muted: var(--dsw-alias-label-tertiary, #8a94a3);
  --kyl-fg-caption: var(--dsw-alias-label-caption, #9aa3b0);
  --kyl-layer: var(--dsw-alias-bg-layer-2, #ffffff);
  --kyl-fill: var(--dsw-alias-bg-skeleton, rgba(127, 127, 127, 0.14));
  --kyl-fill-hover: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.2));
  --kyl-border: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  --kyl-border-strong: var(--dsw-alias-border-l4, rgba(127, 127, 127, 0.48));
  --kyl-primary: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6);
  --kyl-primary-fg: var(--dsw-alias-label-primary-foreground, #ffffff);
  --kyl-error: var(--dsw-alias-state-error-primary, #d0403d);
  --kyl-success: var(--dsw-alias-state-success-primary, #0f9d58);
  --kyl-info: var(--dsw-alias-state-business-primary, #2e90fa);
  --kyl-warn: var(--dsw-alias-state-warn-primary, #f5a209);
  --kyl-mask: var(--dsw-alias-bg-mask-3, rgba(0, 0, 0, 0.48));
}
.kyl-panel{display:flex;flex-direction:column;height:100%;min-height:0;overflow:auto;padding:20px 24px 32px;gap:16px;font-size:13px;line-height:1.5;color:var(--kyl-fg);background:transparent}
.kyl-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.kyl-title{margin:0;font-size:18px;font-weight:600;color:var(--kyl-fg)}
.kyl-subtitle{margin:2px 0 0;font-size:12px;color:var(--kyl-fg-muted);max-width:640px}
.kyl-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.kyl-scope{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.kyl-actions{display:flex;align-items:center;gap:8px}
.kyl-chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:var(--kyl-fill);color:var(--kyl-fg);font-size:12px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kyl-chip-muted{color:var(--kyl-fg-muted)}
.kyl-badge{padding:2px 8px;border-radius:999px;font-size:12px;color:var(--kyl-success);background:color-mix(in srgb, var(--kyl-success) 16%, transparent)}
.kyl-badge:not([data-active]){color:var(--kyl-fg-muted);background:var(--kyl-fill)}
.kyl-notice{padding:8px 12px;border-radius:8px;background:color-mix(in srgb, var(--kyl-info) 14%, transparent);color:var(--kyl-fg);font-size:12px;cursor:pointer}
.kyl-body{display:flex;flex-direction:column;gap:20px}
.kyl-section-title{margin:0 0 8px;font-size:13px;font-weight:600;color:var(--kyl-fg);display:flex;align-items:center;gap:6px}
.kyl-count{font-weight:400;color:var(--kyl-fg-muted)}
.kyl-cards,.kyl-runs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.kyl-card,.kyl-run{border:1px solid var(--kyl-border);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;background:transparent}
.kyl-card-head,.kyl-run-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.kyl-card-name,.kyl-run-name{font-weight:600;font-size:13px;color:var(--kyl-fg)}
.kyl-card-schedule{font-size:12px;color:var(--kyl-fg-secondary)}
.kyl-card-facts,.kyl-run-head{font-size:12px;color:var(--kyl-fg-secondary)}
.kyl-card-facts{display:flex;gap:14px;flex-wrap:wrap}
.kyl-card-summary,.kyl-run-summary{font-size:12px;color:var(--kyl-fg-muted);border-left:2px solid var(--kyl-border);padding-left:8px}
.kyl-card-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.kyl-run{gap:4px}
.kyl-run-note,.kyl-run-error{font-size:12px;color:var(--kyl-fg-secondary)}
.kyl-run-error{color:var(--kyl-error)}
.kyl-run-summary{font-size:12px;color:var(--kyl-fg-muted)}
.kyl-btn{appearance:none;border:1px solid var(--kyl-border-strong);background:transparent;color:var(--kyl-fg);border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer}
.kyl-btn:hover{background:var(--kyl-fill-hover)}
.kyl-btn-primary{background:var(--kyl-primary);border-color:transparent;color:var(--kyl-primary-fg)}
.kyl-btn-primary:hover{background:var(--kyl-primary);filter:brightness(1.08)}
.kyl-btn-danger{color:var(--kyl-error)}
.kyl-btn-ghost{background:transparent;border-color:transparent}
.kyl-btn-ghost:hover{background:var(--kyl-fill-hover)}
.kyl-empty{display:flex;flex-direction:column;gap:6px;align-items:flex-start;padding:18px;border:1px dashed var(--kyl-border-strong);border-radius:10px;font-size:13px;color:var(--kyl-fg)}
.kyl-empty-title{font-weight:600}
.kyl-empty-hint{font-size:12px;color:var(--kyl-fg-muted)}
.kyl-status{padding:2px 8px;border-radius:999px;font-size:12px;color:var(--kyl-fg-muted);background:var(--kyl-fill)}
.kyl-status-running{color:var(--kyl-info);background:color-mix(in srgb, var(--kyl-info) 16%, transparent)}
.kyl-status-queued{color:var(--kyl-warn);background:color-mix(in srgb, var(--kyl-warn) 16%, transparent)}
.kyl-status-succeeded{color:var(--kyl-success);background:color-mix(in srgb, var(--kyl-success) 16%, transparent)}
.kyl-status-failed{color:var(--kyl-error);background:color-mix(in srgb, var(--kyl-error) 16%, transparent)}
.kyl-status-skipped,.kyl-status-cancelled{color:var(--kyl-fg-muted);background:var(--kyl-fill);opacity:.9}
.kyl-run-when{font-variant-numeric:tabular-nums;color:var(--kyl-fg)}
.kyl-editor-scrim{position:fixed;inset:0;background:var(--kyl-mask);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;z-index:80;overflow:auto}
.kyl-editor{width:min(760px,100%);background:var(--kyl-layer);color:var(--kyl-fg);border:1px solid var(--kyl-border);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 16px 48px rgba(0,0,0,.25)}
.kyl-editor-title{margin:0;font-size:16px;font-weight:600;color:var(--kyl-fg)}
.kyl-field{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.kyl-field-row{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap}
.kyl-field-label{font-size:12px;font-weight:600;color:var(--kyl-fg-secondary)}
.kyl-input{width:100%;box-sizing:border-box;border:1px solid var(--kyl-border);border-radius:8px;padding:6px 8px;font-size:12px;background:transparent;color:var(--kyl-fg)}
.kyl-input:focus-visible{outline:none;border-color:var(--kyl-primary)}
.kyl-input option{background:var(--kyl-layer);color:var(--kyl-fg)}
.kyl-input::placeholder{color:var(--kyl-fg-caption)}
.kyl-textarea{resize:vertical;font-family:inherit;line-height:1.45}
.kyl-select-inline{max-width:280px;width:auto}
.kyl-weekdays{display:flex;gap:6px;flex-wrap:wrap}
.kyl-weekday{border:1px solid var(--kyl-border);background:transparent;color:var(--kyl-fg);border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer}
.kyl-weekday:hover{background:var(--kyl-fill-hover)}
.kyl-weekday[data-on]{background:var(--kyl-primary);border-color:transparent;color:var(--kyl-primary-fg)}
.kyl-permissions{display:flex;gap:8px;flex:1}
.kyl-perm{flex:1;display:flex;flex-direction:column;gap:2px;border:1px solid var(--kyl-border);background:transparent;color:var(--kyl-fg);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;text-align:left}
.kyl-perm small{color:var(--kyl-fg-muted);font-size:11px;font-weight:400}
.kyl-perm:hover{background:var(--kyl-fill-hover)}
.kyl-perm[data-on]{border-color:var(--kyl-primary);box-shadow:0 0 0 1px var(--kyl-primary) inset}
.kyl-model-picker{display:flex;flex-direction:column;gap:8px;flex:1}
.kyl-radio{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--kyl-fg)}
.kyl-radio input{accent-color:var(--kyl-primary)}
.kyl-model-fields{display:flex;gap:10px;flex-wrap:wrap}
.kyl-editor-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
`

/** Install the stylesheet once; idempotent across StrictMode replays. */
export function installStyles(): () => void {
  if (document.getElementById(STYLE_ID) === null) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = CSS
    document.head.append(style)
  }
  return () => {
    document.getElementById(STYLE_ID)?.remove()
  }
}
