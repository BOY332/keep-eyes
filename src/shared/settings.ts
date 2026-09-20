export type RestMode = "overlay" | "lock";

export interface ReminderSettings {
  eyeIntervalMinutes: number;
  restDurationSeconds: number;
  snoozeMinutes: number;
  earlyReminderSeconds: number;
  restMode: RestMode;
}

export const DEFAULT_SETTINGS: ReminderSettings = {
  eyeIntervalMinutes: 20,
  restDurationSeconds: 20,
  snoozeMinutes: 5,
  earlyReminderSeconds: 30,
  restMode: "overlay"
};

const ranges = {
  eyeIntervalMinutes: [1, 240],
  restDurationSeconds: [5, 3600],
  snoozeMinutes: [1, 120],
  earlyReminderSeconds: [0, 300]
} as const;

function integerInRange(value: unknown, key: keyof typeof ranges): number {
  const [minimum, maximum] = ranges[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} 必须是 ${minimum} 到 ${maximum} 之间的整数。`);
  }
  return value;
}

function restModeValue(value: unknown): RestMode {
  if (value === "overlay" || value === "lock") return value;
  if (value === undefined) return DEFAULT_SETTINGS.restMode;
  throw new Error("restMode 必须是 overlay 或 lock。");
}

/**
 * 只接受当前产品支持的设置字段。扩展或被废弃后仍可能出现在
 * 持久化数据里的旧字段，例如关显示器相关字段，保证旧数据可以安全迁移。
 */
export function validateSettings(input: Partial<ReminderSettings> | Record<string, unknown>): ReminderSettings {
  const values = { ...DEFAULT_SETTINGS, ...input };
  return {
    eyeIntervalMinutes: integerInRange(values.eyeIntervalMinutes, "eyeIntervalMinutes"),
    restDurationSeconds: integerInRange(values.restDurationSeconds, "restDurationSeconds"),
    snoozeMinutes: integerInRange(values.snoozeMinutes, "snoozeMinutes"),
    earlyReminderSeconds: integerInRange(values.earlyReminderSeconds, "earlyReminderSeconds"),
    restMode: restModeValue(values.restMode)
  };
}
