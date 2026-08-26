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

export function validateSettings(input: Partial<ReminderSettings> | Record<string, unknown>): ReminderSettings {
  const values = { ...DEFAULT_SETTINGS, ...input };
  if (values.restMode !== "overlay" && values.restMode !== "lock") {
    throw new Error("restMode 必须是 overlay 或 lock。");
  }
  return {
    eyeIntervalMinutes: integerInRange(values.eyeIntervalMinutes, "eyeIntervalMinutes"),
    restDurationSeconds: integerInRange(values.restDurationSeconds, "restDurationSeconds"),
    snoozeMinutes: integerInRange(values.snoozeMinutes, "snoozeMinutes"),
    earlyReminderSeconds: integerInRange(values.earlyReminderSeconds, "earlyReminderSeconds"),
    restMode: values.restMode
  };
}
