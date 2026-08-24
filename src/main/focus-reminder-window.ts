import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Controls one compact, transparent reminder panel without covering the desktop. */
export class FocusReminderWindowController {
  private panelWindow: BrowserWindow | null = null;

  constructor(private readonly developmentUrl: string | undefined) {}

  async show(): Promise<void> {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const panel = this.getOrCreatePanel(area);
    await panel.loadURL(this.pageUrl("focus-controls"));
    // Keep the user's current application focused.
    panel.showInactive();
  }

  hide(): void {
    if (this.panelWindow && !this.panelWindow.isDestroyed()) this.panelWindow.hide();
  }

  isVisible(): boolean {
    return Boolean(this.panelWindow && !this.panelWindow.isDestroyed() && this.panelWindow.isVisible());
  }

  private pageUrl(hash: string): string {
    const base = this.developmentUrl ?? pathToFileURL(path.join(__dirname, "../../dist/index.html")).toString();
    return `${base}#${hash}`;
  }

  private options() {
    return {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    };
  }

  private getOrCreatePanel(area: Electron.Rectangle): BrowserWindow {
    const width = 520;
    const height = 230;
    const x = Math.round(area.x + (area.width - width) / 2);
    const y = Math.round(area.y + 32);

    if (this.panelWindow && !this.panelWindow.isDestroyed()) {
      this.panelWindow.setBounds({ x, y, width, height });
      return this.panelWindow;
    }

    const window = new BrowserWindow({
      width,
      height,
      x,
      y,
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: true,
      title: "?????? - keep-eyes",
      webPreferences: this.options()
    });
    window.setAlwaysOnTop(true, "floating");
    window.on("closed", () => { this.panelWindow = null; });
    this.panelWindow = window;
    return window;
  }
}
