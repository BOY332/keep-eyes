import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AppState } from "../shared/reminder-machine";

export interface RestOverlayWindow {
  show(state: AppState): Promise<void>;
  hide(): void;
}

export class RestOverlayWindowController implements RestOverlayWindow {
  private windows = new Map<number, BrowserWindow>();
  private loadPromises = new Map<BrowserWindow, Promise<void>>();
  private requestId = 0;
  constructor(private readonly developmentUrl: string | undefined) {}

  async show(state: AppState): Promise<void> {
    const request = ++this.requestId;
    this.syncDisplays();
    const entries = [...this.windows.entries()];
    await Promise.all(entries.map(async ([, win]) => {
      if (!this.loadPromises.has(win)) this.loadPromises.set(win, win.loadURL(this.pageUrl("rest-overlay")));
      await this.loadPromises.get(win);
      if (request !== this.requestId || win.isDestroyed()) return;
      win.webContents.send("reminder:state-changed", state);
      win.showInactive();
    }));
  }

  hide(): void {
    this.requestId += 1;
    for (const win of this.windows.values()) if (!win.isDestroyed()) win.hide();
  }

  private pageUrl(hash: string): string {
    const base = this.developmentUrl ?? pathToFileURL(path.join(__dirname, "../../dist/index.html")).toString();
    return `${base}#${hash}`;
  }
  private syncDisplays(): void {
    const displays = screen.getAllDisplays();
    const ids = new Set(displays.map((display) => display.id));
    for (const [id, win] of this.windows) {
      if (!ids.has(id)) { if (!win.isDestroyed()) win.close(); this.windows.delete(id); }
    }
    for (const display of displays) {
      const area = display.bounds;
      let win = this.windows.get(display.id);
      if (!win || win.isDestroyed()) {
        win = new BrowserWindow({ x: area.x, y: area.y, width: area.width, height: area.height, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, focusable: false, skipTaskbar: true, alwaysOnTop: true, backgroundColor: "#000000", title: "休息遮罩", webPreferences: { preload: path.join(__dirname, "../preload/index.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
        win.setAlwaysOnTop(true, "screen-saver");
        win.on("closed", () => { this.windows.delete(display.id); this.loadPromises.delete(win!); });
        this.windows.set(display.id, win);
      } else win.setBounds(area);
    }
  }
}
