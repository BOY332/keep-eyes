import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReminderStore, StoredReminderData } from "../shared/store";

export class JsonFileReminderStore implements ReminderStore {
  public constructor(private readonly filePath: string) {}
  async load(): Promise<StoredReminderData | null> {
    try { return JSON.parse(await fs.readFile(this.filePath, "utf8")) as StoredReminderData; }
    catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async save(data: StoredReminderData): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(temporaryPath, this.filePath);
  }
  async clear(): Promise<void> { await fs.rm(this.filePath, { force: true }); }
}
