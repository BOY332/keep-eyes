export interface ReminderSettings {
  eyeIntervalMinutes: number;
  restDurationSeconds: number;
  snoozeMinutes: number;
  earlyReminderSeconds: number;
}

export const DEFAULT_SETTINGS: ReminderSettings = {
  eyeIntervalMinutes: 20,
  restDurationSeconds: 20,
  snoozeMinutes: 5,
  earlyReminderSeconds: 30
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
    throw new Error(`${key} ������ ${minimum} �� ${maximum} ֮���������`);
  }
  return value;
}

/**
 * ֻ�����ǰ��Ʒ֧�ֵ������ֶΡ�չ���ɰ�־û�����ʱ����Ȼ�����ѷ�����
 * ����ģʽ������ʱ�估 Windows �����ֶΣ���֤�����ݿ��԰�ȫǨ�ơ�
 */
export function validateSettings(input: Partial<ReminderSettings> | Record<string, unknown>): ReminderSettings {
  const values = { ...DEFAULT_SETTINGS, ...input };
  return {
    eyeIntervalMinutes: integerInRange(values.eyeIntervalMinutes, "eyeIntervalMinutes"),
    restDurationSeconds: integerInRange(values.restDurationSeconds, "restDurationSeconds"),
    snoozeMinutes: integerInRange(values.snoozeMinutes, "snoozeMinutes"),
    earlyReminderSeconds: integerInRange(values.earlyReminderSeconds, "earlyReminderSeconds")
  };
}
