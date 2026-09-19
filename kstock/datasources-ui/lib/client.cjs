window.__ModuleLoader__.load({
	id: "@kstock/client-datasources",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _qilin_client_ui_primitives = require("@qilin/client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/section.tsx
		/**
		* 数据源设置分区组件：状态卡 + 脱敏录入 + 保存。
		*
		* 数据经静态控制器（同源 fetch /kstock-api/data-sources）拉取与写回，
		* 与组件生命周期解耦（设置页开合不丢已编辑内容）。
		*/
		/** 样式：一次性幂等注入。 */
		const STYLE_ID = "kstock-datasources-style";
		const STYLE_CSS = `
.kstock-ds{display:flex;flex-direction:column;gap:16px}
.kstock-ds-head p{margin:4px 0 0;font-size:13px;opacity:.75}
.kstock-ds-card{display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid rgba(148,163,184,.3);
  border-radius:10px}
.kstock-ds-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.kstock-ds-name{font-weight:600}
.kstock-ds-env{font-size:12px;opacity:.6;font-family:ui-monospace,monospace}
.kstock-ds-input{flex:1;min-width:220px;height:32px;padding:0 10px;border-radius:8px;
  border:1px solid rgba(148,163,184,.4);background:transparent;color:inherit;font-size:13px}
.kstock-ds-note{font-size:13px;margin:0}
.kstock-ds-ok{color:#22c55e}
.kstock-ds-err{color:#ef4444}
`;
		function ensureStyle() {
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = STYLE_CSS;
			document.head.appendChild(style);
		}
		async function apiGet() {
			try {
				const response = await fetch("/kstock-api/data-sources", { headers: { accept: "application/json" } });
				if (!response.ok) return { error: `HTTP ${response.status}` };
				return await response.json();
			} catch (error) {
				return { error: error instanceof Error ? error.message : String(error) };
			}
		}
		async function apiPut(values) {
			try {
				const response = await fetch("/kstock-api/data-sources", {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ values })
				});
				if (!response.ok) return { error: (await response.json().catch(() => null))?.detail ?? `HTTP ${response.status}` };
				return await response.json();
			} catch (error) {
				return { error: error instanceof Error ? error.message : String(error) };
			}
		}
		/** 静态控制器：与组件生命周期解耦。 */
		const controller = {
			load: apiGet,
			save: apiPut
		};
		/**
		* 渲染数据源分区。
		* @param props - 注入面 + 设置壳 owner props。
		* @returns 分区内容。
		*/
		function DataSourcesSection({ load, save, t }) {
			const [sources, setSources] = (0, react.useState)([]);
			const [drafts, setDrafts] = (0, react.useState)({});
			const [status, setStatus] = (0, react.useState)("loading");
			const [note, setNote] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				ensureStyle();
				load().then((result) => {
					if ("sources" in result) {
						setSources(result.sources);
						setStatus("ready");
					} else {
						setNote({
							ok: false,
							text: result.error
						});
						setStatus("error");
					}
				});
			}, [load]);
			const dirty = sources.some((source) => (drafts[source.env_name] ?? "") !== "");
			const onSave = () => {
				const values = {};
				for (const source of sources) {
					const draft = drafts[source.env_name] ?? "";
					if (draft !== "") values[source.env_name] = draft;
					if (draft === "" && clearSet.has(source.env_name)) values[source.env_name] = "";
				}
				if (Object.keys(values).length === 0) return;
				setBusy(true);
				save(values).then((result) => {
					setBusy(false);
					if ("restart_required" in result) {
						setDrafts({});
						setClearSet(/* @__PURE__ */ new Set());
						setNote({
							ok: true,
							text: t("saved")
						});
						load().then((next) => {
							if ("sources" in next) setSources(next.sources);
						});
					} else setNote({
						ok: false,
						text: `${t("saveFailed")}：${result.error}`
					});
				});
			};
			const [clearSet, setClearSet] = (0, react.useState)(/* @__PURE__ */ new Set());
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "kstock-ds",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "kstock-ds-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("desc") })]
					}),
					sources.map((source) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "kstock-ds-card",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "kstock-ds-row",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "kstock-ds-name",
									children: source.label
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_qilin_client_ui_primitives.Tag, { children: source.configured ? t("configured") : t("notConfigured") }),
								!source.persisted && source.configured && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_qilin_client_ui_primitives.Tag, { children: t("notPersisted") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "kstock-ds-env",
									children: [
										t("envName"),
										"：",
										source.env_name,
										source.masked === null ? "" : `（${source.masked}）`
									]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "kstock-ds-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "kstock-ds-input",
								type: "password",
								autoComplete: "off",
								placeholder: t("tokenPlaceholder"),
								value: drafts[source.env_name] ?? "",
								onChange: (event) => {
									setDrafts((prev) => ({
										...prev,
										[source.env_name]: event.target.value
									}));
									setClearSet((prev) => {
										const next = new Set(prev);
										next.delete(source.env_name);
										return next;
									});
								}
							}), source.persisted && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_qilin_client_ui_primitives.Button, {
								variant: "ghost",
								onClick: () => {
									setClearSet((prev) => new Set(prev).add(source.env_name));
									setDrafts((prev) => ({
										...prev,
										[source.env_name]: ""
									}));
								},
								children: t("clear")
							})]
						})]
					}, source.id)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "kstock-ds-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_qilin_client_ui_primitives.Button, {
							disabled: !dirty || busy,
							onClick: onSave,
							children: busy ? t("saving") : t("save")
						}), note !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: `kstock-ds-note ${note.ok ? "kstock-ds-ok" : "kstock-ds-err"}`,
							children: note.text
						})]
					})
				]
			});
		}
		DataSourcesSection.load = controller.load;
		DataSourcesSection.save = controller.save;
		//#endregion
		//#region src/client/index.ts
		const zh = {
			"nav": "数据源",
			"title": "数据源凭据",
			"desc": "投研技能的数据获取凭据。保存后重启引擎生效（技能脚本经引擎环境读取）。",
			"configured": "已配置",
			"notConfigured": "未配置",
			"notPersisted": "仅环境注入，未持久化",
			"tokenPlaceholder": "输入新 Token / Key（留空保持不变）",
			"clear": "清除已保存的凭据",
			"save": "保存",
			"saving": "保存中…",
			"saved": "已保存，重启引擎后生效（托盘菜单可重启）",
			"saveFailed": "保存失败",
			"envName": "环境变量"
		};
		const en = {
			"nav": "Data Sources",
			"title": "Data source credentials",
			"desc": "Credentials for research skills. Saved to secrets.env; restart the engine to apply.",
			"configured": "Configured",
			"notConfigured": "Not configured",
			"notPersisted": "Injected via env only, not persisted",
			"tokenPlaceholder": "Enter new token / key (leave blank to keep)",
			"clear": "Clear saved credential",
			"save": "Save",
			"saving": "Saving…",
			"saved": "Saved. Restart the engine to apply (tray menu).",
			"saveFailed": "Save failed",
			"envName": "Environment variable"
		};
		/** 必需服务：槽位注册表 + locale 注册表。 */
		const inject = ["slots", "locale"];
		/**
		* 挂载设置分区：注册进 settings.section（ui-agent-preset 同款槽位；本插件
		* 自有 locale 命名空间，不与上游字典冲突）。
		* @param ctx - 浏览器插件根上下文。
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("settings.kstockDataSources", {
				zh,
				en
			}), "kstock-datasources: dictionaries");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "kstock-data-sources",
				order: 30,
				label: () => ctx.locale.bind("settings.kstockDataSources")("nav"),
				locale: "settings.kstockDataSources",
				inject: () => ({
					load: () => DataSourcesSection.load(),
					save: (values) => DataSourcesSection.save(values)
				})
			}, DataSourcesSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.cjs.map