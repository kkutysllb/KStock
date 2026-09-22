window.__ModuleLoader__.load({ id: "@kstock/automation", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  createAutomationsRuntime: () => createAutomationsRuntime,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/AutomationsView.tsx
var import_react = require("react");

// src/client/form.ts
var COMMON_ZONES = [
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC"
];
function emptyForm(nowIso, workspaceId = "") {
  return {
    name: "",
    prompt: "",
    workspaceId,
    scheduleKind: "daily",
    onceAt: localInputValue(new Date(Date.parse(nowIso) + 36e5)),
    everyMinutes: "30",
    wallTime: "09:30",
    weekdays: [1, 2, 3, 4, 5],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
    permission: "read-only",
    followModel: true,
    provider: "",
    model: "",
    effort: ""
  };
}
function localInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formToSchedule(form, lang) {
  switch (form.scheduleKind) {
    case "once": {
      if (form.onceAt.trim() === "") return lang === "zh" ? "\u8BF7\u586B\u5199\u6267\u884C\u65F6\u523B" : "Set the run time";
      const parsed = Date.parse(form.onceAt.trim());
      if (Number.isNaN(parsed)) return lang === "zh" ? "\u6267\u884C\u65F6\u523B\u4E0D\u662F\u6709\u6548\u65F6\u95F4" : "The run time is not a valid instant";
      return { schedule: { kind: "once", at: new Date(parsed).toISOString() }, timeZone: "" };
    }
    case "interval": {
      const minutes = Number(form.everyMinutes);
      if (!Number.isSafeInteger(minutes) || minutes < 5) {
        return lang === "zh" ? "\u95F4\u9694\u987B\u4E3A\u6574\u6570\u4E14 \u2265 5 \u5206\u949F" : "Interval must be an integer \u2265 5 minutes";
      }
      return { schedule: { kind: "interval", everyMinutes: minutes }, timeZone: "" };
    }
    case "daily":
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(form.wallTime)) {
        return lang === "zh" ? "\u65F6\u95F4\u683C\u5F0F\u987B\u4E3A HH:mm" : "Time must be HH:mm";
      }
      return { schedule: { kind: "daily", time: form.wallTime }, timeZone: form.timeZone };
    case "weekly":
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(form.wallTime)) {
        return lang === "zh" ? "\u65F6\u95F4\u683C\u5F0F\u987B\u4E3A HH:mm" : "Time must be HH:mm";
      }
      if (form.weekdays.length === 0) return lang === "zh" ? "\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u661F\u671F" : "Pick at least one weekday";
      return {
        schedule: { kind: "weekly", time: form.wallTime, weekdays: [...form.weekdays].sort((a, b) => a - b) },
        timeZone: form.timeZone
      };
  }
}
function formToModelTarget(form) {
  if (form.followModel) return null;
  const provider = form.provider.trim();
  const model = form.model.trim();
  if (provider === "" || model === "") return null;
  const effort = form.effort.trim();
  return { provider, model, reasoningEffort: effort === "" ? null : effort };
}
function formatWhen(iso) {
  if (iso === void 0 || iso === "") return "\u2014";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  const date = new Date(parsed);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatDuration(startedAt, finishedAt, lang) {
  if (startedAt === void 0 || finishedAt === void 0) return "\u2014";
  const ms = Date.parse(finishedAt) - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return "\u2014";
  const seconds = Math.round(ms / 1e3);
  if (seconds < 60) return lang === "zh" ? `${seconds} \u79D2` : `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return lang === "zh" ? `${minutes} \u5206 ${seconds % 60} \u79D2` : `${minutes}m ${seconds % 60}s`;
  return lang === "zh" ? `${Math.floor(minutes / 60)} \u65F6 ${minutes % 60} \u5206` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function statusLabel(status, t) {
  switch (status) {
    case "queued":
      return t("statusQueued");
    case "running":
      return t("statusRunning");
    case "succeeded":
      return t("statusSucceeded");
    case "failed":
      return t("statusFailed");
    case "skipped":
      return t("statusSkipped");
    case "cancelled":
      return t("statusCancelled");
  }
}
function statusClass(status) {
  return `kyl-status kyl-status-${status}`;
}
function sortRunsDesc(runs) {
  return [...runs].sort((a, b) => Date.parse(b.scheduledFor) - Date.parse(a.scheduledFor) || Date.parse(b.finishedAt ?? "") - Date.parse(a.finishedAt ?? ""));
}

// src/client/AutomationsView.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var POLL_MS = 3e3;
function AutomationsView(props) {
  const { t, runtime, lang, openSession, backToConversation, loadModelCatalog, pickDirectory } = props;
  const state = (0, import_react.useSyncExternalStore)(runtime.source.subscribe, runtime.source.getSnapshot);
  const [editor, setEditor] = (0, import_react.useState)({ open: false, mode: "create", form: emptyForm((/* @__PURE__ */ new Date()).toISOString()) });
  const [workspaceFilter, setWorkspaceFilter] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)(void 0);
  (0, import_react.useEffect)(() => {
    let stopped = false;
    const poll = () => {
      if (!stopped) void runtime.refresh().catch(() => void 0);
    };
    poll();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, POLL_MS);
    const onVisible = () => {
      poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runtime]);
  const snapshot = state.snapshot;
  const automations = (0, import_react.useMemo)(
    () => (snapshot?.automations ?? []).filter((view) => workspaceFilter === "" || view.workspaceId === workspaceFilter),
    [snapshot, workspaceFilter]
  );
  const runs = (0, import_react.useMemo)(
    () => sortRunsDesc(snapshot?.runs ?? []).filter((run) => {
      if (workspaceFilter === "") return true;
      const owner = snapshot?.automations?.find((view) => view.id === run.automationId);
      return owner !== void 0 && (workspaceFilter === "" || owner.workspaceId === workspaceFilter);
    }),
    [snapshot, workspaceFilter]
  );
  const closeEditor = () => {
    setEditor({ open: false, mode: "create", form: emptyForm((/* @__PURE__ */ new Date()).toISOString()) });
  };
  const openCreate = () => {
    const defaultWorkspace = workspace?.registered === true && workspace.id !== "" ? workspace.id : snapshot?.workspaces?.[0]?.id ?? "";
    setEditor({
      open: true,
      mode: "create",
      form: emptyForm(snapshot?.serverNow ?? (/* @__PURE__ */ new Date()).toISOString(), defaultWorkspace)
    });
  };
  const openEdit = (automation) => {
    setEditor({ open: true, mode: "edit", automationId: automation.id, form: automationToForm(automation) });
  };
  const submitEditor = async () => {
    const scheduleResult = formToSchedule(editor.form, lang);
    if (typeof scheduleResult === "string") return;
    try {
      if (editor.mode === "create") {
        await runtime.create({
          name: editor.form.name.trim(),
          prompt: editor.form.prompt,
          workspaceId: editor.form.workspaceId,
          schedule: scheduleResult.schedule,
          timeZone: scheduleResult.timeZone,
          permission: editor.form.permission,
          modelTarget: formToModelTarget(editor.form)
        });
        setNotice(t("createdHint"));
      } else if (editor.automationId !== void 0) {
        const current = automations.find((item) => item.id === editor.automationId);
        await runtime.update(editor.automationId, current?.revision ?? 1, {
          name: editor.form.name.trim(),
          prompt: editor.form.prompt,
          schedule: scheduleResult.schedule,
          timeZone: scheduleResult.timeZone,
          permission: editor.form.permission,
          modelTarget: formToModelTarget(editor.form)
        });
      }
      closeEditor();
      await runtime.refresh();
    } catch (error) {
      console.warn("[dsh-kylin-automation] editor submit failed:", error);
    }
  };
  const mutate = async (id, mutation) => {
    if (mutation === "delete" && !window.confirm(t("deleteConfirm"))) return;
    try {
      await runtime.mutate(id, mutation);
      if (editor.open && editor.automationId === id && mutation === "delete") closeEditor();
      await runtime.refresh();
    } catch (error) {
      setNotice(`${t("updateFailed")}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const runNow = async (id) => {
    try {
      await runtime.runNow(id);
      setNotice(t("runQueued"));
    } catch (error) {
      setNotice(`${t("updateFailed")}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  if (state.phase === "error" && snapshot === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-panel", "data-panel": "automations", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelHeader, { t, onBack: backToConversation }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kyl-empty-hint", children: state.error ?? t("unavailable") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kyl-btn", onClick: () => {
          void runtime.refresh();
        }, children: t("refresh") })
      ] })
    ] });
  }
  const workspace = snapshot?.workspace;
  const policy = snapshot?.policy;
  const shieldHostShortcuts = (event) => {
    if ((event.metaKey || event.ctrlKey) && ["a", "c", "v", "x"].includes(event.key.toLowerCase())) {
      event.stopPropagation();
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: "kyl-panel",
      "data-panel": "automations",
      onKeyDown: shieldHostShortcuts,
      onKeyDownCapture: shieldHostShortcuts,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelHeader, { t, onBack: backToConversation }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-toolbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-scope", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "select",
              {
                className: "kyl-input kyl-select-inline",
                value: workspaceFilter,
                title: workspace?.cwd,
                onChange: (event) => setWorkspaceFilter(event.target.value),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: t("allWorkspaces") }),
                  (snapshot?.workspaces ?? []).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: item.id, children: item.title }, item.id))
                ]
              }
            ),
            workspaceFilter === "" && workspace !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kyl-chip", children: [
              t("workspace"),
              ": ",
              workspace.title
            ] }),
            workspace === void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-chip kyl-chip-muted", children: t("standaloneHint") }),
            policy !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-chip kyl-chip-muted", children: t("policyHint", { timeout: policy.runTimeoutMinutes, grace: policy.misfireGraceMinutes }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kyl-btn", onClick: () => {
              void runtime.refresh();
            }, children: t("refresh") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kyl-btn kyl-btn-primary", onClick: openCreate, children: t("newTask") })
          ] })
        ] }),
        notice !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kyl-notice", role: "status", onClick: () => setNotice(void 0), children: notice }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kyl-section", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { className: "kyl-section-title", children: [
              t("listTitle"),
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-count", children: automations.length })
            ] }),
            automations.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-empty", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kyl-empty-title", children: t("emptyTitle") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kyl-empty-hint", children: t("emptyHint") })
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "kyl-cards", children: automations.map((automation) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              AutomationCard,
              {
                automation,
                t,
                onRunNow: () => {
                  void runNow(automation.id);
                },
                onToggle: () => {
                  void mutate(automation.id, automation.status === "active" ? "pause" : "resume");
                },
                onEdit: () => openEdit(automation),
                onDelete: () => {
                  void mutate(automation.id, "delete");
                },
                onClearHistory: () => {
                  if (window.confirm(t("clearRunsConfirm"))) {
                    void runtime.clearRuns(automation.id).then((count) => {
                      setNotice(t("runsCleared", { count }));
                    }).catch((error) => {
                      setNotice(error instanceof Error ? error.message : String(error));
                    });
                  }
                }
              },
              automation.id
            )) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kyl-section", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "kyl-section-title", children: t("runsTitle") }),
            runs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kyl-empty-hint", children: t("runsEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "kyl-runs", children: runs.map((run) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              RunRow,
              {
                run,
                t,
                lang,
                onOpenSession: openSession,
                onDelete: () => {
                  if (window.confirm(t("deleteRunConfirm"))) {
                    void runtime.deleteRun(run.automationId, run.id).catch((error) => {
                      setNotice(error instanceof Error ? error.message : String(error));
                    });
                  }
                }
              },
              run.id
            )) })
          ] })
        ] }),
        editor.open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          AutomationEditor,
          {
            t,
            mode: editor.mode,
            form: editor.form,
            workspaces: snapshot?.workspaces,
            currentCwd: workspace?.cwd,
            loadModelCatalog,
            pickDirectory,
            onRegisterWorkspace: (path) => runtime.registerWorkspace(path),
            onChange: (form) => setEditor((current) => ({ ...current, form })),
            onSubmit: () => {
              void submitEditor();
            },
            onCancel: closeEditor
          }
        )
      ]
    }
  );
}
function PanelHeader(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "kyl-header", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { className: "kyl-title", children: props.t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "kyl-subtitle", children: props.t("subtitle") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: "kyl-btn kyl-btn-ghost", onClick: props.onBack, children: [
      "\u2190 ",
      props.t("backToList")
    ] })
  ] });
}
function AutomationCard(props) {
  const { automation, t } = props;
  const active = automation.status === "active";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "kyl-card", "data-status": automation.status, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-card-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-badge", "data-active": active || void 0, children: active ? t("active") : t("paused") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-card-name", title: automation.prompt, children: automation.name }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kyl-chip kyl-chip-muted", children: [
        t("revision"),
        " ",
        automation.revision
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-chip", "data-permission": automation.permission, children: automation.permission === "read-only" ? t("permissionReadOnly") : t("permissionWorkspaceWrite") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-chip kyl-chip-muted", children: automation.model === null ? t("modelGlobal") : `${automation.model.provider}/${automation.model.model}` })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kyl-card-schedule", children: automation.scheduleSummary }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-card-facts", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        t("nextRun"),
        ": ",
        formatWhen(automation.nextRunAt)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        t("lastRun"),
        ": ",
        formatWhen(automation.lastRunAt)
      ] }),
      automation.lastRunStatus !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: statusClass(automation.lastRunStatus), children: statusLabel(automation.lastRunStatus, t) })
    ] }),
    automation.lastRunSummary !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kyl-card-summary", children: automation.lastRunSummary.slice(0, 200) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-card-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kyl-btn", onClick: props.onRunNow, children: t("runNow") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kyl-btn", onClick: props.onToggle, children: active ? t("pause") : t("resume") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kyl-btn", onClick: props.onEdit, children: t("editTask") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kyl-btn kyl-btn-ghost", onClick: props.onClearHistory, children: t("clearRunsLabel") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kyl-btn kyl-btn-danger", onClick: props.onDelete, children: t("delete") })
    ] })
  ] });
}
function RunRow(props) {
  const { run, t, lang } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "kyl-run", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-run-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: statusClass(run.status), children: statusLabel(run.status, t) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-run-name", children: run.automationName }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-chip kyl-chip-muted", children: run.trigger === "manual" ? t("triggerManual") : t("triggerSchedule") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-run-when", children: formatWhen(run.scheduledFor) }),
      run.startedAt !== void 0 && run.finishedAt !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kyl-chip kyl-chip-muted", children: [
        t("duration"),
        " ",
        formatDuration(run.startedAt, run.finishedAt, lang)
      ] }),
      run.sessionId !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "kyl-btn kyl-btn-ghost",
          onClick: () => {
            if (run.sessionId !== void 0) props.onOpenSession(run.sessionId);
          },
          children: t("openSession")
        }
      ),
      run.status !== "queued" && run.status !== "running" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "kyl-btn kyl-btn-ghost",
          onClick: props.onDelete,
          children: t("runDelete")
        }
      )
    ] }),
    run.skipReason !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-run-note", children: [
      t("statusSkipped"),
      " \xB7 ",
      run.skipReason === "overlap" ? t("skipOverlap") : t("skipMisfire")
    ] }),
    run.error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-run-error", children: [
      run.error.code,
      ": ",
      run.error.message
    ] }),
    run.summary !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kyl-run-summary", children: run.summary.slice(0, 400) })
  ] });
}
function AutomationEditor(props) {
  const { t, form, onChange, pickDirectory } = props;
  const [catalog, setCatalog] = (0, import_react.useState)(void 0);
  const [catalogNote, setCatalogNote] = (0, import_react.useState)("idle");
  const [registerOpen, setRegisterOpen] = (0, import_react.useState)(false);
  const [newPath, setNewPath] = (0, import_react.useState)("");
  const [registerError, setRegisterError] = (0, import_react.useState)(void 0);
  const [registering, setRegistering] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    if (form.followModel || catalog !== void 0) return;
    if (props.loadModelCatalog === void 0) {
      setCatalogNote("loader-missing");
      return;
    }
    void props.loadModelCatalog().then((loaded) => {
      setCatalog(loaded.groups);
      setCatalogNote(`loaded:${loaded.groups.length}`);
    }).catch((error) => {
      setCatalogNote(`error:${error instanceof Error ? error.message.slice(0, 120) : String(error).slice(0, 120)}`);
      setCatalog([]);
    });
  }, [form.followModel, catalog, props.loadModelCatalog]);
  const providerModels = catalog?.find((group) => group.id === form.provider)?.models ?? [];
  const modelMeta = providerModels.find((model) => model.id === form.model);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kyl-editor-scrim", role: "presentation", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: "kyl-editor",
      role: "dialog",
      "data-catalog": catalogNote,
      "aria-label": props.mode === "create" ? t("createTitle") : t("editTitle"),
      onClick: (event) => {
        event.stopPropagation();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "kyl-editor-title", children: props.mode === "create" ? t("createTitle") : t("editTitle") }),
        props.workspaces !== void 0 && props.mode === "create" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("workspaceLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "select",
            {
              className: "kyl-input",
              value: form.workspaceId,
              onChange: (event) => onChange({ ...form, workspaceId: event.target.value }),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: t("workspaceRequired") }),
                props.workspaces.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: item.id, children: [
                  item.title,
                  " \xB7 ",
                  item.cwd
                ] }, item.id))
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "kyl-linkbtn",
              onClick: () => {
                setRegisterOpen((open) => !open);
                setRegisterError(void 0);
              },
              children: registerOpen ? t("newWorkspaceHide") : t("newWorkspaceAction")
            }
          ),
          registerOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-iter", children: [
            props.pickDirectory !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "kyl-btn",
                disabled: registering,
                onClick: () => {
                  setRegistering(true);
                  props.pickDirectory().then((picked) => {
                    if (picked === null || picked === "") return void 0;
                    return props.onRegisterWorkspace(picked).then((created) => {
                      onChange({ ...form, workspaceId: created.id });
                      setRegisterOpen(false);
                      setNewPath("");
                    });
                  }).catch((error) => {
                    setRegisterError(error instanceof Error ? error.message : String(error));
                  }).finally(() => setRegistering(false));
                },
                children: registering ? t("newWorkspacePicking") : t("newWorkspacePick")
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("newWorkspacePathLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: "kyl-input",
                value: newPath,
                placeholder: "/Users/you/workspace-name",
                spellCheck: false,
                onChange: (event) => {
                  setNewPath(event.target.value);
                  setRegisterError(void 0);
                }
              }
            ),
            registerError !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-error", children: registerError }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "kyl-btn",
                disabled: newPath.trim() === "" || registering,
                onClick: () => {
                  setRegistering(true);
                  props.onRegisterWorkspace(newPath.trim()).then((created) => {
                    onChange({ ...form, workspaceId: created.id });
                    setRegisterOpen(false);
                    setNewPath("");
                  }).catch((error) => {
                    setRegisterError(error instanceof Error ? error.message : String(error));
                  }).finally(() => setRegistering(false));
                },
                children: registering ? t("newWorkspaceRegistering") : t("newWorkspaceRegister")
              }
            )
          ] })
        ] }),
        props.mode === "edit" && props.workspaces !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("workspaceLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-chip kyl-chip-muted", children: props.workspaces.find((item) => item.id === form.workspaceId)?.title ?? props.workspaces.find((item) => item.cwd === props.currentCwd)?.title ?? t("workspaceRequired") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("nameLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              className: "kyl-input",
              value: form.name,
              placeholder: t("namePlaceholder"),
              onChange: (event) => onChange({ ...form, name: event.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("promptLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "textarea",
            {
              className: "kyl-input kyl-textarea",
              rows: 6,
              value: form.prompt,
              placeholder: t("promptPlaceholder"),
              onChange: (event) => onChange({ ...form, prompt: event.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-field-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("scheduleLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "select",
              {
                className: "kyl-input",
                value: form.scheduleKind,
                onChange: (event) => onChange({ ...form, scheduleKind: event.target.value }),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "once", children: t("scheduleOnce") }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "interval", children: t("scheduleInterval") }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "daily", children: t("scheduleDaily") }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "weekly", children: t("scheduleWeekly") })
                ]
              }
            )
          ] }),
          form.scheduleKind === "once" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("onceAt") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: "kyl-input",
                type: "datetime-local",
                value: form.onceAt,
                onChange: (event) => onChange({ ...form, onceAt: event.target.value })
              }
            )
          ] }),
          form.scheduleKind === "interval" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("everyMinutes") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: "kyl-input",
                type: "number",
                min: 5,
                value: form.everyMinutes,
                onChange: (event) => onChange({ ...form, everyMinutes: event.target.value })
              }
            )
          ] }),
          (form.scheduleKind === "daily" || form.scheduleKind === "weekly") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: form.scheduleKind === "daily" ? t("dailyTime") : t("weeklyTime") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: "kyl-input",
                type: "time",
                value: form.wallTime,
                onChange: (event) => onChange({ ...form, wallTime: event.target.value })
              }
            )
          ] })
        ] }),
        form.scheduleKind === "weekly" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("weekdays") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kyl-weekdays", children: WEEKDAY_LABELS.map((label, index) => {
            const day = index + 1;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "kyl-weekday",
                "data-on": form.weekdays.includes(day) || void 0,
                onClick: () => {
                  onChange({
                    ...form,
                    weekdays: form.weekdays.includes(day) ? form.weekdays.filter((item) => item !== day) : [...form.weekdays, day]
                  });
                },
                children: t(label)
              },
              day
            );
          }) })
        ] }),
        (form.scheduleKind === "daily" || form.scheduleKind === "weekly") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("timeZoneLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              className: "kyl-input",
              list: "kyl-zone-list",
              value: form.timeZone,
              onChange: (event) => onChange({ ...form, timeZone: event.target.value })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", { id: "kyl-zone-list", children: COMMON_ZONES.map((zone) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: zone }, zone)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-field-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("permissionLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-permissions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "button",
              {
                type: "button",
                className: "kyl-perm",
                "data-on": form.permission === "read-only" || void 0,
                onClick: () => onChange({ ...form, permission: "read-only" }),
                children: [
                  t("permissionReadOnly"),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: t("permissionReadOnlyHint") })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "button",
              {
                type: "button",
                className: "kyl-perm",
                "data-on": form.permission === "workspace-write" || void 0,
                onClick: () => onChange({ ...form, permission: "workspace-write" }),
                children: [
                  t("permissionWorkspaceWrite"),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: t("permissionWorkspaceWriteHint") })
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-field-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("modelLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-model-picker", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-radio", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "radio", checked: form.followModel, onChange: () => onChange({ ...form, followModel: true }) }),
              t("modelFollow")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-radio", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "radio", checked: !form.followModel, onChange: () => onChange({ ...form, followModel: false }) }),
              t("modelPin")
            ] }),
            !form.followModel && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-model-fields", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("providerLabel") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "select",
                  {
                    className: "kyl-input",
                    value: form.provider,
                    onChange: (event) => onChange({ ...form, provider: event.target.value, model: "", effort: "" }),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: "\u2014" }),
                      (catalog ?? []).map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: group.id, children: group.name }, group.id))
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("modelIdLabel") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "select",
                  {
                    className: "kyl-input",
                    value: form.model,
                    onChange: (event) => onChange({ ...form, model: event.target.value, effort: "" }),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: "\u2014" }),
                      providerModels.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: model.id, children: model.name }, model.id))
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kyl-field", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kyl-field-label", children: t("effortLabel") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "select",
                  {
                    className: "kyl-input",
                    value: form.effort,
                    onChange: (event) => onChange({ ...form, effort: event.target.value }),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: t("effortDefault") }),
                      (modelMeta?.reasoning?.efforts ?? []).map((effort) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: effort.id, children: effort.name }, effort.id))
                    ]
                  }
                )
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kyl-editor-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kyl-btn", onClick: props.onCancel, children: t("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kyl-btn kyl-btn-primary", onClick: props.onSubmit, children: t("save") })
        ] })
      ]
    }
  ) });
}
var WEEKDAY_LABELS = [
  "weekdayMo",
  "weekdayTu",
  "weekdayWe",
  "weekdayTh",
  "weekdayFr",
  "weekdaySa",
  "weekdaySu"
];
function automationToForm(automation) {
  return {
    name: automation.name,
    prompt: automation.prompt,
    workspaceId: "",
    scheduleKind: automation.schedule.kind,
    onceAt: automation.schedule.at !== void 0 ? localInputValue(new Date(Date.parse(automation.schedule.at))) : "",
    everyMinutes: String(automation.schedule.everyMinutes ?? 30),
    wallTime: automation.schedule.time ?? "09:30",
    weekdays: [...automation.schedule.weekdays ?? []],
    timeZone: automation.timeZone !== "" ? automation.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone,
    permission: automation.permission,
    followModel: automation.model === null,
    provider: automation.model?.provider ?? "",
    model: automation.model?.model ?? "",
    effort: automation.model?.reasoningEffort ?? ""
  };
}

// src/client/locales.ts
var NS = "kylAuto";
var zh = {
  nav: "\u5B9A\u65F6\u4EFB\u52A1",
  title: "\u5B9A\u65F6\u4EFB\u52A1",
  subtitle: "\u628A\u53EF\u590D\u7528\u7684\u7F16\u7801\u4EFB\u52A1\u6309\u8BA1\u5212\u6295\u9012\u5230\u5168\u65B0 Agent \u4F1A\u8BDD\u72EC\u7ACB\u6267\u884C\uFF0C\u5386\u53F2\u53EF\u5BA1\u8BA1",
  refresh: "\u5237\u65B0",
  newTask: "\u65B0\u5EFA\u4EFB\u52A1",
  editTask: "\u7F16\u8F91\u4EFB\u52A1",
  workspace: "\u5DE5\u4F5C\u533A",
  allWorkspaces: "\u5168\u90E8\u5DE5\u4F5C\u533A",
  workspaceLabel: "\u7ED1\u5B9A\u5DE5\u4F5C\u533A",
  workspaceRequired: "\u8BF7\u9009\u62E9\u5DE5\u4F5C\u533A",
  scopeHint: "\u4EFB\u52A1\u4E0E\u8FD0\u884C\u5386\u53F2\u6309\u5DE5\u4F5C\u533A\u9694\u79BB",
  policyHint: "\u5355\u6B21\u8FD0\u884C\u4E0A\u9650 {timeout} \u5206\u949F \xB7 \u8865\u8DD1\u5BBD\u9650 {grace} \u5206\u949F",
  runDelete: "\u5220\u9664\u8BB0\u5F55",
  deleteRunConfirm: "\u5220\u9664\u8FD9\u6761\u8FD0\u884C\u8BB0\u5F55\uFF1F",
  clearRunsLabel: "\u6E05\u7A7A\u5386\u53F2",
  clearRunsConfirm: "\u6E05\u7A7A\u8BE5\u4EFB\u52A1\u7684\u5168\u90E8\u8FD0\u884C\u5386\u53F2\uFF1F",
  runsCleared: "\u5DF2\u6E05\u9664 {count} \u6761\u8FD0\u884C\u8BB0\u5F55",
  standaloneHint: "\u672A\u6302\u63A5\u4F1A\u8BDD\uFF1A\u65B0\u5EFA\u4EFB\u52A1\u65F6\u8BF7\u6307\u5B9A\u843D\u5730\u5DE5\u4F5C\u533A",
  newWorkspaceAction: "\u65B0\u5EFA\u5DE5\u4F5C\u533A\u2026",
  newWorkspacePick: "\u9009\u62E9\u76EE\u5F55\u2026",
  newWorkspacePicking: "\u9009\u62E9\u4E2D\u2026",
  newWorkspaceHide: "\u6536\u8D77\u65B0\u5EFA\u5DE5\u4F5C\u533A",
  newWorkspacePathLabel: "\u670D\u52A1\u5668\u4E0A\u7684\u76EE\u5F55\u8DEF\u5F84\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF09",
  newWorkspaceRegister: "\u6CE8\u518C\u5E76\u9009\u62E9",
  newWorkspaceRegistering: "\u6CE8\u518C\u4E2D\u2026",
  unavailable: "\u5B9A\u65F6\u4EFB\u52A1\u5BBF\u4E3B\u4E0D\u53EF\u7528",
  loading: "\u52A0\u8F7D\u4E2D\u2026",
  emptyTitle: "\u8FD8\u6CA1\u6709\u5B9A\u65F6\u4EFB\u52A1",
  emptyHint: "\u70B9\u51FB\u300C\u65B0\u5EFA\u4EFB\u52A1\u300D\u521B\u5EFA\u89C4\u5219\uFF0C\u6216\u8BA9 Agent \u7528 automation_create \u521B\u5EFA\u3002",
  createTitle: "\u65B0\u5EFA\u5B9A\u65F6\u4EFB\u52A1",
  editTitle: "\u7F16\u8F91\u5B9A\u65F6\u4EFB\u52A1",
  nameLabel: "\u540D\u79F0",
  namePlaceholder: "\u4F8B\u5982\uFF1A\u6BCF\u4E2A\u5DE5\u4F5C\u65E5\u7684\u56DE\u5F52\u7528\u4F8B\u5206\u8BCA",
  promptLabel: "\u4EFB\u52A1\u63D0\u793A\u8BCD\uFF08\u81EA\u5305\u542B\uFF1A\u76EE\u6807 / \u8BC1\u636E / \u5141\u8BB8\u6539\u52A8 / \u9A8C\u6536 / \u505C\u6B62\u6761\u4EF6\uFF09",
  promptPlaceholder: "\u63CF\u8FF0\u8FD9\u4E2A\u4EFB\u52A1\u6BCF\u6B21\u8FD0\u884C\u8981\u5B8C\u6210\u4EC0\u4E48\u3002\u5B9A\u65F6\u4EFB\u52A1\u4E0D\u7EE7\u627F\u5F53\u524D\u5BF9\u8BDD\u3002",
  scheduleLabel: "\u65F6\u95F4\u8BA1\u5212",
  scheduleOnce: "\u4E00\u6B21\u6027",
  scheduleInterval: "\u56FA\u5B9A\u95F4\u9694",
  scheduleDaily: "\u6BCF\u5929",
  scheduleWeekly: "\u6BCF\u5468",
  onceAt: "\u6267\u884C\u65F6\u523B",
  everyMinutes: "\u95F4\u9694\uFF08\u5206\u949F\uFF0C\u22655\uFF09",
  dailyTime: "\u6BCF\u5929\u65F6\u95F4\uFF08HH:mm\uFF09",
  weeklyTime: "\u6BCF\u5468\u65F6\u95F4\uFF08HH:mm\uFF09",
  weekdays: "\u661F\u671F",
  weekdayMo: "\u4E00",
  weekdayTu: "\u4E8C",
  weekdayWe: "\u4E09",
  weekdayTh: "\u56DB",
  weekdayFr: "\u4E94",
  weekdaySa: "\u516D",
  weekdaySu: "\u65E5",
  timeZoneLabel: "\u65F6\u533A\uFF08IANA\uFF09",
  permissionLabel: "\u6743\u9650\u8FB9\u754C",
  permissionReadOnly: "\u53EA\u8BFB",
  permissionReadOnlyHint: "\u53EA\u8BFB\uFF1A\u9002\u5408\u5DE1\u68C0\u3001\u62A5\u544A\u3001\u9A8C\u8BC1",
  permissionWorkspaceWrite: "\u5DE5\u4F5C\u533A\u53EF\u5199",
  permissionWorkspaceWriteHint: "\u53EF\u5199\uFF1A\u9002\u5408\u53D7\u63A7\u7684\u91CD\u5EFA\u3001\u4FEE\u590D",
  modelLabel: "\u6A21\u578B\u76EE\u6807",
  modelFollow: "\u8DDF\u968F\u5168\u5C40\u9009\u62E9",
  modelPin: "\u9489\u4F4F\u6A21\u578B",
  providerLabel: "Provider",
  modelIdLabel: "Model",
  effortLabel: "\u63A8\u7406\u529B\u5EA6",
  effortDefault: "\u8BE5\u6A21\u578B\u9ED8\u8BA4",
  presetLabel: "Agent \u9884\u8BBE",
  save: "\u4FDD\u5B58",
  cancel: "\u53D6\u6D88",
  delete: "\u5220\u9664",
  deleteConfirm: "\u5220\u9664\u8BE5\u4EFB\u52A1\uFF1F\u8FD0\u884C\u5386\u53F2\u4FDD\u7559\uFF0C\u4F46\u8C03\u5EA6\u4E0D\u53EF\u6062\u590D\u3002",
  runNow: "\u7ACB\u5373\u8FD0\u884C",
  pause: "\u6682\u505C",
  resume: "\u6062\u590D",
  active: "\u8FD0\u884C\u4E2D",
  paused: "\u5DF2\u6682\u505C",
  nextRun: "\u4E0B\u6B21",
  lastRun: "\u4E0A\u6B21",
  runsTitle: "\u8FD0\u884C\u5386\u53F2",
  runsEmpty: "\u8FD8\u6CA1\u6709\u8FD0\u884C\u8BB0\u5F55\u3002",
  openSession: "\u6253\u5F00\u4F1A\u8BDD",
  backToList: "\u8FD4\u56DE",
  listTitle: "\u4EFB\u52A1\u5217\u8868",
  noActive: "\u65E0\u6D3B\u52A8\u8FD0\u884C",
  triggerSchedule: "\u5B9A\u65F6",
  triggerManual: "\u624B\u52A8",
  statusQueued: "\u6392\u961F\u4E2D",
  statusRunning: "\u8FD0\u884C\u4E2D",
  statusSucceeded: "\u6210\u529F",
  statusFailed: "\u5931\u8D25",
  statusSkipped: "\u5DF2\u8DF3\u8FC7",
  statusCancelled: "\u5DF2\u53D6\u6D88",
  skipOverlap: "\u524D\u4E00\u6267\u884C\u672A\u7ED3\u675F",
  skipMisfire: "\u8D85\u8FC7\u8865\u8DD1\u5BBD\u9650",
  duration: "\u8017\u65F6",
  revision: "\u7248\u672C",
  modelGlobal: "\u8DDF\u968F\u5168\u5C40",
  updateFailed: "\u64CD\u4F5C\u5931\u8D25",
  createFailed: "\u521B\u5EFA\u5931\u8D25",
  runQueued: "\u5DF2\u52A0\u5165\u961F\u5217",
  revisionConflict: "\u4EFB\u52A1\u5DF2\u88AB\u5176\u4ED6\u4FEE\u6539\u66F4\u65B0\uFF0C\u5DF2\u5237\u65B0\uFF0C\u8BF7\u91CD\u8BD5",
  createdHint: "\u5DF2\u521B\u5EFA\u3002\u5EFA\u8BAE\u5148\u300C\u7ACB\u5373\u8FD0\u884C\u300D\u9A8C\u8BC1\u4E00\u6B21\u3002",
  charCount: "{count} \u5B57"
};
var en = {
  nav: "Automations",
  title: "Automations",
  subtitle: "Dispatch reusable coding tasks to fresh Agent sessions on a schedule, with durable run history",
  refresh: "Refresh",
  newTask: "New automation",
  editTask: "Edit automation",
  workspace: "Workspace",
  allWorkspaces: "All workspaces",
  workspaceLabel: "Bound workspace",
  workspaceRequired: "Pick a workspace",
  scopeHint: "Rules and history are scoped to one workspace",
  policyHint: "Run timeout {timeout} min \xB7 catch-up grace {grace} min",
  runDelete: "Delete record",
  deleteRunConfirm: "Delete this run record?",
  clearRunsLabel: "Clear history",
  clearRunsConfirm: "Clear all run history of this automation?",
  runsCleared: "Cleared {count} run records",
  standaloneHint: "No session attached: pick a target workspace when creating a task",
  newWorkspaceAction: "New workspace\u2026",
  newWorkspacePick: "Choose directory\u2026",
  newWorkspacePicking: "Choosing\u2026",
  newWorkspaceHide: "Hide new workspace",
  newWorkspacePathLabel: "Directory path on this machine (absolute)",
  newWorkspaceRegister: "Register and select",
  newWorkspaceRegistering: "Registering\u2026",
  unavailable: "Automation host is unavailable",
  loading: "Loading\u2026",
  emptyTitle: "No automations yet",
  emptyHint: 'Create one with "New automation", or ask an Agent to use automation_create.',
  createTitle: "New automation",
  editTitle: "Edit automation",
  nameLabel: "Name",
  namePlaceholder: "e.g. Weekday regression triage",
  promptLabel: "Task prompt (self-contained: goal / evidence / allowed changes / acceptance / stop condition)",
  promptPlaceholder: "Describe what this run should accomplish on its own. Runs do not inherit this conversation.",
  scheduleLabel: "Schedule",
  scheduleOnce: "Once",
  scheduleInterval: "Interval",
  scheduleDaily: "Daily",
  scheduleWeekly: "Weekly",
  onceAt: "Run at",
  everyMinutes: "Every (minutes, \u22655)",
  dailyTime: "Daily time (HH:mm)",
  weeklyTime: "Weekly time (HH:mm)",
  weekdays: "Weekdays",
  weekdayMo: "Mo",
  weekdayTu: "Tu",
  weekdayWe: "We",
  weekdayTh: "Th",
  weekdayFr: "Fr",
  weekdaySa: "Sa",
  weekdaySu: "Su",
  timeZoneLabel: "Time zone (IANA)",
  permissionLabel: "Permission boundary",
  permissionReadOnly: "Read-only",
  permissionReadOnlyHint: "Read-only: inspections, reports, verification",
  permissionWorkspaceWrite: "Workspace-write",
  permissionWorkspaceWriteHint: "Writable: controlled rebuilds and fixes",
  modelLabel: "Model target",
  modelFollow: "Follow global selection",
  modelPin: "Pin a model",
  providerLabel: "Provider",
  modelIdLabel: "Model",
  effortLabel: "Reasoning effort",
  effortDefault: "Model default",
  presetLabel: "Agent preset",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  deleteConfirm: "Delete this automation? Run history is retained, but the schedule cannot be restored.",
  runNow: "Run now",
  pause: "Pause",
  resume: "Resume",
  active: "Active",
  paused: "Paused",
  nextRun: "Next",
  lastRun: "Last",
  runsTitle: "Run history",
  runsEmpty: "No runs yet.",
  openSession: "Open session",
  backToList: "Back",
  listTitle: "Automations",
  noActive: "No active run",
  triggerSchedule: "Schedule",
  triggerManual: "Manual",
  statusQueued: "Queued",
  statusRunning: "Running",
  statusSucceeded: "Succeeded",
  statusFailed: "Failed",
  statusSkipped: "Skipped",
  statusCancelled: "Cancelled",
  skipOverlap: "previous run still active",
  skipMisfire: "beyond catch-up grace",
  duration: "Duration",
  revision: "Rev",
  modelGlobal: "Follows global",
  updateFailed: "Operation failed",
  createFailed: "Create failed",
  runQueued: "Queued",
  revisionConflict: "The definition changed elsewhere; refreshed, please retry",
  createdHint: 'Created. Use "Run now" to verify before relying on the schedule.',
  charCount: "{count} chars"
};
var dictionaries = { zh, en };

// src/client/protocol.ts
function unwrapRpcResult(value) {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    throw new Error("\u5B9A\u65F6\u4EFB\u52A1\u5BBF\u4E3B\u8FD4\u56DE\u4E86\u65E0\u6548\u54CD\u5E94 (the automation host returned an invalid response)");
  }
  const result = value;
  if (result.ok === true) return result.value;
  if (result.ok === false && typeof result.error === "object" && result.error !== null) {
    const message = typeof result.error.message === "string" ? result.error.message : "";
    throw new Error(message === "" ? "\u5B9A\u65F6\u4EFB\u52A1\u8BF7\u6C42\u5931\u8D25 (the automation request failed)" : message);
  }
  throw new Error("\u5B9A\u65F6\u4EFB\u52A1\u5BBF\u4E3B\u8FD4\u56DE\u4E86\u65E0\u6548\u54CD\u5E94 (the automation host returned an invalid response)");
}

// src/client/runtime.ts
var RPC_CHANNEL = "/dsh-kylin-automation";
function createAutomationsRuntime(deps) {
  let state = { phase: "idle" };
  let refreshPromise;
  const listeners = /* @__PURE__ */ new Set();
  const publish = (next) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };
  const source = {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
  const refresh = async () => {
    if (refreshPromise !== void 0) return refreshPromise;
    const previous = state.snapshot;
    publish(previous === void 0 ? { phase: "loading" } : { phase: "loading", snapshot: previous, ...state.refreshedAt === void 0 ? {} : { refreshedAt: state.refreshedAt } });
    refreshPromise = (async () => {
      try {
        const sessionId = deps.sessionId();
        const response = await deps.rpc.call(RPC_CHANNEL, "snapshot", {
          ...sessionId === void 0 ? {} : { sessionId },
          lang: deps.lang()
        });
        const snapshot = unwrapRpcResult(response);
        publish({
          phase: "ready",
          snapshot,
          refreshedAt: Date.now()
        });
      } catch (error) {
        publish({
          phase: "error",
          ...previous === void 0 ? {} : { snapshot: previous },
          error: error instanceof Error ? error.message : String(error),
          ...state.refreshedAt === void 0 ? {} : { refreshedAt: state.refreshedAt }
        });
      } finally {
        refreshPromise = void 0;
      }
    })();
    return refreshPromise;
  };
  const mutateThenRefresh = async (endpoint, payload) => {
    await deps.rpc.call(RPC_CHANNEL, endpoint, payload);
    const pending = refreshPromise;
    if (pending !== void 0) await pending.catch(() => void 0);
    await refresh();
  };
  return {
    source,
    refresh,
    currentSessionId: deps.sessionId,
    async registerWorkspace(path) {
      const value = unwrapRpcResult(
        await deps.rpc.call(RPC_CHANNEL, "register-workspace", { path })
      );
      await refresh();
      return value;
    },
    async create(input) {
      const sessionId = deps.sessionId();
      const { workspaceId, ...rest } = input;
      const value = unwrapRpcResult(
        await deps.rpc.call(RPC_CHANNEL, "create", {
          sessionId,
          ...workspaceId !== void 0 && workspaceId !== "" ? { workspaceId } : {},
          input: rest
        })
      );
      await refresh();
      return value.id;
    },
    async update(automationId, expectedRevision, input) {
      const sessionId = deps.sessionId();
      await mutateThenRefresh("update", { sessionId, automationId, expectedRevision, input });
    },
    async mutate(automationId, mutation) {
      const sessionId = deps.sessionId();
      await mutateThenRefresh("mutate", { sessionId, automationId, mutation });
    },
    async runNow(automationId) {
      const sessionId = deps.sessionId();
      const value = unwrapRpcResult(
        await deps.rpc.call(RPC_CHANNEL, "run-now", { sessionId, automationId })
      );
      await refresh();
      return value.runId;
    },
    async deleteRun(automationId, runId) {
      await mutateThenRefresh("delete-run", { automationId, runId });
    },
    async clearRuns(automationId) {
      const sessionId = deps.sessionId();
      const value = unwrapRpcResult(
        await deps.rpc.call(RPC_CHANNEL, "clear-runs", { sessionId, automationId })
      );
      await refresh();
      return value.cleared;
    }
  };
}

// src/client/styles.ts
var STYLE_ID = "kyl-automation-styles";
var CSS = `
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
`;
function installStyles() {
  if (document.getElementById(STYLE_ID) === null) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
  }
  return () => {
    document.getElementById(STYLE_ID)?.remove();
  };
}

// src/client/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var name = "dsh-kylin-automation";
var inject = [
  "slots",
  "locale",
  "sessions",
  "layout",
  "connection",
  "remote",
  /** Remote namespaces are fail-closed services: the session namespace must be
   * injected by name before `ctx.remote.session` is readable. */
  "remote.session"
];
var PANEL_ID = "kyl-automations";
function browserLang() {
  try {
    const languages = navigator.languages ?? [navigator.language];
    return (languages[0] ?? "zh").toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return "zh";
  }
}
function normalizeCatalog(value) {
  if (typeof value !== "object" || value === null) return { groups: [], failures: [] };
  const root = value;
  const groups = [];
  if (!Array.isArray(root.groups)) return { groups, failures: [] };
  for (const rawGroup of root.groups) {
    if (typeof rawGroup !== "object" || rawGroup === null) continue;
    const group = rawGroup;
    const groupId = typeof group["id"] === "string" ? group["id"] : void 0;
    const groupName = typeof group["name"] === "string" ? group["name"] : groupId;
    const models = Array.isArray(group["models"]) ? group["models"] : void 0;
    if (groupId === void 0 || groupName === void 0 || models === void 0) continue;
    groups.push({
      id: groupId,
      name: groupName,
      models: models.flatMap((model) => {
        if (typeof model !== "object" || model === null) return [];
        const item = model;
        const modelId = typeof item["id"] === "string" ? item["id"] : void 0;
        const modelName = typeof item["name"] === "string" ? item["name"] : modelId;
        if (modelId === void 0 || modelName === void 0) return [];
        const reasoningRaw = item["reasoning"];
        const reasoning = typeof reasoningRaw === "object" && reasoningRaw !== null ? reasoningRaw : void 0;
        return [{
          id: modelId,
          name: modelName,
          reasoning: reasoning !== void 0 && Array.isArray(reasoning.efforts) ? {
            efforts: reasoning.efforts.flatMap((effort) => {
              if (typeof effort !== "object" || effort === null) return [];
              const record = effort;
              return typeof record["id"] === "string" ? [{
                id: record["id"],
                name: typeof record["name"] === "string" ? record["name"] : record["id"]
              }] : [];
            }),
            ...typeof reasoning.defaultEffort === "string" ? { defaultEffort: reasoning.defaultEffort } : {}
          } : void 0
        }];
      })
    });
  }
  return { groups, failures: [] };
}
function apply(ctx) {
  const disposeStyles = installStyles();
  const localeService = ctx.locale;
  if (localeService?.register !== void 0) {
    ctx.effect(() => localeService.register(NS, { zh: { ...zh }, en: { ...dictionaries.en } }), "kyl-automation: dictionaries");
  }
  const t = localeService?.bind !== void 0 ? localeService.bind(NS) : ((key, params) => {
    const template = zh[key] ?? key;
    if (params === void 0) return template;
    return template.replace(/\{(\w+)\}/g, (_match, name2) => String(params[name2] ?? `{${name2}}`));
  });
  let runtimeRef;
  const runtime = createAutomationsRuntime({
    rpc: {
      call: (channel, endpoint, payload) => {
        if (ctx.connection?.rpc === void 0) {
          return Promise.reject(new Error("\u5B9A\u65F6\u4EFB\u52A1\u901A\u9053\u4E0D\u53EF\u7528 (the automation channel is unavailable)"));
        }
        return ctx.connection.rpc.call(channel, endpoint, payload);
      }
    },
    sessionId: () => {
      try {
        return ctx.sessions?.list.getSnapshot().current;
      } catch {
        return void 0;
      }
    },
    lang: browserLang
  });
  runtimeRef = runtime;
  const lang = browserLang();
  const backToConversation = () => {
    try {
      ctx.layout?.selectPanel(null);
    } catch {
    }
  };
  const openSession = (sessionId) => {
    void (async () => {
      try {
        await ctx.sessions?.refresh();
      } catch {
      }
      try {
        ctx.sessions?.open(sessionId);
      } catch (error) {
        console.warn("[dsh-kylin-automation] open result session failed:", error);
        return;
      }
      backToConversation();
    })();
  };
  const pickDirectory = async () => {
    const global = globalThis;
    try {
      if (typeof global.__QILIN_DIRECTORY_PICKER__?.pick === "function") {
        return await global.__QILIN_DIRECTORY_PICKER__.pick();
      }
    } catch {
    }
    return null;
  };
  const loadModelCatalog = async () => {
    const remoteSession = ctx.remote?.session;
    if (remoteSession?.modelCatalog === void 0) {
      throw new Error("\u6A21\u578B\u76EE\u5F55\u4E0D\u53EF\u7528 (the model catalog is unavailable)");
    }
    const response = await remoteSession.modelCatalog();
    if (response?.ok !== true) {
      const message = typeof response?.error?.message === "string" ? response.error.message : String(response?.error?.code ?? "unknown");
      throw new Error(`\u6A21\u578B\u76EE\u5F55\u52A0\u8F7D\u5931\u8D25 (the model catalog failed to load): ${message}`);
    }
    return normalizeCatalog(response.value);
  };
  if (ctx.slots?.inject !== void 0) {
    try {
      ctx.slots.inject("sidebar.panellist", () => {
        const disposeIcon = ctx.slots.register({
          name: "sidebar.panellist",
          id: PANEL_ID,
          order: 120,
          label: () => t("nav"),
          locale: NS
        }, PanelIcon);
        const disposePanel = ctx.slots.register({
          name: "main",
          key: PANEL_ID,
          locale: NS
        }, function AutomationsMount() {
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            AutomationsView,
            {
              t,
              runtime: runtimeRef,
              lang,
              openSession,
              backToConversation,
              loadModelCatalog,
              pickDirectory
            }
          );
        });
        return () => {
          disposePanel();
          disposeIcon();
        };
      });
    } catch (error) {
      console.warn("[dsh-kylin-automation] sidebar/main slot registration skipped:", error);
    }
  }
  ctx.effect(() => disposeStyles, "kyl-automation: styles");
}
function PanelIcon(props) {
  const size = props.size ?? 18;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.9,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "12.5", r: "8" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M12 8.5v4.2l2.9 1.7" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5 3.5 3.4 5.1" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M19 3.5l1.6 1.6" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M12 2.5h.01" })
      ]
    }
  );
}
return module.exports; } });
//# sourceMappingURL=client.js.map
