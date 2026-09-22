/** Plugin stylesheet: one injected <style> element, all classes prefixed
 * `kyl-`. Colors ride the host design-platform alias tokens (`--dsw-alias-*`,
 * light on `:root`, dark on `body[data-ds-dark-theme]`) so both themes adapt;
 * literal fallbacks keep the panel readable on hosts without the token set.
 */
/** Install the stylesheet once; idempotent across StrictMode replays. */
export declare function installStyles(): () => void;
