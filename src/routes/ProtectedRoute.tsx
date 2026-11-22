import { Navigate } from "react-router-dom"
import type { ReactNode } from "react"
import { useAuth } from "../contexts/AuthContext"
import type { RoleName } from "../types"

interface ProtectedRouteProps {
  children: ReactNode
  roles?: RoleName[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role } = useAuth()

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && (!role || !roles.includes(role))) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
