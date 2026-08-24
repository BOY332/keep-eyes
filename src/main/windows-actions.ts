import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface WindowsActions {
  turnOffDisplay(): Promise<void>;
  lockWorkstation(): Promise<void>;
}

export class WindowsActionsAdapter implements WindowsActions {
  async turnOffDisplay(): Promise<void> {
    if (process.platform !== "win32") throw new Error("关闭显示器仅支持 Windows。");
    const script = 'Add-Type -Name Native -Namespace KeepEyes -MemberDefinition \'[DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd,uint Msg,IntPtr wParam,IntPtr lParam);\'; [KeepEyes.Native]::SendMessage([IntPtr]0xffff,0x0112,[IntPtr]0xF170,[IntPtr]2)';
    await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true });
  }
  async lockWorkstation(): Promise<void> {
    if (process.platform !== "win32") throw new Error("锁定 Windows 仅支持 Windows。");
    await execFileAsync("rundll32.exe", ["user32.dll,LockWorkStation"], { windowsHide: true });
  }
}
