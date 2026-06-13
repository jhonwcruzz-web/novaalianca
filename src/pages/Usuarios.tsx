import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DEFAULT_PERMISSIONS } from '../lib/types'
import type { Permissoes, UserRole } from '../lib/types'
import toast from 'react-hot-toast'
import { UserPlus, Pencil, KeyRound, Trash2, ShieldCheck, ShieldOff, X } from 'lucide-react'

interface UserProfile {
    id: string
    nome: string | null
    email: string | null
    role: UserRole
    status: 'ativo' | 'inativo'
    permissions: Permissoes | null
    created_at: string
}

const roleLabel: Record<string, string> = { dono: 'Dono', operador: 'Operador', vendedor: 'Vendedor' }
const roleBadge: Record<string, string> = {
    dono: 'bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300',
    operador: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    vendedor: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
}

const TELA_LABELS: Record<string, string> = {
    dashboard: 'Dashboard', pedidos: 'Pedidos', entrada: 'Captação',
    estoque: 'Armazém', expedicao: 'Vendas', cadastros: 'Cadastros', usuarios: 'Usuários',
}
const ACAO_LABELS: Record<string, string> = {
    importar: 'Importar', exportar: 'Exportar', excluir: 'Excluir', romaneio: 'Gerar Romaneio',
}

function blankPerms(role: string): Permissoes {
    return JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.operador))
}

// ── Modal Criar Usuário ────────────────────────────────────────────────────────
function CreateModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
    const [nome, setNome] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState<UserRole>('operador')
    const [perms, setPerms] = useState<Permissoes>(blankPerms('operador'))
    const [saving, setSaving] = useState(false)

    function handleRoleChange(r: UserRole) {
        setRole(r)
        setPerms(blankPerms(r))
    }

    function toggleTela(k: string) {
        setPerms(p => ({ ...p, telas: { ...p.telas, [k]: !p.telas[k as keyof typeof p.telas] } }))
    }
    function toggleAcao(k: string) {
        setPerms(p => ({ ...p, acoes: { ...p.acoes, [k]: !p.acoes[k as keyof typeof p.acoes] } }))
    }

    async function handleSave() {
        if (!nome.trim() || !email.trim() || !password.trim()) {
            toast.error('Preencha nome, e-mail e senha')
            return
        }
        if (password.length < 6) { toast.error('Senha mínima: 6 caracteres'); return }
        setSaving(true)
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'create', nome, email, password, role, permissions: perms }
        })
        setSaving(false)
        if (error || data?.error) { toast.error(data?.error ?? error?.message ?? 'Erro ao criar usuário'); return }
        toast.success('Usuário criado com sucesso!')
        onSave()
    }

    return <ModalWrapper title="Novo Usuário" onClose={onClose}>
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="form-label">Nome</label>
                    <input className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="João Silva" />
                </div>
                <div>
                    <label className="form-label">Perfil</label>
                    <select className="input" value={role} onChange={e => handleRoleChange(e.target.value as UserRole)}>
                        <option value="operador">Operador</option>
                        <option value="vendedor">Vendedor</option>
                        <option value="dono">Dono</option>
                    </select>
                </div>
            </div>
            <div>
                <label className="form-label">E-mail</label>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="joao@empresa.com" />
            </div>
            <div>
                <label className="form-label">Senha</label>
                <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <PermsEditor perms={perms} onToggleTela={toggleTela} onToggleAcao={toggleAcao} />
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="btn-secondary text-sm py-2">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2">
                    {saving ? 'Criando...' : 'Criar Usuário'}
                </button>
            </div>
        </div>
    </ModalWrapper>
}

