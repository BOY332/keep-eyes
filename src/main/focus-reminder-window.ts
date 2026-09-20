import { BrowserWindow, screen, type BrowserWindowConstructorOptions } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AppState } from "../shared/reminder-machine";
import { clearPinRetries, panelBoundsForWorkArea, schedulePinWindowToBounds } from "./display-bounds";

function panelOptions(area: Electron.Rectangle, webPreferences: BrowserWindowConstructorOptions["webPreferences"]): BrowserWindowConstructorOptions {
  const bounds = panelBoundsForWorkArea(area);
  return {
    ...bounds,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    enableLargerThanScreen: true,
    hasShadow: true,
    title: "护眼提醒 - keep-eyes",
    webPreferences
  };
}

/** Compact reminder strip on every connected display, without covering the desktop. */
export class FocusReminderWindowController {
  private panels = new Map<number, BrowserWindow>();
  private loading = new Map<BrowserWindow, Promise<void>>();
  private displayRequestId = 0;

  constructor(private readonly developmentUrl: string | undefined) {}

  async show(state: AppState): Promise<void> {
    const requestId = ++this.displayRequestId;
    this.syncDisplays();
    const displays = new Map(screen.getAllDisplays().map((display) => [display.id, display]));

    await Promise.all([...this.panels.entries()].map(async ([id, panel]) => {
      const display = displays.get(id);
      if (!display) return;
      const bounds = panelBoundsForWorkArea(display.workArea);
      schedulePinWindowToBounds(panel, bounds);
      await this.ensurePageLoaded(panel);
      if (requestId !== this.displayRequestId || panel.isDestroyed()) return;
      panel.webContents.send("reminder:state-changed", state);
      this.setPanelPassthrough(panel, true);
      panel.setAlwaysOnTop(true, "floating");
      schedulePinWindowToBounds(panel, bounds);
      panel.showInactive();
      schedulePinWindowToBounds(panel, bounds);
    }));
  }

  hide(): void {
    this.displayRequestId += 1;
    for (const panel of this.panels.values()) {
      if (panel.isDestroyed()) continue;
      clearPinRetries(panel);
      panel.hide();
    }
  }

  isVisible(): boolean {
    return [...this.panels.values()].some((panel) => !panel.isDestroyed() && panel.isVisible());
  }

  setMousePassthrough(enabled: boolean): void {
    for (const panel of this.panels.values()) this.setPanelPassthrough(panel, enabled);
  }

  private setPanelPassthrough(panel: BrowserWindow, enabled: boolean): void {
    if (panel.isDestroyed()) return;
    if (enabled) panel.setIgnoreMouseEvents(true, { forward: true });
    else panel.setIgnoreMouseEvents(false);
  }

  private pageUrl(hash: string): string {
    const base = this.developmentUrl ?? pathToFileURL(path.join(__dirname, "../../dist/index.html")).toString();
    return `${base}#${hash}`;
  }

  private webPreferences() {
    return {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    };
  }

  private async ensurePageLoaded(panel: BrowserWindow): Promise<void> {
    let promise = this.loading.get(panel);
    if (!promise) {
      promise = panel.loadURL(this.pageUrl("focus-controls"));
      this.loading.set(panel, promise);
    }
    try {
      await promise;
    } catch (error) {
      this.loading.delete(panel);
      throw error;
    }
  }

  private syncDisplays(): void {
    const displays = screen.getAllDisplays();
    const ids = new Set(displays.map((display) => display.id));
    for (const [id, panel] of this.panels) {
      if (ids.has(id)) continue;
      if (!panel.isDestroyed()) {
        clearPinRetries(panel);
        panel.close();
      }
      this.panels.delete(id);
      this.loading.delete(panel);
    }
    for (const display of displays) {
      const area = display.workArea;
      let panel = this.panels.get(display.id);
      if (!panel || panel.isDestroyed()) {
        panel = new BrowserWindow(panelOptions(area, this.webPreferences()));
        panel.setAlwaysOnTop(true, "floating");
        const captured = panel;
        panel.on("closed", () => {
          this.panels.delete(display.id);
          this.loading.delete(captured);
          clearPinRetries(captured);
          this.displayRequestId += 1;
        });
        this.panels.set(display.id, panel);
      } else {
        schedulePinWindowToBounds(panel, panelBoundsForWorkArea(area));
      }
    }
  }
}
