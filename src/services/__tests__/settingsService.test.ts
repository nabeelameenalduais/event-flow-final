import { describe, it, expect } from "vitest"
import { getSettings, updateEmailTemplate } from "../settingsService"

describe("settingsService", () => {
  it("getSettings returns settings with templates", async () => {
    const result = await getSettings()
    expect(result.appName).toBe("EventFlow")
    expect(result.emailTemplates.length).toBeGreaterThan(0)
  }, 30000)

  it("updateEmailTemplate returns undefined for unknown id", async () => {
    const result = await updateEmailTemplate("00000000-0000-0000-0000-000000000000", { subject: "X" })
    expect(result).toBeUndefined()
  }, 30000)
})
