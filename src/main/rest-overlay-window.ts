import { BrowserWindow, screen, type BrowserWindowConstructorOptions } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AppState } from "../shared/reminder-machine";
import { clearPinRetries, schedulePinWindowToBounds } from "./display-bounds";

function overlayOptions(area: Electron.Rectangle, webPreferences: BrowserWindowConstructorOptions["webPreferences"]): BrowserWindowConstructorOptions {
  return {
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    enableLargerThanScreen: true,
    hasShadow: false,
    backgroundColor: "#000000",
    title: "休息遮罩",
    webPreferences
  };
}

/** Full-screen black rest cover for every connected display. */
export class RestOverlayWindowController {
  private windows = new Map<number, BrowserWindow>();
  private loadPromises = new Map<BrowserWindow, Promise<void>>();
  private requestId = 0;

  constructor(private readonly developmentUrl: string | undefined) {}

  async show(state: AppState): Promise<void> {
    const request = ++this.requestId;
    this.syncDisplays();
    const displays = new Map(screen.getAllDisplays().map((display) => [display.id, display]));

    await Promise.all([...this.windows.entries()].map(async ([id, win]) => {
      const display = displays.get(id);
      if (!display) return;
      schedulePinWindowToBounds(win, display.bounds);
      await this.ensurePageLoaded(win);
      if (request !== this.requestId || win.isDestroyed()) return;
      win.webContents.send("reminder:state-changed", state);
      win.setAlwaysOnTop(true, "screen-saver");
      schedulePinWindowToBounds(win, display.bounds);
      win.showInactive();
      schedulePinWindowToBounds(win, display.bounds);
    }));
  }

  hide(): void {
    this.requestId += 1;
    for (const win of this.windows.values()) {
      if (win.isDestroyed()) continue;
      clearPinRetries(win);
      win.hide();
    }
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

  private async ensurePageLoaded(win: BrowserWindow): Promise<void> {
    let promise = this.loadPromises.get(win);
    if (!promise) {
      promise = win.loadURL(this.pageUrl("rest-overlay"));
      this.loadPromises.set(win, promise);
    }
    try {
      await promise;
    } catch (error) {
      this.loadPromises.delete(win);
      throw error;
    }
  }

  private syncDisplays(): void {
    const displays = screen.getAllDisplays();
    const ids = new Set(displays.map((display) => display.id));
    for (const [id, win] of this.windows) {
      if (ids.has(id)) continue;
      if (!win.isDestroyed()) {
        clearPinRetries(win);
        win.close();
      }
      this.windows.delete(id);
      this.loadPromises.delete(win);
    }
    for (const display of displays) {
      const area = display.bounds;
      let win = this.windows.get(display.id);
      if (!win || win.isDestroyed()) {
        win = new BrowserWindow(overlayOptions(area, this.webPreferences()));
        win.setAlwaysOnTop(true, "screen-saver");
        const captured = win;
        win.on("closed", () => {
          this.windows.delete(display.id);
          this.loadPromises.delete(captured);
          clearPinRetries(captured);
        });
        this.windows.set(display.id, win);
      } else {
        schedulePinWindowToBounds(win, area);
      }
    }
  }
}
