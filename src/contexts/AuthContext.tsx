import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { User, Profile, RoleName } from "../types"
import * as authService from "../services/authService"
import * as sessionService from "../services/deviceSessionService"
import { SESSION_KEY } from "../lib/session"

interface AuthState {
  user: User | null
  profile: Profile | null
  role: RoleName | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
  })

  useEffect(() => {
    const token = localStorage.getItem(SESSION_KEY)
    if (token) {
      authService
        .restoreSession(token)
        .then((result) => {
          setState({
            user: result.user,
            profile: result.profile,
            role: result.role,
            isAuthenticated: true,
            isLoading: false,
          })
        })
        .catch(() => {
          localStorage.removeItem(SESSION_KEY)
          setState((s) => ({ ...s, isLoading: false }))
        })
    } else {
      setState((s) => ({ ...s, isLoading: false }))
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }))
    try {
      const result = await authService.login(email, password)
      const session = await sessionService.createDeviceSession(result.user.id)
      if (session.token) localStorage.setItem(SESSION_KEY, session.token)
      setState({
        user: result.user,
        profile: result.profile,
        role: result.role,
        isAuthenticated: true,
        isLoading: false,
      })
      return result.user
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }))
      throw err instanceof Error ? err : new Error("Invalid email or password")
    }
  }, [])

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    setState((s) => ({ ...s, isLoading: true }))
    try {
      const result = await authService.register(email, password, firstName, lastName)
      const session = await sessionService.createDeviceSession(result.user.id)
      if (session.token) localStorage.setItem(SESSION_KEY, session.token)
      setState({
        user: result.user,
        profile: result.profile,
        role: result.role,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }))
      throw err instanceof Error ? err : new Error("Registration failed")
    }
  }, [])

  const logout = useCallback(() => {
    const token = localStorage.getItem(SESSION_KEY)
    if (token) {
      authService.revokeSession(token).catch(() => {})
    }
    localStorage.removeItem(SESSION_KEY)
    setState({ user: null, profile: null, role: null, isAuthenticated: false, isLoading: false })
  }, [])

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem(SESSION_KEY)
    if (!token) return
    const result = await authService.restoreSession(token)
    setState((s) => ({ ...s, user: result.user, profile: result.profile, role: result.role }))
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
