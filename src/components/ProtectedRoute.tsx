import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { UserRole } from '../lib/types'

interface Props {
    allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ allowedRoles }: Props) {
    const { session, role, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center animate-pulse">
                        <span className="text-2xl">🍇</span>
                    </div>
                    <p className="text-gray-500 text-sm">Carregando...</p>
                </div>
            </div>
        )
    }

    if (!session) return <Navigate to="/login" replace />

    if (allowedRoles && role && !allowedRoles.includes(role)) {
        return <Navigate to="/" replace />
    }

    return <Outlet />
}
