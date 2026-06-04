import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ArrowDownToLine, Package, Truck, Users, LogOut, LayoutList } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getInitials } from '../lib/utils'
import { useTheme } from '../hooks/useTheme'
import { Sun, Moon } from 'lucide-react'

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pedidos', icon: LayoutList, label: 'Pedidos' },
    { to: '/entrada', icon: ArrowDownToLine, label: 'Captação' },
    { to: '/estoque', icon: Package, label: 'Armazém' },
    { to: '/expedicao', icon: Truck, label: 'Vendas' },
    { to: '/cadastros', icon: Users, label: 'Cadastros' },
]

const roleLabel: Record<string, string> = {
    dono: 'Proprietário',
    operador: 'Operador',
    vendedor: 'Vendedor',
}

export default function Sidebar() {
    const { profile, role, signOut } = useAuth()
    const navigate = useNavigate()
    const [isCollapsed, setIsCollapsed] = useState(true)
    const { theme, toggleTheme } = useTheme()

    async function handleLogout() {
        await signOut()
        navigate('/login')
    }

    return (
        <aside
            onMouseEnter={() => setIsCollapsed(false)}
            onMouseLeave={() => setIsCollapsed(true)}
            className={`${isCollapsed ? 'w-20' : 'w-64'
                } h-screen bg-[var(--card)] flex flex-col border-r border-border flex-shrink-0 z-50 transition-all duration-300 ease-in-out relative sticky top-0`}
        >

            {/* Logo area - Fixed at top */}
            <div className={`p-4 flex-shrink-0 ${isCollapsed ? 'px-2' : 'p-8 pb-6'} transition-all`}>
                <div className={`flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-border ${isCollapsed ? 'p-2' : 'p-3'}`}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-700 flex-shrink-0">

                        <img src="/logo.png" alt="Logo Nova Aliança" className="w-full h-full object-cover" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="font-extrabold text-foreground text-base tracking-tight leading-none truncate">Nova Aliança</span>
                            <span className="text-[10px] font-bold text-brand-500 tracking-[0.2em] uppercase mt-1 truncate">Distribuição</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation - Scrollable if content exceeds height */}
            <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1 custom-scrollbar ${isCollapsed ? 'px-2' : 'px-4'}`}>
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                            `${isActive ? 'sidebar-item-active group' : 'sidebar-item group'} ${isCollapsed ? 'justify-center px-0' : ''
                            }`
                        }
                        title={isCollapsed ? label : ''}
                    >
                        <Icon className="w-5 h-5 transition-transform group-hover:scale-110 flex-shrink-0" />
                        {!isCollapsed && <span className="truncate">{label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Footer - User & Theme */}
            <div className={`p-4 mt-auto border-t border-border space-y-4 flex-shrink-0 ${isCollapsed ? 'px-2' : 'p-6'}`}>
                {!isCollapsed && (
                    <div className="flex flex-col px-2 gap-1 mb-2">
                        <span className="text-[9px] font-bold text-muted uppercase tracking-widest">Sistema Administrativo</span>
                        <span className="text-[9px] text-muted opacity-50 font-medium tracking-tight">v1.1.0 (Electric Velocity)</span>
                    </div>
                )}

                <div className={`flex items-center bg-zinc-50 dark:bg-zinc-900/50 border border-border transition-all duration-300 rounded-2xl ${isCollapsed ? 'p-1.5 flex-col gap-2' : 'p-2 gap-3'}`}>
                    <div className="w-9 h-9 rounded-xl bg-brand-600 text-white font-bold flex items-center justify-center text-xs shadow-lg shadow-brand-500/20 flex-shrink-0">
                        {getInitials(profile?.nome ?? 'U')}
                    </div>

                    {!isCollapsed && (
                        <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="text-sm font-bold text-foreground truncate">{profile?.nome ?? 'Usuário'}</p>
                            <p className="text-[10px] font-bold text-brand-500 uppercase tracking-wider truncate">{roleLabel[role ?? ''] ?? role}</p>
                        </div>
                    )}

                    <div className={`flex ${isCollapsed ? 'flex-col' : 'items-center'} gap-1`}>
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-muted hover:text-brand-500 transition-colors"
                            title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
                        >
                            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={handleLogout}
                            title="Sair"
                            className="p-2 text-muted hover:text-red-500 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    )
}
