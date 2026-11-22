import { describe, it, expect, vi, beforeEach } from "vitest"
import { login, register, restoreSession, requestPasswordReset, resetPasswordWithToken } from "../authService"

const { rpcMocks, legacy } = vi.hoisted(() => {
  const makeFn = () => vi.fn()
  return {
    rpcMocks: {
      authenticate_user: makeFn(),
      get_profile_by_email: makeFn(),
      register_user: makeFn(),
      get_session_user: makeFn(),
      revoke_session: makeFn(),
      user_exists: makeFn(),
      request_password_reset: makeFn(),
      reset_password_with_token: makeFn(),
    } as Record<string, ReturnType<typeof vi.fn>>,
    legacy: {
      usersRow: null as any,
      rolesRow: { id: "r-attendee", name: "attendee" },
      profileRow: null as any,
    },
  }
})

vi.mock("../../lib/supabase", () => {
  const builder = (row: any) => {
    const b: any = {
      select: () => b,
      eq: () => b,
      ilike: () => b,
      order: () => b,
      single: () => Promise.resolve({ data: row, error: null }),
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
    }
    return b
  }
  return {
    supabase: {
      rpc: (name: string, args: Record<string, unknown>) => {
        const fn = rpcMocks[name]
        if (!fn) return Promise.resolve({ data: null, error: { message: `unknown rpc: ${name}` } })
        return Promise.resolve((fn as (args: Record<string, unknown>) => unknown)(args))
      },
      from: (table: string) => {
        if (table === "users") {
          return {
            ...builder(legacy.usersRow),
            insert: () => ({ data: null, error: null }),
          }
        }
        if (table === "roles") return builder(legacy.rolesRow)
        if (table === "profiles") {
          return {
            insert: () => ({
              select: () => ({ single: () => Promise.resolve({ data: legacy.profileRow, error: null }) }),
            }),
          }
        }
        return builder(null)
      },
    },
  }
})

