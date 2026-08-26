import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface WindowsActions { lockWorkstation(): Promise<void>; }

export class WindowsActionsAdapter implements WindowsActions {
  async lockWorkstation(): Promise<void> {
    if (process.platform !== "win32") throw new Error("锁定 Windows 仅支持 Windows。");
    await execFileAsync("rundll32.exe", ["user32.dll,LockWorkStation"], { windowsHide: true });
  }
}
