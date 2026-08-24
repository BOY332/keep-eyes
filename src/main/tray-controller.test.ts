import { describe, expect, it, vi } from "vitest";

const actions: Array<{ label?: string; click?: () => void }> = [];
const trayIcons: unknown[] = [];
const trayInstances: Array<{ setToolTip: ReturnType<typeof vi.fn>; setContextMenu: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }> = [];
vi.mock("electron", () => ({
  Menu: { buildFromTemplate: vi.fn((items) => { actions.splice(0, actions.length, ...items); return items; }) },
  Tray: class { public setToolTip = vi.fn(); public setContextMenu = vi.fn(); public on = vi.fn(); public destroy = vi.fn(); constructor(icon: unknown) { trayIcons.push(icon); trayInstances.push(this); } },
  nativeImage: { createFromDataURL: vi.fn(() => ({ isEmpty: () => false })) }
}));
import { TrayController } from "./tray-controller";

describe("TrayController", () => {
  it("菜单动作映射到打开、休息、暂停和退出领域操作", () => {
    const handlers = { open: vi.fn(), startRest: vi.fn(), pause: vi.fn(), quit: vi.fn() };
    const tray = new TrayController(handlers); tray.create();
    expect(trayIcons[0]).toBeTruthy();
    for (const label of ["打开应用", "立即开始休息", "暂停提醒 30 分钟", "退出"]) actions.find((item) => item.label === label)?.click?.();
    expect(handlers.open).toHaveBeenCalledOnce(); expect(handlers.startRest).toHaveBeenCalledOnce(); expect(handlers.pause).toHaveBeenCalledOnce(); expect(handlers.quit).toHaveBeenCalledOnce();
    tray.destroy(); expect(trayInstances[0].destroy).toHaveBeenCalledOnce();
  });
});

