import type { ReminderSnapshot } from "./reminder-machine";

export interface StoredReminderData {
  snapshot: ReminderSnapshot;
}

export interface ReminderStore {
  load(): Promise<StoredReminderData | null>;
  save(data: StoredReminderData): Promise<void>;
  clear(): Promise<void>;
}