// ── Modal Editar Usuário ───────────────────────────────────────────────────────
function EditModal({ user, onClose, onSave }: { user: UserProfile; onClose: () => void; onSave: () => void }) {
    const [nome, setNome] = useState(user.nome ?? '')
    const [role, setRole] = useState<UserRole>(user.role)
    const [status, setStatus] = useState(user.status)
    const [perms, setPerms] = useState<Permissoes>(user.permissions ?? blankPerms(user.role))
    const [saving, setSaving] = useState(false)

    function handleRoleChange(r: UserRole) {
        setRole(r)
        setPerms(blankPerms(r))
    }

    function toggleTela(k: string) {
        setPerms(p => ({ ...p, telas: { ...p.telas, [k]: !p.telas[k as keyof typeof p.telas] } }))
    }
    function toggleAcao(k: string) {
        setPerms(p => ({ ...p, acoes: { ...p.acoes, [k]: !p.acoes[k as keyof typeof p.acoes] } }))
    }

    async function handleSave() {
        if (!nome.trim()) { toast.error('Nome obrigatório'); return }
        setSaving(true)
        const { error } = await supabase.from('profiles').update({ nome, role, status, permissions: perms }).eq('id', user.id)
        setSaving(false)
        if (error) { toast.error('Erro ao salvar: ' + error.message); return }
        toast.success('Usuário atualizado!')
        onSave()
    }

    return <ModalWrapper title={`Editar — ${user.nome}`} onClose={onClose}>
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                    <label className="form-label">Nome</label>
                    <input className="input" value={nome} onChange={e => setNome(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">Perfil</label>
                    <select className="input" value={role} onChange={e => handleRoleChange(e.target.value as UserRole)}>
                        <option value="operador">Operador</option>
                        <option value="vendedor">Vendedor</option>
                        <option value="dono">Dono</option>
                    </select>
                </div>
                <div>
                    <label className="form-label">Status</label>
                    <select className="input" value={status} onChange={e => setStatus(e.target.value as 'ativo' | 'inativo')}>
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                    </select>
                </div>
            </div>
            <PermsEditor perms={perms} onToggleTela={toggleTela} onToggleAcao={toggleAcao} />
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="btn-secondary text-sm py-2">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2">
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </div>
    </ModalWrapper>
}

// ── Modal Reset Senha ──────────────────────────────────────────────────────────
function PasswordModal({ user, onClose }: { user: UserProfile; onClose: () => void }) {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        if (password.length < 6) { toast.error('Mínimo 6 caracteres'); return }
        if (password !== confirm) { toast.error('Senhas não conferem'); return }
        setSaving(true)
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'update_password', user_id: user.id, password }
        })
        setSaving(false)
        if (error || data?.error) { toast.error(data?.error ?? 'Erro ao alterar senha'); return }
        toast.success('Senha alterada com sucesso!')
        onClose()
    }

    return <ModalWrapper title={`Redefinir Senha — ${user.nome}`} onClose={onClose}>
        <div className="space-y-4">
            <div>
                <label className="form-label">Nova Senha</label>
                <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
                <label className="form-label">Confirmar Senha</label>
                <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="btn-secondary text-sm py-2">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2">
                    {saving ? 'Salvando...' : 'Alterar Senha'}
                </button>
            </div>
        </div>
    </ModalWrapper>
}

