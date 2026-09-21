import { Notification } from "electron";
import type { AlertNotifier, SensitiveContextDetector } from "./alert-controller";

export class ElectronNotifier implements AlertNotifier {
  async showNotification(onClick: () => void): Promise<void> {
    if (!Notification.isSupported()) throw new Error("当前系统不支持通知。");
    const notification = new Notification({ title: "该休息一下了", body: "keep-eyes 提醒你开始一次短暂休息。" });
    notification.on("click", onClick); notification.show();
  }

  async showRelaxPrompt(): Promise<void> {
    if (!Notification.isSupported()) return;
    new Notification({
      title: "该放松一下眼睛了",
      body: "向远处看一会儿，眨眨眼。这次只是提醒，不会进入休息。"
    }).show();
  }
}
/** Electron 没有可靠的通用 API 检测演示、全屏和远程控制；默认保守地交由用户保护开关和手动降级。 */
export class ConservativeSensitiveContextDetector implements SensitiveContextDetector { async isSensitiveContext(): Promise<boolean> { return false; } }
