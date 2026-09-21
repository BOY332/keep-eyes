import { useEffect, useState } from "react";
import type { AppState, ReminderEvent } from "../shared/reminder-machine";
import { DEFAULT_SETTINGS, type ReminderSettings } from "../shared/settings";

const labels: Record<AppState["phase"], string> = {
  "eye-timer": "正在用眼计时",
  "awaiting-action": "提前提醒中",
  snoozed: "提醒已延后",
  paused: "提醒已暂停",
  resting: "正在休息"
};

export function formatRemaining(ms: number | null): string {
  if (ms === null) return "—";
  const seconds = Math.ceil(ms / 1000);
  return String(Math.floor(seconds / 60)) + " 分 " + String(seconds % 60).padStart(2, "0") + " 秒";
}

function numberValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function deadlineFor(state: AppState): number | null {
  return state.dueAt ?? state.pauseEndsAt ?? state.restEndsAt;
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [draft, setDraft] = useState<ReminderSettings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<"status" | "settings">("status");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void window.keepEyes.getState()
      .then((next) => {
        setNow(Date.now());
        setState(next);
        setDraft(next.settings);
      })
      .catch(() => setError("无法读取应用状态。"));
    return window.keepEyes.onStateChanged((next) => {
      setNow(Date.now());
      setState(next);
      setDraft(next.settings);
    });
  }, []);

  useEffect(() => {
    if (location.hash !== "#focus-controls") return;

    let passthrough: boolean | null = null;
    const setPassthrough = (enabled: boolean) => {
      if (passthrough === enabled) return;
      passthrough = enabled;
      window.keepEyes.setReminderMousePassthrough(enabled);
    };
    const updatePassthrough = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target
        : document.elementFromPoint(event.clientX, event.clientY);
      setPassthrough(!target?.closest(".focus-panel button"));
    };
    const restorePassthrough = () => setPassthrough(true);

    setPassthrough(true);
    window.addEventListener("mousemove", updatePassthrough);
    window.addEventListener("mouseleave", restorePassthrough);
    return () => {
      window.removeEventListener("mousemove", updatePassthrough);
      window.removeEventListener("mouseleave", restorePassthrough);
      window.keepEyes.setReminderMousePassthrough(true);
    };
  }, []);

  useEffect(() => {
    const refreshClock = () => setNow(Date.now());
    const timer = window.setInterval(refreshClock, 1_000);
    window.addEventListener("focus", refreshClock);
    window.addEventListener("pageshow", refreshClock);
    document.addEventListener("visibilitychange", refreshClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshClock);
      window.removeEventListener("pageshow", refreshClock);
      document.removeEventListener("visibilitychange", refreshClock);
    };
  }, []);

  if (!state) return <main><p>正在加载 keep-eyes…</p></main>;
  if (location.hash === "#focus-animation") {
    return <main className="focus-animation" aria-hidden="true"><div className="breathing-orb" /><div className="animation-copy">该休息一下了</div></main>;
  }

  const deadline = deadlineFor(state);
  const remaining = deadline === null ? state.remainingMs : Math.max(0, deadline - now);
  const dispatch = (event: ReminderEvent) => void window.keepEyes.dispatch(event).catch(() => setError("操作失败，请重试。"));
  const timedAction = (type: "BEGIN_REST" | "SNOOZE" | "END_REST" | "RESUME") => dispatch({ type, now: Date.now() });
  const skipRest = () => void window.keepEyes.skipRest().catch(() => setError("跳过本次休息失败，请重试。"));
  const save = async () => {
    try {
      const next = await window.keepEyes.updateSettings(draft);
      setState(next);
      setDraft(next.settings);
      setView("status");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存设置失败。");
    }
  };

  if (location.hash === "#rest-overlay") {
    return <main className="rest-overlay">
      <section>
        <h1>休息中</h1>
        <p>剩余 <strong>{formatRemaining(remaining)}</strong></p>
        <button onClick={() => timedAction("END_REST")}>提前结束休息</button>
      </section>
    </main>;
  }

  if (location.hash === "#focus-controls") {
    return <main className="focus-panel">
      <div className="focus-copy">
        <div className="focus-icon">◌</div>
        <div>
          <h1>该休息一下了</h1>
          <p>距离正式休息还有 <strong>{formatRemaining(remaining)}</strong></p>
        </div>
      </div>
      <div className="actions">
        <button onClick={() => timedAction("BEGIN_REST")}>开始休息</button>
        <button onClick={() => timedAction("SNOOZE")}>延后 {state.settings.snoozeMinutes} 分钟</button>
        <button onClick={() => dispatch({ type: "PAUSE", now: Date.now(), durationMs: 30 * 60_000 })}>暂停 30 分钟</button>
        <button className="secondary" onClick={() => void window.keepEyes.closeEarlyReminder()}>知道了</button>
        <button className="secondary skip-rest" onClick={skipRest}>跳过本次休息</button>
      </div>
    </main>;
  }

  return <main className={state.phase === "awaiting-action" ? "attention" : ""}>
    <header>
      <div><h1>keep-eyes</h1><p className="subtitle">Windows 桌面护眼提醒</p>{error && <p className="error">{error}</p>}</div>
      <nav><button className="link" onClick={() => setView(view === "status" ? "settings" : "status")}>{view === "status" ? "设置" : "返回状态"}</button></nav>
    </header>
    {view === "status" ? <>
      <section className="status-card">
        <p>{labels[state.phase]}</p>
        <strong>{formatRemaining(remaining)}</strong>
        <p>固定流程：提前提醒 → 所有屏幕黑屏遮罩，或锁定 Windows</p>
      </section>
      {state.phase === "awaiting-action" && <div className="actions">
        <button onClick={() => timedAction("BEGIN_REST")}>开始休息</button>
        <button onClick={() => timedAction("SNOOZE")}>延后提醒</button>
        <button onClick={() => dispatch({ type: "PAUSE", now: Date.now(), durationMs: 30 * 60_000 })}>暂停 30 分钟</button>
        <button className="secondary" onClick={() => void window.keepEyes.closeEarlyReminder()}>知道了</button>
        <button className="secondary" onClick={skipRest}>跳过本次休息</button>
      </div>}
      {state.phase !== "resting" && state.phase !== "awaiting-action" && <div className="actions">
        <button onClick={() => timedAction("BEGIN_REST")}>立刻休息</button>
        {state.phase === "paused" && <button onClick={() => timedAction("RESUME")}>恢复提醒</button>}
      </div>}
      {state.phase === "resting" && state.settings.restMode === "overlay" && <div className="actions"><button onClick={() => timedAction("END_REST")}>提前结束休息</button></div>}
    </> : <section className="settings">
      <h2>提醒设置</h2>
      <label>用眼间隔（分钟）<input type="number" min="1" max="240" value={draft.eyeIntervalMinutes} onChange={(event) => setDraft({ ...draft, eyeIntervalMinutes: numberValue(event.target.value) })} /></label>
      <label>休息时长（秒）<input type="number" min="5" max="3600" value={draft.restDurationSeconds} onChange={(event) => setDraft({ ...draft, restDurationSeconds: numberValue(event.target.value) })} /></label>
      <label>延后时长（分钟）<input type="number" min="1" max="120" value={draft.snoozeMinutes} onChange={(event) => setDraft({ ...draft, snoozeMinutes: numberValue(event.target.value) })} /></label>
      <label>提前提醒（秒）<input type="number" min="0" max="300" value={draft.earlyReminderSeconds} onChange={(event) => setDraft({ ...draft, earlyReminderSeconds: numberValue(event.target.value) })} /><small>范围 0～300，默认 30；设置为 0 表示不提前显示。</small></label>
      <label>眼睛放松提醒（分钟）<input type="number" min="0" max="240" value={draft.relaxPromptMinutes} onChange={(event) => setDraft({ ...draft, relaxPromptMinutes: numberValue(event.target.value) })} /><small>每隔该时间弹出一次提示，不进入黑屏或锁定。0 表示关闭。</small></label>
      <fieldset>
        <legend>休息方式</legend>
        <label className="mode">
          <input type="radio" checked={draft.restMode === "overlay"} onChange={() => setDraft({ ...draft, restMode: "overlay" })} />
          黑屏遮罩 + 休息倒计时
          <small>所有已连接屏幕显示遮罩；可在任意屏幕点击“提前结束休息”。</small>
        </label>
        <label className="mode">
          <input type="radio" checked={draft.restMode === "lock"} onChange={() => setDraft({ ...draft, restMode: "lock" })} />
          直接锁定 Windows
          <small>效果类似 Win + L；需要使用 PIN、密码或 Windows Hello 解锁，应用不会自动解锁。</small>
        </label>
      </fieldset>
      <p className="hint">不会关闭显示器。提前提醒会同时出现在所有屏幕顶部。双屏缩放不同时，遮罩会反复对准每一块屏幕。</p>
      <div className="actions"><button onClick={() => void save()}>保存设置</button><button className="secondary" onClick={() => { setDraft(state.settings); setView("status"); }}>取消</button></div>
    </section>}
  </main>;
}
