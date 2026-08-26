import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AppState } from "../shared/reminder-machine";

/** Controls one compact, click-through reminder panel on every connected display. */
export class FocusReminderWindowController {
  private panels = new Map<number, BrowserWindow>();
  private loading = new Map<BrowserWindow, Promise<void>>();
  private displayRequestId = 0;

  constructor(private readonly developmentUrl: string | undefined) {}

  async show(state: AppState): Promise<void> {
    const requestId = ++this.displayRequestId;
    this.syncDisplays();
    await Promise.all([...this.panels.values()].map(async (panel) => {
      await this.ensurePageLoaded(panel);
      if (requestId !== this.displayRequestId || panel.isDestroyed()) return;
      panel.webContents.send("reminder:state-changed", state);
      panel.setIgnoreMouseEvents(true, { forward: true });
      panel.showInactive();
    }));
  }

  hide(): void {
    this.displayRequestId += 1;
    for (const panel of this.panels.values()) if (!panel.isDestroyed()) panel.hide();
  }

  refreshDisplays(state?: AppState): void {
    this.syncDisplays();
    if (state?.phase === "awaiting-action") void this.show(state);
  }

  setMousePassthrough(enabled: boolean): void {
    for (const panel of this.panels.values()) {
      if (!panel.isDestroyed()) panel.setIgnoreMouseEvents(enabled, enabled ? { forward: true } : undefined);
    }
  }

  private pageUrl(hash: string): string {
    const base = this.developmentUrl ?? pathToFileURL(path.join(__dirname, "../../dist/index.html")).toString();
    return `${base}#${hash}`;
  }

  private webPreferences() {
    return { preload: path.join(__dirname, "../preload/index.js"), contextIsolation: true, nodeIntegration: false, sandbox: true };
  }

  private syncDisplays(): void {
    const displays = screen.getAllDisplays();
    const ids = new Set(displays.map((display) => display.id));
    for (const [id, panel] of this.panels) {
      if (!ids.has(id)) { if (!panel.isDestroyed()) panel.close(); this.panels.delete(id); }
    }
    for (const display of displays) {
      const area = display.workArea;
      let panel = this.panels.get(display.id);
      if (!panel || panel.isDestroyed()) {
        panel = new BrowserWindow({ width: area.width, height: 176, x: area.x, y: area.y, transparent: true, backgroundColor: "#00000000", frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: true, title: "护眼提醒 - keep-eyes", webPreferences: this.webPreferences() });
        panel.setAlwaysOnTop(true, "floating");
        const captured = panel;
        panel.on("closed", () => { this.panels.delete(display.id); this.loading.delete(captured); this.displayRequestId += 1; });
        this.panels.set(display.id, panel);
      } else panel.setBounds({ x: area.x, y: area.y, width: area.width, height: 176 });
    }
  }

  private async ensurePageLoaded(panel: BrowserWindow): Promise<void> {
    let promise = this.loading.get(panel);
    if (!promise) { promise = panel.loadURL(this.pageUrl("focus-controls")); this.loading.set(panel, promise); }
    try { await promise; } catch (error) { this.loading.delete(panel); throw error; }
  }
}