// ── Componente de Permissões ───────────────────────────────────────────────────
function PermsEditor({ perms, onToggleTela, onToggleAcao }: {
    perms: Permissoes
    onToggleTela: (k: string) => void
    onToggleAcao: (k: string) => void
}) {
    return (
        <div className="border border-border rounded-xl p-4 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Permissões de Acesso</p>
            <div>
                <p className="text-xs font-bold text-foreground mb-2">Telas</p>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(TELA_LABELS).map(([k, label]) => (
                        <label key={k} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="accent-[var(--accent)] w-4 h-4"
                                checked={!!perms.telas[k as keyof typeof perms.telas]}
                                onChange={() => onToggleTela(k)}
                            />
                            <span className="text-sm text-foreground">{label}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div>
                <p className="text-xs font-bold text-foreground mb-2">Ações</p>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(ACAO_LABELS).map(([k, label]) => (
                        <label key={k} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="accent-[var(--accent)] w-4 h-4"
                                checked={!!perms.acoes[k as keyof typeof perms.acoes]}
                                onChange={() => onToggleAcao(k)}
                            />
                            <span className="text-sm text-foreground">{label}</span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── Modal Wrapper ──────────────────────────────────────────────────────────────
function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-base font-bold text-foreground">{title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-brand-50 dark:hover:bg-brand-900/30 transition">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    )
}

// ── Página Principal ───────────────────────────────────────────────────────────
export default function Usuarios() {
    const { role: myRole, profile: myProfile } = useAuth()
    const [users, setUsers] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [editing, setEditing] = useState<UserProfile | null>(null)
    const [resettingPw, setResettingPw] = useState<UserProfile | null>(null)

    if (myRole !== 'dono') {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted">
                <ShieldOff className="w-10 h-10 opacity-30" />
                <p className="text-sm font-medium">Acesso restrito ao Dono do sistema.</p>
            </div>
        )
    }

    async function fetchUsers() {
        setLoading(true)
        const { data } = await supabase
            .from('profiles')
            .select('id, nome, email, role, status, permissions, created_at')
            .order('created_at')
        setUsers((data ?? []) as UserProfile[])
        setLoading(false)
    }

    useEffect(() => { fetchUsers() }, [])

    async function toggleStatus(u: UserProfile) {
        const next = u.status === 'ativo' ? 'inativo' : 'ativo'
        const { error } = await supabase.from('profiles').update({ status: next }).eq('id', u.id)
        if (error) { toast.error('Erro ao atualizar status'); return }
        toast.success(`Usuário ${next === 'ativo' ? 'ativado' : 'desativado'}`)
        fetchUsers()
    }

    async function deleteUser(u: UserProfile) {
        if (!confirm(`Excluir permanentemente o usuário "${u.nome}"? Esta ação não pode ser desfeita.`)) return
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'delete', user_id: u.id }
        })
        if (error || data?.error) { toast.error(data?.error ?? 'Erro ao excluir'); return }
        toast.success('Usuário excluído')
        fetchUsers()
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Usuários</h1>
                    <p className="text-sm text-muted mt-0.5">Gerencie acessos e permissões do sistema.</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary text-sm py-2">
                    <UserPlus className="w-4 h-4" /> Novo Usuário
                </button>
            </div>

            {/* Tabela */}
            <div className="card p-0 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-muted text-sm">Carregando...</div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr>
                                <th className="table-header">Nome</th>
                                <th className="table-header">E-mail</th>
                                <th className="table-header">Perfil</th>
                                <th className="table-header">Status</th>
                                <th className="table-header">Telas</th>
                                <th className="table-header">Ações</th>
                                <th className="table-header"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => {
                                const isSelf = u.id === myProfile?.id
                                const perms = u.permissions ?? DEFAULT_PERMISSIONS[u.role]
                                const telasAtivas = Object.entries(perms.telas).filter(([, v]) => v).map(([k]) => TELA_LABELS[k]).join(', ')
                                return (
                                    <tr key={u.id} className="hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-colors">
                                        <td className="table-cell font-medium text-foreground">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                    {(u.nome ?? 'U').slice(0, 2).toUpperCase()}
                                                </div>
                                                {u.nome ?? '—'}
                                                {isSelf && <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-wider">(você)</span>}
                                            </div>
                                        </td>
                                        <td className="table-cell text-muted">{u.email ?? '—'}</td>
                                        <td className="table-cell">
                                            <span className={`badge ${roleBadge[u.role] ?? 'badge'}`}>
                                                {roleLabel[u.role] ?? u.role}
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            <span className={`badge ${u.status === 'ativo' ? 'badge-success' : 'badge-cat3'}`}>
                                                {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="table-cell text-xs text-muted max-w-[200px] truncate" title={telasAtivas}>
                                            {telasAtivas || '—'}
                                        </td>
                                        <td className="table-cell">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setEditing(u)}
                                                    className="p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 text-muted hover:text-brand-600 transition"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setResettingPw(u)}
                                                    className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-muted hover:text-amber-600 transition"
                                                    title="Redefinir senha"
                                                >
                                                    <KeyRound className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(u)}
                                                    disabled={isSelf}
                                                    className="p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 text-muted hover:text-brand-600 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title={u.status === 'ativo' ? 'Desativar' : 'Ativar'}
                                                >
                                                    {u.status === 'ativo'
                                                        ? <ShieldOff className="w-3.5 h-3.5" />
                                                        : <ShieldCheck className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                    onClick={() => deleteUser(u)}
                                                    disabled={isSelf}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted hover:text-danger transition disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Excluir usuário"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="table-cell" />
                                    </tr>
                                )
                            })}
                            {users.length === 0 && (
                                <tr><td colSpan={7} className="table-cell text-center text-muted py-12">Nenhum usuário encontrado</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modais */}
            {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSave={() => { setShowCreate(false); fetchUsers() }} />}
            {editing && <EditModal user={editing} onClose={() => setEditing(null)} onSave={() => { setEditing(null); fetchUsers() }} />}
            {resettingPw && <PasswordModal user={resettingPw} onClose={() => setResettingPw(null)} />}
        </div>
    )
}
