import { Search, Bell, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getInitials } from '../lib/utils'

const roleLabel: Record<string, string> = {
    dono: 'Proprietário',
    operador: 'Operador',
    vendedor: 'Vendedor',
}

export default function Topbar() {
    const { profile, role } = useAuth()

    return (
        <header className="h-14 bg-[var(--card)] border-b border-border flex items-center px-6 gap-4 flex-shrink-0 shadow-sm transition-colors duration-300">
            {/* Search */}
            <div className="flex-1 max-w-lg">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                        type="text"
                        placeholder="Buscar paletes, notas ou produtores..."
                        className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                    />
                </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-3 ml-auto">
                <button className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-muted transition relative">
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full ring-2 ring-[var(--card)]" />
                </button>
                <button className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-muted transition">
                    <Settings className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2.5 pl-3 border-l border-border">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-foreground leading-tight">{profile?.nome ?? 'Usuário'}</p>
                        <p className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">{roleLabel[role ?? ''] ?? role}</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-brand-500/10 text-brand-600 font-bold text-xs flex items-center justify-center border border-brand-500/20">
                        {getInitials(profile?.nome ?? 'U')}
                    </div>
                </div>
            </div>
        </header>
    )
}
