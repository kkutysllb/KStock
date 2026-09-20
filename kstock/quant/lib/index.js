import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { dirname, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region src/store.ts
/**
* KStock 量化三库存储：策略 / 因子 / 选股，一份泛化实现按配置实例化。
*
* 从 1.x `scripts/kstock_{strategies,factors,selections}.py` 忠实移植：
* 表名 / 列名 / 索引 / 文件布局与旧 `product/kstock.db` 完全兼容，
* 用户既有数据无需迁移。三库同构（实体 + 版本链 + 运行记录），
* 差异以声明式配置表达，共享一份 CRUD 实现。
*/
var StoreError = class extends Error {
	status;
	constructor(status, message) {
		super(message);
		this.status = status;
	}
};
function now$1() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
function shortRandom(prefix) {
	return `${prefix}${randomBytes(6).toString("hex")}`;
}
var LibraryStore = class {
	config;
	db;
	libraryRoot;
	constructor(config, dataRoot) {
		this.config = config;
		const root = join(dataRoot, "product");
		const dirByPrefix = {
			strategy: "strategies",
			factor: "factors",
			selection: "selections"
		};
		this.libraryRoot = join(root, dirByPrefix[config.key] ?? config.key);
		mkdirSync(this.libraryRoot, { recursive: true });
		this.db = new DatabaseSync(join(root, "kstock.db"));
		this.db.exec("PRAGMA journal_mode = WAL");
		this.initialize();
	}
	initialize() {
		const c = this.config;
		const key = `${c.key}_id`;
		const textColumns = c.entityTextColumns.map(({ column, defaultValue }) => `${column} TEXT NOT NULL DEFAULT '${defaultValue}'`);
		const versionArtifact = c.version.digest ? `${c.version.digest.shaColumn} TEXT NOT NULL,\n        ${c.version.digest.bytesColumn} INTEGER NOT NULL,` : "";
		const versionContent = c.version.content ? `${c.version.content.jsonColumn} TEXT NOT NULL,\n        ${c.version.content.bytesColumn} INTEGER NOT NULL,` : "";
		const runText = (c.runTextColumns ?? []).map((column) => `${column} TEXT NOT NULL DEFAULT ''`);
		const runJson = c.runJsonColumns.map(({ column }) => `${column} TEXT NOT NULL`);
		const runAttachmentPaths = c.runAttachments.map(({ pathColumn }) => `${pathColumn} TEXT`);
		const runColumns = [
			...runText,
			...runJson,
			...runAttachmentPaths
		].map((column) => `        ${column}`).join(",\n");
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${c.entityTable} (
        user_id TEXT NOT NULL,
        ${key} TEXT NOT NULL,
        name TEXT NOT NULL,
        ${textColumns.length ? textColumns.map((column) => `${column},`).join("\n        ") + "\n        " : ""}status TEXT NOT NULL DEFAULT '${c.defaultStatus}',
        current_version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, ${key})
      );
      CREATE TABLE IF NOT EXISTS ${c.versionTable} (
        user_id TEXT NOT NULL,
        ${key} TEXT NOT NULL,
        version INTEGER NOT NULL,
        parent_version INTEGER,
        ${versionArtifact}
        ${versionContent}
        params_json TEXT NOT NULL,
        change_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, ${key}, version)
      );
      CREATE TABLE IF NOT EXISTS ${c.runsTable} (
        user_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        ${key} TEXT NOT NULL,
        version INTEGER NOT NULL,
        ${runColumns},
        thread_id TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, run_id)
      );
      CREATE INDEX IF NOT EXISTS idx_${c.versionTable} ON ${c.versionTable} (user_id, ${key}, version);
      CREATE INDEX IF NOT EXISTS idx_${c.runsTable} ON ${c.runsTable} (user_id, ${key}, version, created_at);
    `);
	}
	dir(userId, entityId) {
		return join(this.libraryRoot, userId, entityId);
	}
	create(userId, name, textValues = {}) {
		if (!name.trim()) throw new StoreError(422, "名称不能为空");
		const c = this.config;
		const id = shortRandom(c.idPrefix);
		const ts = now$1();
		const columns = c.entityTextColumns.map(({ column }) => column);
		const values = columns.map((column) => textValues[column] ?? c.entityTextColumns.find((item) => item.column === column).defaultValue);
		this.db.prepare(`INSERT INTO ${c.entityTable} (user_id, ${c.key}_id, name${columns.length ? ", " + columns.join(", ") : ""}, status, current_version, created_at, updated_at)
       VALUES (?, ?, ?${columns.length ? ", " + columns.map(() => "?").join(", ") : ""}, ?, 0, ?, ?)`).run(userId, id, name.trim(), ...values, c.defaultStatus, ts, ts);
		return this.get(userId, id);
	}
	get(userId, entityId) {
		const row = this.db.prepare(`SELECT * FROM ${this.config.entityTable} WHERE user_id = ? AND ${this.config.key}_id = ?`).get(userId, entityId);
		if (row === void 0) throw new StoreError(404, `条目不存在：${entityId}`);
		return row;
	}
	list(userId) {
		return this.db.prepare(`SELECT * FROM ${this.config.entityTable} WHERE user_id = ? ORDER BY updated_at DESC`).all(userId).map((row) => ({
			...row,
			latest_run: this.latestRun(userId, String(row[`${this.config.key}_id`]))
		}));
	}
	update(userId, entityId, patch) {
		const c = this.config;
		this.get(userId, entityId);
		if (patch.status !== void 0 && !c.statusValues.includes(patch.status)) throw new StoreError(422, `状态仅支持 ${c.statusValues.join(" / ")}`);
		const sets = ["updated_at = ?"];
		const values = [now$1()];
		if (patch.name !== void 0) {
			if (!patch.name.trim()) throw new StoreError(422, "名称不能为空");
			sets.push("name = ?");
			values.push(patch.name.trim());
		}
		for (const { column, updatable } of c.entityTextColumns) {
			if (updatable !== true || patch.text?.[column] === void 0) continue;
			sets.push(`${column} = ?`);
			values.push(patch.text[column].trim());
		}
		if (patch.status !== void 0) {
			sets.push("status = ?");
			values.push(patch.status);
		}
		this.db.prepare(`UPDATE ${c.entityTable} SET ${sets.join(", ")} WHERE user_id = ? AND ${c.key}_id = ?`).run(...values, userId, entityId);
		return this.get(userId, entityId);
	}
	saveVersion(userId, entityId, input) {
		const c = this.config;
		const entity = this.get(userId, entityId);
		const current = Number(entity.current_version);
		const parent = input.parent_version ?? current;
		if (Number(parent) !== current) throw new StoreError(409, `版本冲突：当前版本为 v${current}，提交基于 v${parent}。请先重新读取最新版本再提交修改。`);
		const version = current + 1;
		const versionDir = join(this.dir(userId, entityId), "versions", `v${String(version).padStart(3, "0")}`);
		mkdirSync(versionDir, { recursive: true });
		let digestSha = "";
		let digestBytes = 0;
		if (c.version.digest && input.code !== void 0) {
			const codeBytes = Buffer.from(input.code, "utf-8");
			if (codeBytes.length > 512 * 1024) throw new StoreError(422, `内容超过 ${512 * 1024 / 1024}KB 上限`);
			digestSha = createHash("sha256").update(codeBytes).digest("hex");
			digestBytes = codeBytes.length;
			writeFileSync(join(versionDir, c.version.digest.file), codeBytes);
		}
		let contentJson = "{}";
		let contentBytes = 0;
		if (c.version.content && input.criteria !== void 0) {
			contentJson = JSON.stringify(input.criteria);
			contentBytes = Buffer.byteLength(contentJson);
			if (contentBytes > 64 * 1024) throw new StoreError(422, "选股条件超过 64KB 上限");
			writeFileSync(join(versionDir, "criteria.json"), contentJson, "utf-8");
		}
		const paramsText = JSON.stringify(input.params ?? {});
		if (Buffer.byteLength(paramsText) > 64 * 1024) throw new StoreError(422, "参数 JSON 超过 64KB 上限");
		const ts = now$1();
		const digestColumns = c.version.digest ? `, ${c.version.digest.shaColumn}, ${c.version.digest.bytesColumn}` : "";
		const contentColumns = c.version.content ? `, ${c.version.content.jsonColumn}, ${c.version.content.bytesColumn}` : "";
		this.db.prepare(`INSERT INTO ${c.versionTable} (user_id, ${c.key}_id, version, parent_version${digestColumns}${contentColumns}, params_json, change_note, created_at)
       VALUES (?, ?, ?, ?${c.version.digest ? ", ?, ?" : ""}${c.version.content ? ", ?, ?" : ""}, ?, ?, ?)`).run(userId, entityId, version, current, ...c.version.digest ? [digestSha, digestBytes] : [], ...c.version.content ? [contentJson, contentBytes] : [], paramsText, (input.change_note ?? "").trim(), ts);
		this.db.prepare(`UPDATE ${c.entityTable} SET current_version = ?, updated_at = ? WHERE user_id = ? AND ${c.key}_id = ?`).run(version, ts, userId, entityId);
		return {
			[`${c.key}_id`]: entityId,
			version,
			parent_version: current,
			code_sha256: digestSha || void 0,
			created_at: ts
		};
	}
	listVersions(userId, entityId) {
		this.get(userId, entityId);
		return this.db.prepare(`SELECT * FROM ${this.config.versionTable} WHERE user_id = ? AND ${this.config.key}_id = ? ORDER BY version`).all(userId, entityId).map(unpackJsonColumns);
	}
	getVersion(userId, entityId, version) {
		const c = this.config;
		const row = this.db.prepare(`SELECT * FROM ${c.versionTable} WHERE user_id = ? AND ${c.key}_id = ? AND version = ?`).get(userId, entityId, version);
		if (row === void 0) throw new StoreError(404, `版本不存在：${entityId} v${version}`);
		const item = unpackJsonColumns(row);
		if (c.version.digest) {
			const codePath = join(this.dir(userId, entityId), "versions", `v${String(version).padStart(3, "0")}`, c.version.digest.file);
			item.code = readFileSync(codePath, "utf-8");
			item.code_path = codePath;
		}
		return item;
	}
	recordRun(userId, entityId, body) {
		const c = this.config;
		const entity = this.get(userId, entityId);
		const version = Number(body.version);
		const current = Number(entity.current_version);
		if (version < 1 || version > current) throw new StoreError(422, `版本越界：v${version}（当前最新 v${current}）`);
		const textValues = (c.runTextColumns ?? []).map((column) => String(body[column] ?? ""));
		const jsonValues = c.runJsonColumns.map(({ column, bodyKey }) => {
			const text = JSON.stringify(body[bodyKey] ?? {});
			if (Buffer.byteLength(text) > 4 * 1024 * 1024) throw new StoreError(422, `${column} 超过 4MB 上限`);
			return [column, text];
		});
		const runId = shortRandom(c.runIdPrefix);
		const runDir = join(this.dir(userId, entityId), "runs", runId);
		mkdirSync(runDir, { recursive: true });
		const attachmentPaths = c.runAttachments.map((attachment) => {
			const payload = body[attachment.key];
			if (payload === void 0 || payload === null) return [attachment.pathColumn, null];
			const text = attachment.text ? String(payload) : JSON.stringify(payload);
			if (Buffer.byteLength(text) > attachment.limit) throw new StoreError(422, `${attachment.key} 超过 ${Math.round(attachment.limit / 1024 / 1024 * 10) / 10}MB 上限`);
			writeFileSync(join(runDir, attachment.file), text, "utf-8");
			return [attachment.pathColumn, join(runDir, attachment.file).slice(this.libraryRoot.length + 1)];
		});
		const ts = now$1();
		const attachmentColumns = c.runAttachments.map(({ pathColumn }) => pathColumn);
		this.db.prepare(`INSERT INTO ${c.runsTable} (user_id, run_id, ${c.key}_id, version, ${(c.runTextColumns ?? []).join(", ")}${(c.runTextColumns ?? []).length ? ", " : ""}${c.runJsonColumns.map(({ column }) => column).join(", ")}, ${attachmentColumns.join(", ")}, thread_id, created_at)
       VALUES (?, ?, ?, ?, ${(c.runTextColumns ?? []).map(() => "?").join(", ")}${(c.runTextColumns ?? []).length ? ", " : ""}${c.runJsonColumns.map(() => "?").join(", ")}, ${attachmentColumns.map(() => "?").join(", ")}, ?, ?)`).run(userId, runId, entityId, version, ...textValues, ...jsonValues.map(([, text]) => text), ...attachmentPaths.map(([, path]) => path), body.thread_id === void 0 ? null : String(body.thread_id), ts);
		this.db.prepare(`UPDATE ${c.entityTable} SET updated_at = ? WHERE user_id = ? AND ${c.key}_id = ?`).run(ts, userId, entityId);
		return {
			run_id: runId,
			[`${c.key}_id`]: entityId,
			version,
			created_at: ts
		};
	}
	listRuns(userId, entityId, version) {
		const c = this.config;
		const where = version === void 0 ? "" : ` AND version = ?`;
		const args = version === void 0 ? [userId, entityId] : [
			userId,
			entityId,
			version
		];
		return this.db.prepare(`SELECT * FROM ${c.runsTable} WHERE user_id = ? AND ${c.key}_id = ?${where} ORDER BY created_at DESC`).all(...args).map(unpackJsonColumns);
	}
	latestRun(userId, entityId) {
		const row = this.db.prepare(`SELECT * FROM ${this.config.runsTable} WHERE user_id = ? AND ${this.config.key}_id = ? ORDER BY created_at DESC LIMIT 1`).get(userId, entityId);
		return row === void 0 ? null : unpackJsonColumns(row);
	}
	/** 读取某次运行的附件（equity / ic_series / picks / report …）。 */
	getRunAttachment(userId, entityId, runId, key) {
		const c = this.config;
		const attachment = c.runAttachments.find((item) => item.key === key);
		if (attachment === void 0) throw new StoreError(404, `未知附件：${key}`);
		const row = this.db.prepare(`SELECT * FROM ${c.runsTable} WHERE user_id = ? AND ${c.key}_id = ? AND run_id = ?`).get(userId, entityId, runId);
		if (row === void 0) throw new StoreError(404, `运行记录不存在：${runId}`);
		if (!row[attachment.pathColumn]) throw new StoreError(422, "该运行未存此附件");
		const raw = readFileSync(join(this.libraryRoot, String(row[attachment.pathColumn])), "utf-8");
		return {
			run_id: runId,
			version: row.version,
			...key === "equity" ? {
				data_start: row.data_start,
				data_end: row.data_end
			} : {},
			[key]: attachment.text ? raw : JSON.parse(raw)
		};
	}
	compareRuns(userId, entityId, runIds) {
		const c = this.config;
		const rows = runIds.map((runId) => {
			const row = this.db.prepare(`SELECT * FROM ${c.runsTable} WHERE user_id = ? AND ${c.key}_id = ? AND run_id = ?`).get(userId, entityId, runId);
			if (row === void 0) throw new StoreError(404, `运行记录不存在：${runId}`);
			return unpackJsonColumns(row);
		});
		const ranges = new Set(rows.map((r) => `${r[Object.hasOwn(r, "trade_date") ? "trade_date" : "data_start"]}~${r.data_end}`));
		const rulesSet = new Set(rows.map((r) => JSON.stringify(r.rules)));
		const comparable = ranges.size === 1 && rulesSet.size === 1;
		return {
			[`${c.key}_id`]: entityId,
			runs: rows,
			comparable,
			notes: comparable ? [] : ["所选运行的数据区间或规则配置不一致，对比仅供粗略参考；严格对比应使用相同数据区间与相同规则配置的运行。"]
		};
	}
};
/** 行 → 响应：`*_json` 列反序列化并剥掉后缀（`rules_json` → `rules`，对齐 1.x API 契约）。 */
function unpackJsonColumns(row) {
	const item = {};
	for (const [key, value] of Object.entries(row)) if (key.endsWith("_json")) item[key.slice(0, -5)] = JSON.parse(String(value));
	else item[key] = value;
	return item;
}
function strategyStore(dataRoot) {
	return new LibraryStore({
		key: "strategy",
		idPrefix: "stg_",
		runIdPrefix: "srun_",
		entityTable: "strategies",
		versionTable: "strategy_versions",
		runsTable: "backtest_runs",
		statusValues: [
			"researching",
			"paused",
			"rejected"
		],
		defaultStatus: "researching",
		entityTextColumns: [{
			column: "hypothesis",
			defaultValue: "",
			updatable: true
		}],
		version: { digest: {
			shaColumn: "code_sha256",
			bytesColumn: "code_bytes",
			file: "signal_engine.py"
		} },
		runTextColumns: ["data_start", "data_end"],
		runJsonColumns: [{
			column: "rules_json",
			bodyKey: "rules"
		}, {
			column: "metrics_json",
			bodyKey: "metrics"
		}],
		runAttachments: [{
			key: "equity",
			pathColumn: "equity_path",
			file: "equity.json",
			limit: 2 * 1024 * 1024
		}, {
			key: "trades",
			pathColumn: "trades_path",
			file: "trades.json",
			limit: 4 * 1024 * 1024
		}]
	}, dataRoot);
}
function factorStore(dataRoot) {
	return new LibraryStore({
		key: "factor",
		idPrefix: "fac_",
		runIdPrefix: "frun_",
		entityTable: "factors",
		versionTable: "factor_versions",
		runsTable: "factor_runs",
		statusValues: [
			"researching",
			"paused",
			"rejected"
		],
		defaultStatus: "researching",
		entityTextColumns: [{
			column: "hypothesis",
			defaultValue: "",
			updatable: true
		}, {
			column: "category",
			defaultValue: "custom"
		}],
		version: { digest: {
			shaColumn: "code_sha256",
			bytesColumn: "code_bytes",
			file: "factor_engine.py"
		} },
		runTextColumns: ["universe"],
		runJsonColumns: [{
			column: "config_json",
			bodyKey: "config"
		}, {
			column: "metrics_json",
			bodyKey: "metrics"
		}],
		runAttachments: [{
			key: "ic_series",
			pathColumn: "ic_series_path",
			file: "ic_series.json",
			limit: 2 * 1024 * 1024
		}, {
			key: "layers",
			pathColumn: "layers_path",
			file: "layers.json",
			limit: 2 * 1024 * 1024
		}]
	}, dataRoot);
}
function selectionStore(dataRoot) {
	return new LibraryStore({
		key: "selection",
		idPrefix: "sel_",
		runIdPrefix: "selrun_",
		entityTable: "selections",
		versionTable: "selection_versions",
		runsTable: "selection_runs",
		statusValues: [
			"watching",
			"paused",
			"rejected"
		],
		defaultStatus: "watching",
		entityTextColumns: [{
			column: "criteria",
			defaultValue: "",
			updatable: true
		}],
		version: { content: {
			jsonColumn: "criteria_json",
			bytesColumn: "criteria_bytes",
			payloadKey: "criteria"
		} },
		runTextColumns: ["trade_date", "universe"],
		runJsonColumns: [{
			column: "rules_json",
			bodyKey: "rules"
		}, {
			column: "metrics_json",
			bodyKey: "metrics"
		}],
		runAttachments: [{
			key: "report",
			pathColumn: "report_path",
			file: "report.md",
			limit: 2 * 1024 * 1024,
			text: true
		}, {
			key: "picks",
			pathColumn: "picks_path",
			file: "picks.json",
			limit: 4 * 1024 * 1024
		}]
	}, dataRoot);
}
//#endregion
//#region src/reports.ts
/**
* 报告库存储：自包含 HTML 研究报告的归档与索引。
*
* 从 1.x `scripts/kstock_reports.py` 忠实移植：表结构（report_library +
* report_deletions）、文件布局（reports/{user}/{Y}/{M}/{D}/{report_id}.html）、
* sha256 内容寻址与删除标记语义保持不变。与三库不同，报告无版本链——
* 同 report_id 重复入库即覆盖更新。1.x 的线程 outputs 被动扫描归档依赖
* 2.x 引擎的目录布局（QILIN_HOME/users/...），3.x 已不适用，归档入口
* 收敛为 agent 显式调用（POST /kstock-api/reports）。
*/
/** 1.x 同款路径组件白名单：防报告 id / user id 拼进文件路径。 */
const SAFE_COMPONENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
/** 单份报告 HTML 的大小上限。 */
const MAX_REPORT_BYTES = 8 * 1024 * 1024;
var ReportsStore = class {
	db;
	dataRoot;
	reportsRoot;
	constructor(dataRoot) {
		this.dataRoot = resolve(dataRoot);
		this.reportsRoot = join(this.dataRoot, "reports");
		mkdirSync(this.reportsRoot, { recursive: true });
		this.db = new DatabaseSync(join(this.dataRoot, "product", "kstock.db"));
		this.db.exec("PRAGMA journal_mode = WAL");
		this.initialize();
	}
	initialize() {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS report_library (
        report_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        title TEXT NOT NULL,
        symbol TEXT,
        report_type TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        period_start TEXT,
        period_end TEXT,
        risk_level TEXT,
        coverage_status TEXT,
        relative_path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, report_id)
      );
      CREATE INDEX IF NOT EXISTS idx_report_library_date ON report_library (user_id, generated_at);
      CREATE TABLE IF NOT EXISTS report_deletions (
        user_id TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        deleted_at TEXT NOT NULL,
        PRIMARY KEY (user_id, sha256)
      );
    `);
	}
	list(userId, filter = {}) {
		component(userId, "user_id");
		const clauses = ["user_id = ?"];
		const values = [userId];
		if (filter.date) {
			clauses.push("substr(generated_at, 1, 10) = ?");
			values.push(filter.date);
		}
		if (filter.symbol) {
			clauses.push("symbol = ?");
			values.push(filter.symbol);
		}
		if (filter.query) {
			clauses.push("(title LIKE ? OR report_type LIKE ? OR symbol LIKE ?)");
			const pattern = `%${filter.query}%`;
			values.push(pattern, pattern, pattern);
		}
		return this.db.prepare(`SELECT * FROM report_library WHERE ${clauses.join(" AND ")} ORDER BY generated_at DESC`).all(...values);
	}
	/** 不存在返回 null（路由层负责 404 文案）。 */
	find(userId, reportId) {
		return this.db.prepare("SELECT * FROM report_library WHERE user_id = ? AND report_id = ?").get(component(userId, "user_id"), component(reportId, "report_id")) ?? null;
	}
	/**
	* 归档（或覆盖更新）一份报告：内容落盘 + upsert 索引行。
	* report_id 缺省时由 thread_id + title 稳定派生——同线程同主题重跑
	* 天然走覆盖更新，与 1.x「report_id 由文件名 stem 派生」的语义对齐。
	*/
	archive(userId, input) {
		const user = component(userId, "user_id");
		const threadId = component(input.threadId, "thread_id");
		const content = input.content ?? "";
		if (!content.trim()) throw new StoreError(422, "报告内容（content）不能为空");
		const generatedAt = input.generatedAt ?? now();
		const [year, month, day] = generatedDate(generatedAt);
		const reportId = component(input.reportId ?? `report-${createHash("sha256").update(`${threadId}:${input.title ?? ""}`).digest("hex").slice(0, 12)}`, "report_id");
		const relativePath = [
			"reports",
			user,
			year,
			month,
			day,
			`${reportId}.html`
		].join("/");
		const bytes = Buffer.from(content, "utf-8");
		if (bytes.length > MAX_REPORT_BYTES) throw new StoreError(422, `报告内容超过 ${MAX_REPORT_BYTES / 1024 / 1024}MB 上限`);
		const digest = createHash("sha256").update(bytes).digest("hex");
		const existing = this.find(user, reportId);
		const ts = now();
		const row = {
			report_id: reportId,
			user_id: user,
			thread_id: threadId,
			title: input.title?.trim() || reportId,
			symbol: input.symbol ?? null,
			report_type: input.reportType?.trim() || "analysis",
			generated_at: generatedAt,
			period_start: input.periodStart ?? null,
			period_end: input.periodEnd ?? null,
			risk_level: input.riskLevel ?? null,
			coverage_status: input.coverageStatus ?? null,
			relative_path: relativePath,
			size_bytes: bytes.length,
			sha256: digest,
			created_at: existing ? String(existing.created_at) : ts,
			updated_at: ts
		};
		const target = join(this.dataRoot, relativePath);
		mkdirSync(join(target, ".."), { recursive: true });
		const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
		writeFileSync(tmp, bytes);
		renameSync(tmp, target);
		this.db.prepare(`
      INSERT INTO report_library
        (report_id,user_id,thread_id,title,symbol,report_type,generated_at,period_start,period_end,
         risk_level,coverage_status,relative_path,size_bytes,sha256,created_at,updated_at)
      VALUES ($report_id,$user_id,$thread_id,$title,$symbol,$report_type,$generated_at,$period_start,$period_end,
              $risk_level,$coverage_status,$relative_path,$size_bytes,$sha256,$created_at,$updated_at)
      ON CONFLICT(user_id, report_id) DO UPDATE SET
        thread_id=$thread_id,title=$title,symbol=$symbol,report_type=$report_type,generated_at=$generated_at,
        period_start=$period_start,period_end=$period_end,risk_level=$risk_level,coverage_status=$coverage_status,
        relative_path=$relative_path,size_bytes=$size_bytes,sha256=$sha256,updated_at=$updated_at
    `).run(row);
		if (existing && existing.relative_path !== relativePath) rmSync(join(this.dataRoot, String(existing.relative_path)), { force: true });
		return {
			...row,
			content_url: `/kstock-api/reports/${reportId}/content`
		};
	}
	/** 报告 HTML 的磁盘路径；越界或文件缺失一律按不存在处理。 */
	contentPath(userId, reportId) {
		const row = this.find(userId, reportId);
		if (row === null) throw new StoreError(404, "报告不存在");
		const path = resolve(this.dataRoot, String(row.relative_path));
		if (!path.startsWith(resolve(this.reportsRoot) + sep) || !existsSync(path)) throw new StoreError(404, "报告不存在");
		return path;
	}
	readContent(userId, reportId) {
		return readFileSync(this.contentPath(userId, reportId));
	}
	delete(userId, reportId) {
		const row = this.find(userId, reportId);
		if (row === null) throw new StoreError(404, "报告不存在");
		const path = resolve(this.dataRoot, String(row.relative_path));
		if (!path.startsWith(resolve(this.reportsRoot) + sep)) throw new StoreError(422, "报告路径越界，拒绝删除");
		this.db.prepare("INSERT OR REPLACE INTO report_deletions (user_id, sha256, deleted_at) VALUES (?, ?, ?)").run(component(userId, "user_id"), String(row.sha256), now());
		this.db.prepare("DELETE FROM report_library WHERE user_id = ? AND report_id = ?").run(userId, reportId);
		rmSync(path, { force: true });
	}
};
function component(value, name) {
	const text = String(value ?? "");
	if (!SAFE_COMPONENT.test(text)) throw new StoreError(422, `${name} 含不安全的路径字符`);
	return text;
}
/** ISO 时间戳 → 报告归档目录的年/月/日段。 */
function generatedDate(value) {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) throw new StoreError(422, "generated_at 必须是 ISO-8601 时间戳");
	const pad = (n) => String(n).padStart(2, "0");
	return [
		String(parsed.getFullYear()),
		pad(parsed.getMonth() + 1),
		pad(parsed.getDate())
	];
}
function now() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
//#endregion
//#region src/news.ts
/** 缓存时长与 1.x gateway 一致。 */
const CACHE_TTL_MS$1 = 6e4;
/** 落地页最多展示 10 条（1.x LandingPage slice(0, 10)）。 */
const MAX_ITEMS = 10;
/** 工作台「财经新闻」面板条数（主源 pageSize 50 内，30 条滚动浏览）。 */
const WORKSPACE_MAX_ITEMS = 30;
const HTTP_TIMEOUT_MS$1 = 8e3;
/** 部分公开接口会拒绝非常规 UA（requests/fetch 默认值），带浏览器 UA。 */
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
/** 东方财富全球财经快讯（akshare stock_info_global_em 的同源接口）。 */
async function fetchEastmoney(limit) {
	const params = new URLSearchParams({
		client: "web",
		biz: "web_724",
		fastColumn: "102",
		sortEnd: "",
		pageSize: "50",
		req_trace: String(Date.now())
	});
	const response = await fetch(`https://np-weblist.eastmoney.com/comm/web/getFastNewsList?${params}`, {
		headers: {
			accept: "application/json",
			"user-agent": BROWSER_UA
		},
		signal: AbortSignal.timeout(HTTP_TIMEOUT_MS$1)
	});
	if (!response.ok) throw new Error(`eastmoney ${response.status}`);
	const payload = await response.json();
	const items = [];
	for (const row of payload.data?.fastNewsList ?? []) {
		const title = typeof row.title === "string" ? row.title.trim() : "";
		if (title === "") continue;
		const code = typeof row.code === "string" ? row.code : "";
		items.push({
			title,
			source: "东方财富",
			published_at: typeof row.showTime === "string" ? row.showTime.trim() : "",
			url: code !== "" ? `https://finance.eastmoney.com/a/${encodeURIComponent(code)}.html` : "",
			summary: typeof row.summary === "string" ? row.summary.slice(0, 180) : ""
		});
		if (items.length >= limit) break;
	}
	return items;
}
/** 央视新闻联播目录（近 3 天，去重补足主源缺口）。 */
async function fetchCctv(limit) {
	const items = [];
	const columnId = "TOPC1451528971114112";
	const now = Date.now();
	for (let offset = 0; offset < 3 && items.length < limit; offset += 1) {
		const day = /* @__PURE__ */ new Date(now - offset * 864e5);
		const pd = [
			String(day.getFullYear()),
			String(day.getMonth() + 1).padStart(2, "0"),
			String(day.getDate()).padStart(2, "0")
		].join("");
		const params = new URLSearchParams({
			id: columnId,
			n: "24",
			sort: "desc",
			p: "1",
			pd,
			serviceId: "tvcctv"
		});
		try {
			const response = await fetch(`https://api.cntv.cn/NewVideo/getVideoListByColumn?${params}`, {
				headers: {
					accept: "application/json",
					"user-agent": BROWSER_UA
				},
				signal: AbortSignal.timeout(HTTP_TIMEOUT_MS$1)
			});
			if (!response.ok) continue;
			const payload = await response.json();
			for (const row of payload.data?.list ?? []) {
				const title = typeof row.title === "string" ? row.title.replace("[视频]", "").trim() : "";
				if (title === "" || items.some((item) => item.title === title)) continue;
				items.push({
					title,
					source: "央视新闻",
					published_at: typeof row.time === "string" && row.time.trim() !== "" ? row.time.trim() : pd,
					url: typeof row.url === "string" && /^https?:\/\//.test(row.url) ? row.url : "",
					summary: typeof row.brief === "string" ? row.brief.slice(0, 180) : ""
				});
				if (items.length >= limit) break;
			}
		} catch {}
	}
	return items;
}
/** 刷新一次快讯（主源优先、备源补足；不缓存失败结果）。 */
async function refreshNews(limit) {
	let items = [];
	try {
		items = await fetchEastmoney(limit);
	} catch {}
	if (items.length < limit) try {
		items = [...items, ...await fetchCctv(limit - items.length)];
	} catch {}
	return {
		items,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	};
}
/**
* 读缓存工厂：60 秒 TTL + 并发合并；成功才写缓存（失败不缓存）。
* tag=true 时每条附带标的识别（字典失败则静默跳过，不阻塞新闻流）。
*/
function createFeed(limit, options) {
	let cache = null;
	let inflight = null;
	return async () => {
		if (cache !== null && Date.now() - cache.at < CACHE_TTL_MS$1) return cache.payload;
		if (inflight === null) inflight = refreshNews(limit).then(async (payload) => {
			if (payload.items.length > 0) cache = {
				at: Date.now(),
				payload
			};
			if (options?.tag === true && payload.items.length > 0) {
				const { stockUniverse, matchStocks } = await Promise.resolve().then(() => stocks_exports);
				const universe = await stockUniverse();
				if (universe !== null) {
					for (const item of payload.items) item.stocks = matchStocks(`${item.title}\n${item.summary}`, universe);
					cache = {
						at: Date.now(),
						payload
					};
				}
			}
			return payload;
		}).finally(() => {
			inflight = null;
		});
		return inflight;
	};
}
/**
* 落地页快讯（10 条）：失败不抛错——返回空列表由落地页渲染空态。
*/
const landingNews = createFeed(MAX_ITEMS);
/**
* 工作台财经新闻面板 feed（30 条，独立缓存 + 标的识别标注）：侧栏
* 「财经新闻」菜单的数据源（@kstock/client-news 经
* GET /kstock-api/workspace-news 消费）。
*/
const workspaceNews = createFeed(WORKSPACE_MAX_ITEMS, { tag: true });
/** 与 1.x scripts/kstock_data_sources.py 的 `_DATA_SOURCES` 一致。 */
const DATA_SOURCES$1 = [[
	"tushare",
	"Tushare Pro",
	"TUSHARE_TOKEN"
], [
	"iwencai",
	"同花顺问财",
	"IWENCAI_API_KEY"
]];
function dataSourceStatus() {
	return { sources: DATA_SOURCES$1.map(([id, label, envName]) => ({
		id,
		label,
		env_name: envName,
		configured: Boolean(process.env[envName])
	})) };
}
//#endregion
//#region src/news-store.ts
var NewsStore = class {
	db;
	constructor(dataRoot) {
		this.db = new DatabaseSync(join(dataRoot, "news.db"));
		this.db.exec("PRAGMA journal_mode = WAL");
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        published_at TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        stocks TEXT NOT NULL DEFAULT '[]',
        archived_at INTEGER NOT NULL
      )
    `);
		this.db.exec("CREATE INDEX IF NOT EXISTS idx_news_archived ON news(archived_at)");
	}
	/** 留档一批条目（标题去重幂等）；返回新插入条数。 */
	archive(items) {
		if (items.length === 0) return 0;
		const statement = this.db.prepare("INSERT OR IGNORE INTO news (title, source, published_at, url, summary, stocks, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
		let inserted = 0;
		const now = Date.now();
		this.db.exec("BEGIN");
		try {
			for (const item of items) {
				const result = statement.run(item.title, item.source, item.published_at, item.url, item.summary, JSON.stringify(item.stocks ?? []), now);
				inserted += Number(result.changes);
			}
			this.db.exec("COMMIT");
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
		return inserted;
	}
	/** 历史检索：时间窗内 LIKE 匹配（标题+摘要），新在前。 */
	search(query, hours, limit) {
		const since = Date.now() - hours * 36e5;
		const pattern = `%${query.replace(/[%_]/g, " $&")}%`;
		return this.db.prepare("SELECT title, source, published_at, url, summary, stocks, archived_at FROM news WHERE archived_at >= ? AND (title LIKE ? ESCAPE ' ' OR summary LIKE ? ESCAPE ' ') ORDER BY archived_at DESC LIMIT ?").all(since, pattern, pattern, limit).map((row) => ({
			title: String(row.title),
			source: String(row.source),
			published_at: String(row.published_at),
			url: String(row.url),
			summary: String(row.summary),
			stocks: JSON.parse(String(row.stocks)),
			archived_at: new Date(Number(row.archived_at)).toISOString()
		}));
	}
	/** 热词榜：时间窗内标题对字典词的命中计数（确定性字典匹配）。 */
	trending(spanMs, limit, dictionary) {
		const since = Date.now() - spanMs;
		const rows = this.db.prepare("SELECT title FROM news WHERE archived_at >= ?").all(since);
		const counts = /* @__PURE__ */ new Map();
		for (const word of dictionary) {
			let count = 0;
			for (const row of rows) if (row.title.includes(word)) count += 1;
			if (count > 0) counts.set(word, count);
		}
		return [...counts.entries()].map(([word, count]) => ({
			word,
			count
		})).sort((left, right) => right.count - left.count).slice(0, limit);
	}
	/** 频率分布：span 按 bucket 分桶计数（时间桶起点毫秒，旧→新）。 */
	frequency(spanMs, bucketMs) {
		const since = Date.now() - spanMs;
		const rows = this.db.prepare("SELECT archived_at FROM news WHERE archived_at >= ?").all(since);
		const buckets = Math.max(1, Math.ceil(spanMs / bucketMs));
		const counts = new Array(buckets).fill(0);
		for (const row of rows) {
			const index = Math.min(buckets - 1, Math.max(0, Math.floor((Number(row.archived_at) - since) / bucketMs)));
			counts[index] += 1;
		}
		return counts.map((count, index) => ({
			bucket: since + index * bucketMs,
			count
		}));
	}
};
//#endregion
//#region src/stocks.ts
var stocks_exports = /* @__PURE__ */ __exportAll({
	MACRO_WORDS: () => MACRO_WORDS,
	dictionaryWords: () => dictionaryWords,
	matchStocks: () => matchStocks,
	stockUniverse: () => stockUniverse
});
const CACHE_TTL_MS = 24 * 36e5;
const HTTP_TIMEOUT_MS = 15e3;
let cache = null;
let inflight = null;
/**
* 宏观/主题热词表（字典匹配用，确定性无分词依赖；行业词另有
* stock_basic 的 industry 字段动态补充）。
*/
const MACRO_WORDS = [
	"美联储",
	"加息",
	"降息",
	"缩表",
	"通胀",
	"通缩",
	"CPI",
	"PPI",
	"PMI",
	"GDP",
	"关税",
	"制裁",
	"出口管制",
	"汇率",
	"降准",
	"LPR",
	"国债",
	"地方债",
	"注册制",
	"IPO",
	"回购",
	"增持",
	"减持",
	"并购",
	"重组",
	"分红",
	"财报",
	"业绩预告",
	"产能",
	"涨价",
	"降价",
	"新能源",
	"半导体",
	"人工智能",
	"机器人",
	"算力",
	"芯片",
	"锂矿",
	"光伏",
	"储能",
	"电动车",
	"智能驾驶",
	"医药",
	"创新药",
	"白酒",
	"地产",
	"券商",
	"银行",
	"保险",
	"军工",
	"黄金",
	"原油",
	"铜",
	"稀土",
	"数据要素",
	"低空经济",
	"商业航天"
];
/**
* 读取标的字典（按名称长度降序——贪心匹配先吃长名，避免「中国平安」
* 被「平安」类短名截断）。失败返回 null。
*/
async function stockUniverse() {
	const token = process.env.TUSHARE_TOKEN;
	if (typeof token !== "string" || token === "") return null;
	if (cache !== null && Date.now() - cache.at < CACHE_TTL_MS) return cache.stocks;
	if (inflight !== null) return inflight;
	inflight = (async () => {
		try {
			const response = await fetch("https://api.tushare.pro", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					api_name: "stock_basic",
					token,
					params: { list_status: "L" },
					fields: "ts_code,name,industry"
				}),
				signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
			});
			if (!response.ok) return null;
			const payload = await response.json();
			if (payload.code !== 0 || !Array.isArray(payload.data?.items)) return null;
			const stocks = [];
			for (const row of payload.data?.items ?? []) {
				const [code, name, industry] = row;
				if (typeof code !== "string" || typeof name !== "string" || name === "") continue;
				stocks.push({
					code,
					name,
					industry: typeof industry === "string" ? industry : ""
				});
			}
			if (stocks.length === 0) return null;
			stocks.sort((left, right) => right.name.length - left.name.length);
			cache = {
				at: Date.now(),
				stocks
			};
			return stocks;
		} catch {
			return null;
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}
/** 字典词全集（标的名 + 行业 + 宏观词，去重），热词统计用。 */
function dictionaryWords(stocks) {
	const words = new Set(MACRO_WORDS);
	for (const stock of stocks) {
		if (stock.name.length >= 2) words.add(stock.name);
		if (stock.industry !== "") words.add(stock.industry);
	}
	return [...words];
}
/**
* 歧义简称排除表：与日常用语/行业词完全重合的证券简称（标题命中是
* 普通词而非指代公司）——如「机器人」既是 300024 的简称也是行业常用
* 词，标注会大量误报，识别侧跳过（热词榜仍作为行业词统计）。
*/
const AMBIGUOUS_NAMES = /* @__PURE__ */ new Set(["机器人"]);
/**
* 在文本中识别标的（标题+摘要联合匹配；长名优先；每条最多 cap 个，
* 跳过被更长已命中名完全覆盖的短名——如「中国平安」命中后不再报
* 「平安银行」之外的伪子串）。
*/
function matchStocks(text, stocks, cap = 3) {
	const hits = [];
	let consumed = "";
	for (const stock of stocks) {
		if (hits.length >= cap) break;
		if (AMBIGUOUS_NAMES.has(stock.name)) continue;
		if (!text.includes(stock.name)) continue;
		if (consumed !== "" && consumed.includes(stock.name)) continue;
		hits.push(stock);
		consumed += stock.name;
	}
	return hits;
}
//#endregion
//#region src/datasources.ts
/**
* 数据源凭据配置面（设置页「数据源」的后端）。
*
* 凭据落 `~/.kstock/config/secrets.env`（1.x 同一文件）：Electron 壳在启动
* 引擎前把该文件并入引擎环境（不覆盖已有键），技能脚本经 bash 继承——
* 因此运行时修改凭据需重启引擎生效，本模块的写入口负责原子合并并如实
* 返回 restart_required。
*/
/** 受管数据源：id →（展示名，环境变量名）。 */
const DATA_SOURCES = [[
	"tushare",
	"Tushare Pro",
	"TUSHARE_TOKEN"
], [
	"iwencai",
	"同花顺问财",
	"IWENCAI_API_KEY"
]];
function secretsPath(dataRoot) {
	return join(dataRoot, "config", "secrets.env");
}
/** 解析 secrets.env 为保序键值表（保留注释/空行结构以最小 diff 写回）。 */
function parseSecrets(text) {
	const lines = text.split(/\r?\n/);
	const values = /* @__PURE__ */ new Map();
	for (const line of lines) {
		const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
		if (match !== null) values.set(match[1], match[2].trim().replace(/^["']|["']$/g, ""));
	}
	return {
		lines,
		values
	};
}
function mask(value) {
	if (value === "") return null;
	if (value.length <= 6) return `${value.slice(0, 1)}****`;
	return `${value.slice(0, 3)}****${value.slice(-2)}`;
}
function view(dataRoot, env) {
	const persisted = existsSync(secretsPath(dataRoot)) ? parseSecrets(readFileSync(secretsPath(dataRoot), "utf8")).values : /* @__PURE__ */ new Map();
	return { sources: DATA_SOURCES.map(([id, label, envName]) => {
		const value = env[envName] ?? persisted.get(envName) ?? "";
		return {
			id,
			label,
			env_name: envName,
			configured: Boolean(env[envName]),
			persisted: persisted.has(envName),
			masked: mask(value)
		};
	}) };
}
/** GET /kstock-api/data-sources。 */
function dataSourcesView(dataRoot) {
	return view(dataRoot, process.env);
}
/**
* PUT /kstock-api/data-sources：合并写入 secrets.env。
*
* values 为「环境变量名 → 新值」表；空串表示清除该键；不在受管清单内的
* 键拒绝（防止把任意环境变量写进文件）。保留文件中的注释与未知键。
*/
async function saveDataSources(dataRoot, values) {
	if (typeof values !== "object" || values === null) throw new StoreError(422, "values 必须是「环境变量名 → 值」对象");
	const managed = new Set(DATA_SOURCES.map(([, , envName]) => envName));
	const input = /* @__PURE__ */ new Map();
	for (const [key, raw] of Object.entries(values)) {
		if (!managed.has(key)) throw new StoreError(422, `不受管理的数据源键：${key}`);
		if (typeof raw !== "string") throw new StoreError(422, `${key} 的值必须是字符串`);
		input.set(key, raw.trim());
	}
	if (input.size === 0) throw new StoreError(422, "values 为空");
	const path = secretsPath(dataRoot);
	const { lines, values: current } = parseSecrets(existsSync(path) ? readFileSync(path, "utf8") : "");
	const written = /* @__PURE__ */ new Set();
	const output = [];
	for (const line of lines) {
		const key = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/.exec(line.trim())?.[1];
		if (key === void 0 || !managed.has(key) || !input.has(key)) {
			output.push(line);
			continue;
		}
		written.add(key);
		const next = input.get(key);
		if (next !== "") output.push(`${key}=${next}`);
	}
	for (const [key, value] of input) if (!written.has(key) && value !== "") output.push(`${key}=${value}`);
	const text = `${output.join("\n").replace(/\n*$/, "")}\n`;
	await mkdir(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	await writeFile(tmp, text, "utf8");
	await rename(tmp, path);
	const merged = { ...process.env };
	for (const [key, value] of input) if (value === "") delete merged[key];
	else merged[key] = value;
	return {
		...view(dataRoot, merged),
		restart_required: true
	};
}
//#endregion
//#region src/deps.ts
/**
* 引擎 Python 依赖体检（`GET /kstock-api/dependencies`）。
*
* 与壳侧 deps.ts 引导闭环：壳负责装（pip --target 到 ``<dataRoot>/py-deps``
* 并前置 PYTHONPATH），本模块负责「现在到底缺什么」的机器可读视图——
* python 解释器/pip 可用性、逐依赖 import 探针与版本、就绪 marker。
* 探针用与引擎子进程一致的环境（PYTHONPATH 含 py-deps）。
*/
/** 体检的依赖全集（import 名与展示名）。 */
const PROBE_MODULES = [
	"pandas",
	"numpy",
	"requests",
	"dotenv",
	"tushare",
	"matplotlib"
];
function probeEnvironment(depsDir) {
	const existing = process.env.PYTHONPATH;
	return existing === void 0 ? {
		...process.env,
		PYTHONPATH: depsDir
	} : {
		...process.env,
		PYTHONPATH: `${depsDir}:${existing}`
	};
}
function resolvePythonBin() {
	for (const bin of ["python3", "python"]) {
		const probe = spawnSync(bin, ["--version"], {
			encoding: "utf8",
			timeout: 15e3
		});
		if (probe.status === 0) return {
			bin,
			version: (probe.stdout ?? probe.stderr ?? "").trim().split(/\s+/).pop() ?? ""
		};
	}
	return {
		bin: null,
		version: null
	};
}
/** 依赖体检视图：python/pip/逐依赖状态 + 引导层目录与 marker。 */
function dependenciesView(dataRoot) {
	const depsDir = join(dataRoot, "py-deps");
	const env = probeEnvironment(depsDir);
	const python = resolvePythonBin();
	const pipOk = python.bin === null ? false : spawnSync(python.bin, [
		"-m",
		"pip",
		"--version"
	], {
		encoding: "utf8",
		timeout: 3e4
	}).status === 0;
	const deps = {};
	if (python.bin !== null) for (const module of PROBE_MODULES) {
		const probe = spawnSync(python.bin, ["-c", `import ${module}; v = getattr(${module}, '__version__', ''); print(v)`], {
			encoding: "utf8",
			timeout: 6e4,
			env
		});
		if (probe.status === 0) deps[module] = {
			ok: true,
			version: (probe.stdout ?? "").trim() || null
		};
		else deps[module] = {
			ok: false,
			version: null,
			error: (probe.stderr ?? "").trim().split("\n")[0]
		};
	}
	const marker = python.version === null ? null : join(depsDir, `.ready-${python.version.split(".").slice(0, 2).join(".")}`);
	return {
		python: {
			bin: python.bin,
			version: python.version,
			pip: pipOk
		},
		py_deps_dir: depsDir,
		py_deps_present: existsSync(depsDir),
		ready_marker: marker !== null && existsSync(marker),
		deps,
		install_hint: "缺失时由桌面壳启动引导自动安装（pip --target py-deps）；也可手动执行 python3 -m pip install --target ~/.kstock/py-deps pandas numpy tushare requests python-dotenv matplotlib"
	};
}
//#endregion
//#region src/index.ts
/** 非 JSON 响应的直通形态（报告 HTML 正文等）。 */
var RawResponse = class {
	status;
	headers;
	body;
	constructor(status, headers, body) {
		this.status = status;
		this.headers = headers;
		this.body = body;
	}
};
/** 读取请求体并解析 JSON；空体返回空对象。 */
function readJson(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => {
			const text = Buffer.concat(chunks).toString("utf-8");
			if (text === "") return resolve({});
			try {
				resolve(JSON.parse(text));
			} catch {
				reject(new StoreError(422, "请求体不是合法 JSON"));
			}
		});
		req.on("error", reject);
	});
}
function sendJson(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
/** 公共只读接口不支持的写方法统一 405。 */
function throwMethod(method) {
	throw new StoreError(405, `method ${method} not allowed`);
}
/** 桌面单用户数据桶。 */
const USER_ID = "kstock-local";
/** 必需服务：webserver 路由表。 */
const inject = ["webServer"];
/**
* 注册三库数据路由。数据根目录取 `KSTOCK_APP_DATA_DIR`（Electron 托管
* 进程注入；缺省回落 ~/.kstock，与 1.x 一致）。
*/
function apply(ctx) {
	const dataRoot = process.env.KSTOCK_APP_DATA_DIR ?? `${process.env.HOME ?? ""}/.kstock`;
	const stores = {
		strategies: strategyStore(dataRoot),
		factors: factorStore(dataRoot),
		selections: selectionStore(dataRoot)
	};
	const reports = new ReportsStore(dataRoot);
	const newsArchive = new NewsStore(dataRoot);
	ctx.webServer.register({
		kind: "prefix",
		path: "/kstock-api",
		handler: async (req, res) => {
			try {
				const result = await dispatch(stores, reports, req, dataRoot, newsArchive);
				if (result instanceof RawResponse) {
					res.writeHead(result.status, result.headers);
					res.end(result.body);
				} else sendJson(res, 200, result);
			} catch (error) {
				if (error instanceof StoreError) sendJson(res, error.status, { detail: error.message });
				else sendJson(res, 500, { detail: error instanceof Error ? error.message : String(error) });
			}
		}
	});
}
/** 各库实体的文本列取值（create/PATCH 共用）。 */
function entityText(libraryKey, body, create) {
	const text = {};
	if (body.hypothesis !== void 0 && libraryKey !== "selections") text.hypothesis = String(body.hypothesis);
	if (create && libraryKey === "factors") text.category = String(body.category ?? "custom");
	if (body.criteria !== void 0 && libraryKey === "selections") text.criteria = String(body.criteria);
	return text;
}
async function dispatch(stores, reports, req, dataRoot, newsArchive) {
	const url = new URL(req.url ?? "/", "http://local");
	const segments = decodeURIComponent(url.pathname).split("/").filter(Boolean);
	const libraryKey = segments[1];
	const method = (req.method ?? "GET").toUpperCase();
	if (libraryKey === "landing-news") return method === "GET" ? landingNews() : throwMethod(method);
	if (libraryKey === "workspace-news") {
		if (method !== "GET") throwMethod(method);
		const payload = await workspaceNews();
		try {
			newsArchive.archive(payload.items);
		} catch (error) {
			console.error("[kstock-news] archive failed:", error);
		}
		return payload;
	}
	if (libraryKey === "news-archive") {
		if (method === "GET") {
			const query = (url.searchParams.get("q") ?? "").trim();
			const hours = Math.min(720, Math.max(1, Number(url.searchParams.get("hours")) || 24));
			const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
			return {
				items: newsArchive.search(query, hours, limit),
				hours,
				limit
			};
		}
		throwMethod(method);
	}
	if (libraryKey === "news-stats") {
		if (method === "GET") {
			const universe = await stockUniverse();
			const dictionary = universe !== null ? dictionaryWords(universe) : [];
			return {
				trending: newsArchive.trending(6 * 36e5, 12, dictionary),
				frequency: newsArchive.frequency(24 * 36e5, 36e5),
				dictionary_size: dictionary.length
			};
		}
		throwMethod(method);
	}
	if (libraryKey === "data-source-status") return method === "GET" ? dataSourceStatus() : throwMethod(method);
	if (libraryKey === "dependencies") {
		if (method === "GET") return dependenciesView(dataRoot);
		throwMethod(method);
	}
	if (libraryKey === "data-sources") {
		if (method === "GET") return dataSourcesView(dataRoot);
		if (method === "PUT") return saveDataSources(dataRoot, (await readJson(req)).values);
		throwMethod(method);
	}
	if (libraryKey === "reports") return dispatchReports(reports, req, url, method, segments.slice(2));
	const library = libraryKey ?? "";
	const store = stores[library];
	if (store === void 0) throw new StoreError(404, "not found");
	const key = {
		strategies: "strategy",
		factors: "factor",
		selections: "selection"
	}[library];
	const [entityId, kind, third, fourth] = segments.slice(2);
	if (entityId === void 0) {
		if (method === "GET") return store.list(USER_ID);
		if (method === "POST") {
			const body = await readJson(req);
			return store.create(USER_ID, String(body.name ?? ""), entityText(library, body, true));
		}
	}
	if (kind === void 0) {
		if (method === "GET") return store.get(USER_ID, entityId);
		if (method === "PATCH") {
			const body = await readJson(req);
			return store.update(USER_ID, entityId, {
				name: body.name === void 0 ? void 0 : String(body.name),
				status: body.status === void 0 ? void 0 : String(body.status),
				text: entityText(library, body, false)
			});
		}
	}
	if (kind === "versions") {
		if (third === void 0) {
			if (method === "GET") return store.listVersions(USER_ID, entityId);
			if (method === "POST") {
				const body = await readJson(req);
				return store.saveVersion(USER_ID, entityId, {
					code: body.code === void 0 ? void 0 : String(body.code),
					criteria: body.criteria,
					params: body.params,
					change_note: body.change_note === void 0 ? void 0 : String(body.change_note),
					parent_version: body.parent_version === void 0 || body.parent_version === null ? null : Number(body.parent_version)
				});
			}
		}
		return store.getVersion(USER_ID, entityId, Number(third));
	}
	if (kind === "runs") {
		if (third === void 0) {
			if (method === "GET") {
				const version = url.searchParams.get("version");
				return store.listRuns(USER_ID, entityId, version === null ? void 0 : Number(version));
			}
			if (method === "POST") {
				const body = await readJson(req);
				return store.recordRun(USER_ID, entityId, body);
			}
		}
		if (fourth !== void 0) return store.getRunAttachment(USER_ID, entityId, third, fourth);
		return store.listRuns(USER_ID, entityId).find((run) => run.run_id === third) ?? (() => {
			throw new StoreError(404, `运行记录不存在：${third}`);
		})();
	}
	if (kind === "compare") {
		const runs = (url.searchParams.get("runs") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
		if (runs.length < 2) throw new StoreError(422, "对比至少需要 2 个 run_id（逗号分隔）");
		return store.compareRuns(USER_ID, entityId, runs);
	}
	throw new StoreError(404, `not found: ${key}/${kind ?? ""}`);
}
/** 报告库路由：GET 列表/单条/正文、DELETE 删除、POST agent 入库口。 */
async function dispatchReports(store, req, url, method, rest) {
	const [reportId, kind] = rest;
	if (reportId === void 0) {
		if (method === "GET") return { reports: store.list(USER_ID, {
			date: url.searchParams.get("date") ?? void 0,
			symbol: url.searchParams.get("symbol") ?? void 0,
			query: url.searchParams.get("query") ?? void 0
		}) };
		if (method === "POST") {
			const body = await readJson(req);
			return store.archive(USER_ID, {
				threadId: String(body.thread_id ?? ""),
				reportId: body.report_id === void 0 ? void 0 : String(body.report_id),
				title: body.title === void 0 ? void 0 : String(body.title),
				symbol: body.symbol === void 0 ? void 0 : String(body.symbol),
				reportType: body.report_type === void 0 ? void 0 : String(body.report_type),
				generatedAt: body.generated_at === void 0 ? void 0 : String(body.generated_at),
				periodStart: body.period_start === void 0 ? void 0 : String(body.period_start),
				periodEnd: body.period_end === void 0 ? void 0 : String(body.period_end),
				riskLevel: body.risk_level === void 0 ? void 0 : String(body.risk_level),
				coverageStatus: body.coverage_status === void 0 ? void 0 : String(body.coverage_status),
				content: String(body.content ?? "")
			});
		}
	}
	if (kind === void 0) {
		if (method === "GET") {
			const row = store.find(USER_ID, reportId);
			if (row === null) throw new StoreError(404, "报告不存在");
			return {
				...row,
				content_url: `/kstock-api/reports/${reportId}/content`
			};
		}
		if (method === "DELETE") {
			store.delete(USER_ID, reportId);
			return {
				deleted: true,
				report_id: reportId
			};
		}
	}
	if (kind === "content" && method === "GET") return new RawResponse(200, {
		"content-type": "text/html; charset=utf-8",
		"content-disposition": "inline",
		"content-security-policy": "sandbox allow-scripts",
		"x-content-type-options": "nosniff"
	}, store.readContent(USER_ID, reportId));
	throw new StoreError(404, `not found: reports/${kind ?? ""}`);
}
//#endregion
export { apply, inject };
