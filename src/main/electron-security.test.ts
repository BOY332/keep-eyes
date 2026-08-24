import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
describe("Electron 安全边界", () => { it("主窗口启用安全边界并只通过预加载暴露 API", async () => { const main = await readFile(path.resolve(process.cwd(), "src/main/index.ts"), "utf8"); const preload = await readFile(path.resolve(process.cwd(), "src/preload/index.ts"), "utf8"); expect(main).toContain("contextIsolation: true"); expect(main).toContain("nodeIntegration: false"); expect(main).toContain("sandbox: true"); expect(preload).toContain('contextBridge.exposeInMainWorld("keepEyes", api)'); expect(preload).not.toContain("require("); }); });
