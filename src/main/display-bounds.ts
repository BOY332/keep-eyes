import { BrowserWindow, type Rectangle } from "electron";

const pinRetries = new WeakMap<BrowserWindow, ReturnType<typeof setTimeout>[]>();

export function panelBoundsForWorkArea(area: Rectangle, height = 176): Rectangle {
  return { x: area.x, y: area.y, width: area.width, height };
}

export function pinWindowToBounds(window: BrowserWindow, bounds: Rectangle): void {
  if (window.isDestroyed()) return;
  window.setPosition(bounds.x, bounds.y);
  window.setBounds(bounds);
}

export function clearPinRetries(window: BrowserWindow): void {
  const timers = pinRetries.get(window);
  if (!timers) return;
  for (const timer of timers) clearTimeout(timer);
  pinRetries.delete(window);
}

/** Windows mixed-DPI setups often ignore the first setBounds; retry after the window is shown. */
export function schedulePinWindowToBounds(
  window: BrowserWindow,
  bounds: Rectangle,
  delays: number[] = [0, 32, 80, 200, 400]
): void {
  clearPinRetries(window);
  pinWindowToBounds(window, bounds);
  const timers = delays.map((delay) =>
    setTimeout(() => {
      pinWindowToBounds(window, bounds);
    }, delay)
  );
  pinRetries.set(window, timers);
}
