import { Navigate } from "react-router-dom"
import type { ReactNode } from "react"
import { useAuth } from "../contexts/AuthContext"

interface PublicRouteProps {
  children: ReactNode
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { isLoading, role } = useAuth()

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
  if (role === "organizer" || role === "admin") return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
