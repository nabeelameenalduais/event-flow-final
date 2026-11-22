export function isMissingFunction(error: unknown): boolean {
  if (!error) return false
  const e = error as { code?: string; message?: string }
  if (e.code === "PGRST202") return true
  return String(e.message ?? "").includes("Could not find the function")
}

export function isMissingRelation(error: unknown): boolean {
  if (!error) return false
  const e = error as { code?: string; message?: string }
  if (e.code === "PGRST205" || e.code === "42P01") return true
  const msg = String(e.message ?? "")
  return msg.includes("Could not find the table") || msg.includes("does not exist")
}
