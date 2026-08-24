import { Menu, Tray, nativeImage } from "electron";
import type { AppState } from "../shared/reminder-machine";

const trayPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA1UlEQVR4nO2XQRLCIAxF8Q8nkbvoEfSIegS9S3sVHRfOaBoMSUnowr8MIe/TAFNSGqwdF9yfbg8P2Hw9LniIgtdqIwpeYyASzrEQDacmkAYLow1k68TpcljEyvnub2BiwHRMYwS94JY8lQFNUU1+thajn5nLecWkdqDFgASvxVoEKYGu7BeIG5NagTRY+BtIDhdRVwOlcWPV4NLpyMkoy2rNLSjGM94yDz2LWfLhUVRjNmsMfBYf9j+wdl9s8yKamReLt95M0EAk/MtAlAnKgJTgCd+EnsmpW305WRpBAAAAAElFTkSuQmCC";
const trayIcon = nativeImage.createFromDataURL(trayPngDataUrl);
if (trayIcon.isEmpty()) {
  throw new Error("Unable to create the keep-eyes tray icon.");
}

export class TrayController {
  private tray: Tray | null = null;
  constructor(private readonly handlers: { open(): void; startRest(): void; pause(): void; quit(): void }) {}
  create(): void {
    this.tray = new Tray(trayIcon);
    this.tray.setToolTip("keep-eyes 护眼提醒");
    this.refresh();
    this.tray.on("click", () => this.handlers.open());
  }
  refresh(state?: AppState): void {
    if (!this.tray) return;
    const status = state ? `当前：${this.phaseLabel(state.phase)}` : "正在加载状态";
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: `keep-eyes（${status}）`, enabled: false }, { type: "separator" },
      { label: "打开应用", click: () => this.handlers.open() },
      { label: "立即开始休息", click: () => this.handlers.startRest() },
      { label: "暂停提醒 30 分钟", click: () => this.handlers.pause() },
      { type: "separator" }, { label: "退出", click: () => this.handlers.quit() }
    ]));
  }
  destroy(): void { this.tray?.destroy(); this.tray = null; }
  private phaseLabel(phase: AppState["phase"]): string { return ({ "eye-timer": "用眼计时", "awaiting-action": "等待处理", snoozed: "已延后", paused: "已暂停", resting: "正在休息" })[phase]; }
}
