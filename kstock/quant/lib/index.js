import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
const CACHE_TTL_MS = 6e4;
/** 落地页最多展示 10 条（1.x LandingPage slice(0, 10)）。 */
const MAX_ITEMS = 10;
const HTTP_TIMEOUT_MS = 8e3;
/** 部分公开接口会拒绝非常规 UA（requests/fetch 默认值），带浏览器 UA。 */
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
let cache = null;
let inflight = null;
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
		signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
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
				signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
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
async function refreshLandingNews() {
	let items = [];
	try {
		items = await fetchEastmoney(MAX_ITEMS);
	} catch {}
	if (items.length < MAX_ITEMS) try {
		items = [...items, ...await fetchCctv(MAX_ITEMS - items.length)];
	} catch {}
	if (items.length > 0) cache = {
		at: Date.now(),
		payload: {
			items,
			updated_at: (/* @__PURE__ */ new Date()).toISOString()
		}
	};
	return {
		items,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	};
}
/**
* 读取落地页快讯：60 秒内存缓存；并发请求合并到同一次刷新。
* 失败不抛错——返回空列表由落地页渲染空态。
*/
async function landingNews() {
	if (cache !== null && Date.now() - cache.at < CACHE_TTL_MS) return cache.payload;
	if (inflight === null) inflight = refreshLandingNews().finally(() => {
		inflight = null;
	});
	return inflight;
}
/** 与 1.x scripts/kstock_data_sources.py 的 `_DATA_SOURCES` 一致。 */
const DATA_SOURCES = [[
	"tushare",
	"Tushare Pro",
	"TUSHARE_TOKEN"
], [
	"iwencai",
	"同花顺问财",
	"IWENCAI_API_KEY"
]];
function dataSourceStatus() {
	return { sources: DATA_SOURCES.map(([id, label, envName]) => ({
		id,
		label,
		env_name: envName,
		configured: Boolean(process.env[envName])
	})) };
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
	ctx.webServer.register({
		kind: "prefix",
		path: "/kstock-api",
		handler: async (req, res) => {
			try {
				const result = await dispatch(stores, reports, req);
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
async function dispatch(stores, reports, req) {
	const url = new URL(req.url ?? "/", "http://local");
	const segments = decodeURIComponent(url.pathname).split("/").filter(Boolean);
	const libraryKey = segments[1];
	const method = (req.method ?? "GET").toUpperCase();
	if (libraryKey === "landing-news") return method === "GET" ? landingNews() : throwMethod(method);
	if (libraryKey === "data-source-status") return method === "GET" ? dataSourceStatus() : throwMethod(method);
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
