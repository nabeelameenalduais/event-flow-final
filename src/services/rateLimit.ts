const requestCounts = new Map<string, { count: number; resetAt: number }>()

export async function checkRateLimit(key: string, maxRequests = 30, windowMs = 60000): Promise<void> {
  const now = Date.now()
  const entry = requestCounts.get(key)
  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    throw new Error(`Rate limit exceeded. Try again in ${retryAfter} seconds.`)
  }
  entry.count++
}

export async function withRateLimit<T>(key: string, fn: () => Promise<T>): Promise<T> {
  await checkRateLimit(key)
  return fn()
}
