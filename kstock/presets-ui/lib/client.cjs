window.__ModuleLoader__.load({
	id: "@kstock/client-presets",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _qilin_client_ui_primitives = require("@qilin/client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/seat-store.ts
		/** KStock 角色 preset id 集（与 kstock/presets/skills.manifest.json 保持同步）。 */
		const KSTOCK_ROLE_PRESET_IDS = [
			"market-analysis",
			"stock-analysis",
			"stock-screener",
			"chan-theory-expert",
			"strategy-research",
			"factor-mining"
		];
		/** 默认基座（名册中存在但选择器不展示）。 */
		const BASE_PRESET_ID = "standard";
		function createLocalStore(initial) {
			let value = initial;
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => value,
				set: (next) => {
					value = next;
					for (const listener of listeners) listener();
				},
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				}
			};
		}
		function presetOf(session) {
			const value = session?.projectionValues?.agentPreset;
			return typeof value === "string" ? value : void 0;
		}
		function asRosterEntry(raw) {
			if (typeof raw !== "object" || raw === null) return void 0;
			const entry = raw;
			if (typeof entry.id !== "string") return void 0;
			return {
				id: entry.id,
				name: typeof entry.name === "string" ? entry.name : entry.id,
				description: typeof entry.description === "string" ? entry.description : "",
				broken: typeof entry.broken === "string"
			};
		}
		/**
		* 角色选择器控制器：名册读取 + 暂存/应用。
		*/
		var PresetsSeatController = class {
			constructor(scope) {
				this.scope = scope;
				this.store = createLocalStore({
					status: "idle",
					error: null,
					options: [],
					current: BASE_PRESET_ID,
					locked: false,
					busy: false
				});
				this.disposed = false;
			}
			set(patch) {
				const prev = this.store.getSnapshot();
				this.store.set({
					...prev,
					...patch
				});
			}
			currentSession() {
				const sessionId = this.scope.selection.getSnapshot().sessionId;
				if (sessionId === void 0) return void 0;
				return this.scope.sessions.list.getSnapshot().byId[sessionId];
			}
			refreshCurrent() {
				const session = this.currentSession();
				this.set({
					current: this.staged ?? presetOf(session) ?? "standard",
					locked: session !== void 0 && !session.blank
				});
			}
			/** 读取名册并过滤到 KStock 角色集（standard 基座不进选项）。 */
			async load() {
				if (this.disposed) return;
				this.set({ status: "loading" });
				const result = await this.scope.remote.agentPresets.list();
				if (this.disposed) return;
				if (!result.ok) {
					this.set({
						status: "error",
						error: result.error.message
					});
					return;
				}
				const options = result.value.presets.map(asRosterEntry).filter((entry) => entry !== void 0 && KSTOCK_ROLE_PRESET_IDS.includes(entry.id)).sort((a, b) => {
					return KSTOCK_ROLE_PRESET_IDS.indexOf(a.id) - KSTOCK_ROLE_PRESET_IDS.indexOf(b.id);
				});
				this.set({
					status: "ready",
					error: null,
					options
				});
				this.refreshCurrent();
				this.apply();
			}
			/** 暂存一个角色选择并立即尝试应用。返回拒绝原因（成功为 undefined）。 */
			async select(id) {
				if (this.store.getSnapshot().busy) return void 0;
				this.staged = id;
				this.set({
					current: id,
					error: null
				});
				return await this.apply("pick");
			}
			/**
			* 把暂存选择交给当前 blank 会话；无暂存时仅刷新展示状态。
			* 当前会话非 blank（hero 之下往往仍选中旧会话）时**保留暂存**，等下一个
			* blank 会话出现再应用——选择语义即「新会话生效」。
			* @param trigger - 'pick'（用户刚选，拒绝要回报）或其他（跟随会话变化）。
			*/
			async apply(trigger) {
				if (this.disposed) return void 0;
				const staged = this.staged;
				const session = this.currentSession();
				if (staged === void 0) {
					this.refreshCurrent();
					return;
				}
				if (session === void 0) return void 0;
				if (presetOf(session) === staged) {
					this.staged = void 0;
					this.refreshCurrent();
					return;
				}
				if (!session.blank) return void 0;
				this.set({ busy: true });
				const result = await this.scope.remote.agentPresets.select(session.id, staged);
				if (this.disposed) return void 0;
				this.staged = void 0;
				if (!result.ok) {
					const reason = result.error.details !== void 0 && typeof result.error.details.reason === "string" ? result.error.details.reason : result.error.message;
					this.set({
						busy: false,
						error: reason
					});
					this.refreshCurrent();
					return trigger === "pick" ? reason : void 0;
				}
				this.set({
					busy: false,
					error: null,
					current: result.value
				});
			}
			dispose() {
				this.disposed = true;
			}
		};
		//#endregion
		//#region src/client/seat.tsx
		/**
		* KStock 角色 preset 选择芯片（新会话 hero 槽位）。
		*
		* 只列 6 个投研角色；standard 基座不在选项中（当前会话为基座时显示
		* 「通用·默认基座」占位）。会话启动后芯片禁用（host 拒绝换预设）。
		*/
		/** 基座占位文案（当前会话运行隐形默认基座时）。 */
		const BASE_LABEL = "通用 · 默认基座";
		/** 样式：一次性幂等注入（与 @kstock/quant-ui 的 injectQuantStyles 同模式）。 */
		const STYLE_ID = "kstock-presets-seat-style";
		const STYLE_CSS = `
.kstock-seat{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:8px;
  border:1px solid rgba(148,163,184,.35);background:rgba(148,163,184,.12);color:inherit;font-size:13px;
  cursor:pointer;transition:border-color .15s,background .15s}
.kstock-seat:hover:not(:disabled){border-color:rgba(148,163,184,.6);background:rgba(148,163,184,.2)}
.kstock-seat:disabled{opacity:.45;cursor:not-allowed}
.kstock-seat-label{max-width:11em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kstock-seat-item{display:flex;flex-direction:column;gap:2px;min-width:220px}
.kstock-seat-item-name{font-weight:600}
.kstock-seat-item-desc{font-size:12px;opacity:.7;line-height:1.4}
`;
		function ensureStyle() {
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = STYLE_CSS;
			document.head.appendChild(style);
		}
		/**
		* 渲染角色选择芯片。
		* @param props - 注入面（快照钩子 + 名册读取 + 选择）。
		* @returns 芯片，或名册不可用时的 null。
		*/
		function KStockPresetsSeat({ load, select, usePresetsSeat }) {
			const state = usePresetsSeat((snapshot) => snapshot);
			const [open, setOpen] = (0, react.useState)(false);
			const [toast, setToast] = (0, react.useState)(null);
			const toastSeq = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				ensureStyle();
				load();
			}, [load]);
			if (state.status !== "ready" && state.status !== "error") return null;
			const label = state.options.find((option) => option.id === state.current)?.name ?? (state.current === "standard" ? BASE_LABEL : state.current);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_qilin_client_ui_primitives.Menu, {
				open,
				onClose: () => {
					setOpen(false);
				},
				items: state.options.map((option) => ({
					id: option.id,
					label: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "kstock-seat-item",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "kstock-seat-item-name",
							children: option.name
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "kstock-seat-item-desc",
							children: option.description
						})]
					})
				})),
				selectedId: state.current === "standard" ? void 0 : state.current,
				onSelect: (id) => {
					setOpen(false);
					select(id).then((refusal) => {
						if (refusal !== void 0) setToast({
							seq: ++toastSeq.current,
							text: refusal
						});
					});
				},
				align: "start",
				portal: true,
				anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "kstock-seat",
					"aria-haspopup": "menu",
					"aria-expanded": open,
					title: state.locked ? "会话已启动，角色在新建会话时选择" : "选择研究角色（新会话生效）",
					disabled: state.busy || state.locked,
					onClick: () => {
						setOpen((value) => !value);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_qilin_client_ui_primitives.IconAgentPresetOutline16, {}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "kstock-seat-label",
							children: label
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_qilin_client_ui_primitives.IconChevronDownOutline14, {})
					]
				})
			}), toast !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_qilin_client_ui_primitives.Toast, {
				text: toast.text,
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_qilin_client_ui_primitives.IconWarningOutline16, {}),
				holdMs: 6e3,
				anchor: document.querySelector("[data-composer-card]"),
				onDone: () => {
					setToast(null);
				}
			}, toast.seq)] });
		}
		//#endregion
		//#region src/client/index.ts
		/** 必需服务：槽位注册表。 */
		const inject = ["slots"];
		/**
		* 挂载角色选择器：注册进新会话 hero 槽位（与上游 seat 同名槽位，上游行
		* 已在 patch 层禁用，不会重复渲染）。
		* 语义与上游 seat 相同：选择只在会话启动前生效（host 拒绝对已启动会话
		* 换预设）；blank 会话出现即应用暂存选择。
		* @param ctx - 浏览器插件根上下文。
		*/
		function apply(ctx) {
			ctx.inject([
				"slots",
				"conversation",
				"sessions",
				"remote",
				"remote.agentPresets",
				"uiWorkspace"
			], (scope) => {
				const workspace = scope;
				const controller = new PresetsSeatController({
					sessions: scope.sessions,
					remote: scope.remote,
					selection: workspace.uiWorkspace.selection
				});
				scope.effect(() => {
					const stopList = scope.sessions.list.subscribe(() => {
						controller.apply();
					});
					const stopSelection = workspace.uiWorkspace.selection.subscribe(() => {
						controller.apply();
					});
					controller.load();
					return () => {
						stopList();
						stopSelection();
						controller.dispose();
					};
				}, "kstock-presets: seat wiring");
				const chip = scope.slots.register({
					name: "conversation.hero.agentPreset",
					id: "kstock-roles",
					inject: () => ({
						hooks: { presetsSeat: controller.store },
						load: () => controller.load(),
						select: (id) => controller.select(id)
					})
				}, KStockPresetsSeat);
				return () => {
					chip();
				};
			});
		}
		//#endregion
		exports.KSTOCK_ROLE_PRESET_IDS = KSTOCK_ROLE_PRESET_IDS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.cjs.map