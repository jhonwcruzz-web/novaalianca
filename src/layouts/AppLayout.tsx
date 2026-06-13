import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { useAuth } from '../contexts/AuthContext'
import { FlaskConical } from 'lucide-react'

export default function AppLayout() {
    const { isBeta } = useAuth()

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0">
                {isBeta && (
                    <div className="flex items-center justify-center gap-2 bg-amber-500 text-amber-950 text-xs font-bold px-4 py-2 tracking-wide">
                        <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" />
                        MODO BETA — Visualização somente leitura. Nenhuma alteração é salva no sistema oficial.
                    </div>
                )}
                <Topbar />
                <main className="flex-1 p-6 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
