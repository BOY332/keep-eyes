import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SensitiveContextDetector } from "./alert-controller";

const execFileAsync = promisify(execFile);

/**
 * 保守检测已知高风险场景。无法可靠识别所有演示/会议/全屏情况，因此保留用户开关和手动降级入口。
 */
export class WindowsSensitiveContextDetector implements SensitiveContextDetector {
  async isSensitiveContext(): Promise<boolean> {
    if (process.platform !== "win32") return false;
    if (process.env.SESSIONNAME?.toUpperCase().startsWith("RDP-")) return true;
    try {
      const script = [
        'Add-Type @"',
        'using System; using System.Runtime.InteropServices;',
        'public static class KeepEyesNative {',
        '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
        '[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);',
        '[StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
        '}',
        '"@;',
        '$window=[KeepEyesNative]::GetForegroundWindow(); $rect=New-Object KeepEyesNative+RECT;',
        'if ($window -eq [IntPtr]::Zero -or -not [KeepEyesNative]::GetWindowRect($window,[ref]$rect)) { exit 1 };',
        '$screen=[System.Windows.Forms.Screen]::FromHandle($window).Bounds;',
        'if ($rect.Left -le $screen.Left -and $rect.Top -le $screen.Top -and $rect.Right -ge $screen.Right -and $rect.Bottom -ge $screen.Bottom) { exit 0 } else { exit 1 }'
      ].join(" ");
      await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Add-Type -AssemblyName System.Windows.Forms; ${script}`], { windowsHide: true });
      return true;
    } catch { return false; }
  }
}
