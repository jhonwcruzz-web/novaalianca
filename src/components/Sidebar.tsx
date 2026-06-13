import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ArrowDownToLine, Package, Truck, Users, UserCog, LogOut, LayoutList, ChevronLeft, ChevronRight, BoxesIcon, FileCheck2 } from 'lucide-react'
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
    { to: '/insumos', icon: BoxesIcon, label: 'Insumos' },
    { to: '/ptv', icon: FileCheck2, label: 'PTV / CFOP' },
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
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true')
    const { theme, toggleTheme } = useTheme()

    function toggleCollapse() {
        setIsCollapsed(prev => {
            localStorage.setItem('sidebar-collapsed', String(!prev))
            return !prev
        })
    }

    async function handleLogout() {
        await signOut()
        navigate('/login')
    }

    return (
        <aside
            className={`${isCollapsed ? 'w-20' : 'w-64'} h-screen bg-[var(--card)] flex flex-col border-r border-border flex-shrink-0 z-50 transition-all duration-300 ease-in-out relative sticky top-0`}
        >

            {/* Botão toggle collapse */}
            <button
                onClick={toggleCollapse}
                className="absolute -right-3 top-8 z-50 w-6 h-6 rounded-full bg-[var(--card)] border border-border shadow-md flex items-center justify-center text-muted hover:text-brand-500 hover:border-brand-400 transition-colors"
                title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
            </button>

            {/* Logo area - Fixed at top */}
            <div className={`flex items-center gap-3 flex-shrink-0 ${isCollapsed ? 'px-5 py-5 justify-center' : 'px-5 py-5'}`}>
                <img src="/logo.png" alt="Logo Nova Aliança" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                {!isCollapsed && (
                    <div className="flex flex-col overflow-hidden">
                        <span className="font-bold text-foreground text-[15px] tracking-tight leading-none truncate">Nova Aliança</span>
                        <span className="text-[10px] font-semibold text-[var(--accent)] tracking-[0.18em] uppercase mt-0.5 truncate">Distribuição</span>
                    </div>
                )}
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
                {role === 'dono' && (
                    <NavLink
                        to="/usuarios"
                        className={({ isActive }) =>
                            `${isActive ? 'sidebar-item-active group' : 'sidebar-item group'} ${isCollapsed ? 'justify-center px-0' : ''}`
                        }
                        title={isCollapsed ? 'Usuários' : ''}
                    >
                        <UserCog className="w-5 h-5 transition-transform group-hover:scale-110 flex-shrink-0" />
                        {!isCollapsed && <span className="truncate">Usuários</span>}
                    </NavLink>
                )}
            </nav>

            {/* Footer - User & Theme */}
            <div className={`p-4 mt-auto border-t border-border space-y-4 flex-shrink-0 ${isCollapsed ? 'px-2' : 'p-6'}`}>
                {!isCollapsed && (
                    <div className="flex flex-col px-2 gap-1 mb-2">
                        <span className="text-[9px] font-bold text-muted uppercase tracking-widest">Sistema Administrativo</span>
                        <span className="text-[9px] text-muted opacity-50 font-medium tracking-tight">v1.1.0 (Electric Velocity)</span>
                    </div>
                )}

                <div className={`flex items-center transition-all duration-300 ${isCollapsed ? 'flex-col gap-2' : 'gap-3'}`}>
                    <div className="w-9 h-9 rounded-xl bg-brand-600 text-white font-bold flex items-center justify-center text-xs shadow-brand flex-shrink-0">
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
