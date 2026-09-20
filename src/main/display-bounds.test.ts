import { describe, expect, it, vi } from "vitest";
import { clearPinRetries, panelBoundsForWorkArea, pinWindowToBounds, schedulePinWindowToBounds } from "./display-bounds";

function fakeWindow(overrides: Partial<{ isDestroyed: () => boolean }> = {}) {
  return {
    isDestroyed: vi.fn(() => false),
    setPosition: vi.fn(),
    setBounds: vi.fn(),
    ...overrides
  };
}

describe("display-bounds", () => {
  it("把提醒条放在工作区顶部", () => {
    expect(panelBoundsForWorkArea({ x: 1920, y: -238, width: 1707, height: 1019 })).toEqual({
      x: 1920,
      y: -238,
      width: 1707,
      height: 176
    });
  });

  it("先移动到目标屏原点再设置完整区域", () => {
    const window = fakeWindow();
    const bounds = { x: 1920, y: -238, width: 1707, height: 1067 };
    pinWindowToBounds(window as never, bounds);
    expect(window.setPosition).toHaveBeenCalledWith(1920, -238);
    expect(window.setBounds).toHaveBeenCalledWith(bounds);
  });

  it("已销毁窗口不再改位置", () => {
    const window = fakeWindow({ isDestroyed: () => true });
    pinWindowToBounds(window as never, { x: 0, y: 0, width: 100, height: 100 });
    expect(window.setPosition).not.toHaveBeenCalled();
  });

  it("会按间隔重复对准，避免缩放不同的屏幕第一次没贴上", () => {
    vi.useFakeTimers();
    const window = fakeWindow();
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    schedulePinWindowToBounds(window as never, bounds, [0, 50]);
    expect(window.setBounds).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(50);
    expect(window.setBounds).toHaveBeenCalledTimes(3);
    clearPinRetries(window as never);
    vi.useRealTimers();
  });
});