const adminPayload = {
  user: { id: "u-admin", email: "admin@eventflow.com", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z", suspended: false },
  profile: { id: "p-admin", user_id: "u-admin", first_name: "Alice", last_name: "Smith", phone_number: "", avatar_url: "", role_id: "r-admin", manages_all_events: true },
  role: "admin",
}

const attendeePayload = {
  user: { id: "u-new", email: "newuser@test.com", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z", suspended: false },
  profile: { id: "p-new", user_id: "u-new", first_name: "Test", last_name: "User", phone_number: "", avatar_url: "", role_id: "r-attendee", manages_all_events: false },
  role: "attendee",
}

const legacyAdminRow = {
  id: "u-admin",
  email: "admin@eventflow.com",
  password_hash: "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",
  suspended: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  profiles: {
    id: "p-admin",
    first_name: "Alice",
    last_name: "Admin",
    phone_number: "",
    avatar_url: "",
    role_id: "r-admin",
    roles: { id: "r-admin", name: "admin" },
  },
}

const pgrst202 = { code: "PGRST202", message: "Could not find the function in the schema cache" }

beforeEach(() => {
  for (const fn of Object.values(rpcMocks)) fn.mockReset()
  legacy.usersRow = null
  legacy.profileRow = null
  localStorage.clear()
})

describe("authService", () => {
  it("login with valid email returns user, profile, and role", async () => {
    rpcMocks.authenticate_user.mockResolvedValue({ data: adminPayload, error: null })
    const result = await login("admin@eventflow.com", "password123")
    expect(result.user.email).toBe("admin@eventflow.com")
    expect(result.profile.firstName).toBe("Alice")
    expect(result.role).toBe("admin")
  })

  it("login with invalid email throws error", async () => {
    rpcMocks.authenticate_user.mockResolvedValue({ data: { error: "Invalid email or password" }, error: null })
    await expect(login("nonexistent@test.com", "any")).rejects.toThrow("Invalid email or password")
  })

  it("register creates new user with attendee role", async () => {
    const email = `newuser-${Date.now()}@test.com`
    rpcMocks.register_user.mockResolvedValue({ data: { ...attendeePayload, user: { ...attendeePayload.user, email } }, error: null })
    const result = await register(email, "pass", "Test", "User")
    expect(result.user.email).toBe(email)
    expect(result.role).toBe("attendee")
    expect(result.profile.firstName).toBe("Test")
    expect(result.profile.lastName).toBe("User")
  })

  it("register with duplicate email throws error", async () => {
    rpcMocks.register_user.mockResolvedValue({ data: { error: "Email already in use" }, error: null })
    await expect(register("admin@eventflow.com", "pass", "Dup", "User")).rejects.toThrow("Email already in use")
  })

  it("requestPasswordReset returns a token when the email exists", async () => {
    rpcMocks.request_password_reset.mockResolvedValue({
      data: { ok: true, token: "abc123", expires_at: "2024-01-01T00:30:00Z" },
      error: null,
    })
    const result = await requestPasswordReset("admin@eventflow.com")
    expect(result.ok).toBe(true)
    expect(result.token).toBe("abc123")
  })

  it("requestPasswordReset does not reveal whether the email exists", async () => {
    rpcMocks.request_password_reset.mockResolvedValue({
      data: { error: "If that email exists, a reset link has been sent." },
      error: null,
    })
    const result = await requestPasswordReset("ghost@test.com")
    expect(result.ok).toBeFalsy()
    expect(result.error).toBeTruthy()
  })

  it("resetPasswordWithToken resolves on success and throws on invalid token", async () => {
    rpcMocks.reset_password_with_token.mockResolvedValue({ data: { ok: true }, error: null })
    await expect(resetPasswordWithToken("token", "newpass123")).resolves.toBeUndefined()

    rpcMocks.reset_password_with_token.mockResolvedValue({ data: { error: "Reset token is invalid or expired." }, error: null })
    await expect(resetPasswordWithToken("bad", "newpass123")).rejects.toThrow("Reset token is invalid or expired.")
  })

  describe("legacy schema fallback", () => {
    it("login falls back to SHA-256 auth when the RPC is missing", async () => {
      legacy.usersRow = legacyAdminRow
      rpcMocks.authenticate_user.mockResolvedValue({ data: null, error: pgrst202 })
      const result = await login("admin@eventflow.com", "password123")
      expect(result.user.email).toBe("admin@eventflow.com")
      expect(result.profile.firstName).toBe("Alice")
      expect(result.role).toBe("admin")
    })

    it("legacy login rejects a wrong password", async () => {
      legacy.usersRow = legacyAdminRow
      rpcMocks.authenticate_user.mockResolvedValue({ data: null, error: pgrst202 })
      await expect(login("admin@eventflow.com", "wrong-password")).rejects.toThrow("Invalid email or password")
    })

    it("register falls back to direct insert when the RPC is missing", async () => {
      legacy.usersRow = {
        id: "u-legacy",
        email: "legacy@test.com",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        suspended: false,
      }
      legacy.profileRow = {
        id: "p-legacy",
        user_id: "u-legacy",
        first_name: "Legacy",
        last_name: "User",
        phone_number: "",
        avatar_url: "",
        role_id: "r-attendee",
      }
      rpcMocks.register_user.mockResolvedValue({ data: null, error: pgrst202 })
      const result = await register("legacy@test.com", "pass123", "Legacy", "User")
      expect(result.user.email).toBe("legacy@test.com")
      expect(result.profile.firstName).toBe("Legacy")
      expect(result.role).toBe("attendee")
    })

    it("restoreSession falls back to the persisted legacy session", async () => {
      legacy.usersRow = legacyAdminRow
      rpcMocks.authenticate_user.mockResolvedValue({ data: null, error: pgrst202 })
      await login("admin@eventflow.com", "password123")

      legacy.usersRow = { ...legacyAdminRow, password_hash: undefined }
      rpcMocks.get_session_user.mockResolvedValue({ data: null, error: pgrst202 })
      const result = await restoreSession("any-token")
      expect(result.user.email).toBe("admin@eventflow.com")
      expect(result.role).toBe("admin")
    })
  })
})
