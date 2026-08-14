import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock generalSettingsClient ──
const mockGeneralModule = vi.hoisted(() => ({
  updateGeneralPreferences: vi.fn(),
}));

vi.mock("../src/lib/generalSettingsClient", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/generalSettingsClient")>(
    "../src/lib/generalSettingsClient",
  );
  return {
    ...actual,
    updateGeneralPreferences: mockGeneralModule.updateGeneralPreferences,
    isGeneralSettingsApiError: (e: unknown) =>
      typeof e === "object" && e !== null && "message" in e && "status" in e,
  };
});

import { GeneralSettings } from "../src/components/GeneralSettings";
import { DEFAULT_GENERAL_PREFERENCES, type GeneralPreferences } from "../src/lib/generalSettingsClient";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function prefs(overrides: Partial<GeneralPreferences> = {}): GeneralPreferences {
  return { ...DEFAULT_GENERAL_PREFERENCES, ...overrides };
}

describe("GeneralSettings 通知开关", () => {
  it("渲染「通知」分区与任务完成通知开关（默认开启）", async () => {
    render(<GeneralSettings initialValue={prefs()} onSaved={() => undefined} />);
    expect(await screen.findByText("通知")).toBeInTheDocument();
    expect(screen.getByText("任务完成通知")).toBeInTheDocument();
  });

  it("关闭开关后保存，提交的偏好含 notify_task_done=false", async () => {
    mockGeneralModule.updateGeneralPreferences.mockImplementation(async (next: GeneralPreferences) => next);
    const onSaved = vi.fn();
    render(<GeneralSettings initialValue={prefs({ notify_task_done: true })} onSaved={onSaved} />);

    const toggle = await screen.findByRole("checkbox", { name: /任务完成通知/ });
    fireEvent.click(toggle);

    fireEvent.click(screen.getByRole("button", { name: /保存设置/ }));

    await waitFor(() => {
      expect(mockGeneralModule.updateGeneralPreferences).toHaveBeenCalledTimes(1);
    });
    const submitted = mockGeneralModule.updateGeneralPreferences.mock.calls[0][0] as GeneralPreferences;
    expect(submitted.notify_task_done).toBe(false);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
