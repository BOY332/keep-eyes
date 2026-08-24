import { describe, expect, it } from "vitest";
import { WindowsSensitiveContextDetector } from "./windows-sensitive-context";

describe("WindowsSensitiveContextDetector", () => {
  it("非 Windows 平台保守地返回 false，不阻断正常提醒", async () => {
    if (process.platform !== "win32") await expect(new WindowsSensitiveContextDetector().isSensitiveContext()).resolves.toBe(false);
  });
});
