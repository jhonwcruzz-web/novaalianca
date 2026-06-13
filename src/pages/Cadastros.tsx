import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Produtor, Variedade, Armazem, Cliente, Comprador, Local, Motorista, Vendedor } from '../lib/types'
import toast from 'react-hot-toast'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, getInitials } from '../lib/utils'
import ResizableHeader from '../components/ResizableHeader'

type Tab = 'produtores' | 'variedades' | 'armazens' | 'clientes' | 'compradores' | 'locais' | 'motoristas' | 'vendedores'

export default function Cadastros() {
    const { role } = useAuth()
    const isDono = role === 'dono'
    const canOperate = role === 'dono' || role === 'operador'

    const [tab, setTab] = useState<Tab>('produtores')
    const [showModal, setShowModal] = useState(false)
    const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null)

    const [produtores, setProdutores] = useState<Produtor[]>([])
    const [variedades, setVariedades] = useState<Variedade[]>([])
    const [armazens, setArmazens] = useState<Armazem[]>([])
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [compradores, setCompradores] = useState<Comprador[]>([])
    const [locais, setLocais] = useState<Local[]>([])
    const [motoristas, setMotoristas] = useState<Motorista[]>([])
    const [vendedores, setVendedores] = useState<Vendedor[]>([])

    async function fetchAll() {
        const [p, v, a, c, comp, loc, mot, vend] = await Promise.all([
            supabase.from('produtores').select('*').order('nome'),
            supabase.from('variedades').select('*').order('nome'),
            supabase.from('armazens').select('*').order('nome'),
            supabase.from('clientes').select('*').order('nome'),
            supabase.from('compradores').select('*').order('nome'),
            supabase.from('locais').select('*').order('nome'),
            supabase.from('motoristas').select('*').order('nome'),
            supabase.from('vendedores').select('*').order('nome'),
        ])
        setProdutores(p.data ?? [])
        setVariedades(v.data ?? [])
        setArmazens(a.data ?? [])
        setClientes(c.data ?? [])
        setCompradores(comp.data ?? [])
        setLocais(loc.data ?? [])
        setMotoristas(mot.data ?? [])
        setVendedores(vend.data ?? [])
    }

    useEffect(() => { fetchAll() }, [])

    async function handleDelete(id: string) {
        if (!isDono) return
        if (!confirm('Confirmar exclusão?')) return
        const tableMap: Record<Tab, string> = { produtores: 'produtores', variedades: 'variedades', armazens: 'armazens', clientes: 'clientes', compradores: 'compradores', locais: 'locais', motoristas: 'motoristas', vendedores: 'vendedores' }
        const { error } = await supabase.from(tableMap[tab]).delete().eq('id', id)
        if (error) toast.error('Erro ao excluir: ' + error.message)
        else { toast.success('Excluído com sucesso'); fetchAll() }
    }

    const tabs: { key: Tab; label: string; icon: string }[] = [
        { key: 'produtores', label: 'Produtores', icon: '👤' },
        { key: 'variedades', label: 'Variedades', icon: '🍇' },
        { key: 'armazens', label: 'Armazéns', icon: '🏠' },
        { key: 'clientes', label: 'Clientes', icon: '👥' },
        { key: 'compradores', label: 'Compradores', icon: '💼' },
        { key: 'locais', label: 'Locais', icon: '📍' },
        { key: 'motoristas', label: 'Motoristas', icon: '🚚' },
        { key: 'vendedores', label: 'Vendedores', icon: '💼' },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Cadastros</h1>

                    <p className="text-sm text-gray-500 mt-0.5">Gerencie produtores, variedades, armazéns e clientes da sua rede.</p>
                </div>
                {canOperate && (
                    <button onClick={() => { setEditItem(null); setShowModal(true) }} className="btn-primary">
                        <Plus className="w-4 h-4" /> Novo Registro
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="card">
                <div className="flex gap-1 border-b border-gray-100 mb-5">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition border-b-2 -mb-px ${tab === t.key ? 'border-brand-600 text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20' : 'border-transparent text-muted hover:text-foreground'
                                }`}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* Produtores */}
                {tab === 'produtores' && (
                    <>
                        <table className="w-full text-left">
                            <thead><tr>
                                <ResizableHeader initialWidth={300}>NOME</ResizableHeader>
                                <ResizableHeader initialWidth={150}>CPF/CNPJ</ResizableHeader>
                                <ResizableHeader initialWidth={150}>TELEFONE</ResizableHeader>
                                <ResizableHeader initialWidth={150}>CIDADE</ResizableHeader>
                                <ResizableHeader initialWidth={100}>STATUS</ResizableHeader>
                                <th className="table-header">AÇÕES</th>
                            </tr></thead>
                            <tbody>
                                {produtores.map(p => (
                                    <tr key={p.id} className="hover:bg-brand-50/30 transition-colors">
                                        <td className="table-cell">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center">{getInitials(p.nome)}</div>
                                                <span className="font-medium">{p.nome}</span>
                                            </div>
                                        </td>
                                        <td className="table-cell">{p.cpf_cnpj ?? '—'}</td>
                                        <td className="table-cell">{p.telefone ?? '—'}</td>
                                        <td className="table-cell">{p.cidade ?? '—'}</td>
                                        <td className="table-cell"><span className={p.status === 'ativo' ? 'badge-success' : 'badge-danger'}>{p.status}</span></td>
                                        <td className="table-cell">
                                            <div className="flex gap-1">
                                                <button onClick={() => { setEditItem(p as unknown as Record<string, unknown>); setShowModal(true) }} className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition"><Pencil className="w-3.5 h-3.5" /></button>
                                                {isDono && <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-danger transition"><Trash2 className="w-3.5 h-3.5" /></button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {produtores.length === 0 && <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-8">Nenhum produtor cadastrado</td></tr>}
                            </tbody>
                        </table>
                        <p className="text-sm text-gray-500 mt-3 border-t border-gray-100 pt-3">Mostrando {produtores.length} de {produtores.length} produtores</p>
                    </>
                )}

                {/* Variedades */}
                {tab === 'variedades' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {variedades.map(v => (
                            <div key={v.id} className={`border rounded-xl p-4 transition ${v.status === 'inativo' ? 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800' : 'card group'}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-lg">🍇</div>
                                            <span className={v.status === 'ativo' ? 'badge-success' : 'badge-danger'}>{v.status}</span>
                                        </div>
                                        <h3 className="font-semibold text-foreground">{v.nome}</h3>
                                        <div className="mt-2 space-y-1 text-sm text-muted">
                                            <p><span className="font-medium text-foreground/50">Tipo: </span>{v.tipo ?? '—'}</p>
                                            <p><span className="font-medium text-foreground/50">Cor: </span>{v.cor ?? '—'}</p>
                                            <p><span className="font-medium text-foreground/50">Categoria: </span>{v.categoria ?? '—'}</p>
                                        </div>
                                    </div>
                                    {canOperate && (
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => { setEditItem(v as unknown as Record<string, unknown>); setShowModal(true) }} className="p-1.5 rounded hover:bg-brand-50 dark:hover:bg-brand-900/20 text-gray-400 hover:text-brand-600 transition" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                                            {isDono && <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-danger transition" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {variedades.length === 0 && <p className="col-span-3 text-muted text-center py-8">Nenhuma variedade cadastrada</p>}
                    </div>
                )}



                {/* Armazéns */}
                {tab === 'armazens' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {armazens.map(a => (
                            <div key={a.id} className={`border rounded-xl p-4 transition ${a.status === 'inativo' ? 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800' : 'card group'}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xl">🏠</div>
                                            <span className={a.status === 'ativo' ? 'badge-success' : 'badge-danger'}>{a.status}</span>
                                        </div>
                                        <h3 className="font-semibold text-foreground">{a.nome}</h3>
                                        <div className="mt-2 space-y-1 text-sm text-muted">
                                            <p><span className="font-medium text-foreground/50">Cidade: </span>{a.cidade ?? '—'}</p>
                                            <p><span className="font-medium text-foreground/50">Capacidade: </span>{a.capacidade_tons ? `${a.capacidade_tons} tons` : '—'}</p>
                                            <p><span className="font-medium text-foreground/50">Tipo: </span>{a.tipo ?? '—'}</p>
                                            {a.custo_dia_frio != null && (
                                                <p><span className="font-medium text-foreground/50">Frio: </span>{formatCurrency(a.custo_dia_frio)}/dia · limite {a.limite_dias_frio ?? '—'}d · excedente {a.custo_dia_excedente != null ? formatCurrency(a.custo_dia_excedente) : '—'}/dia</p>
                                            )}
                                        </div>
                                    </div>
                                    {canOperate && (
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => { setEditItem(a as unknown as Record<string, unknown>); setShowModal(true) }} className="p-1.5 rounded hover:bg-brand-50 dark:hover:bg-brand-900/20 text-gray-400 hover:text-brand-600 transition" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                                            {isDono && <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-danger transition" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {armazens.length === 0 && <p className="col-span-3 text-muted text-center py-8">Nenhum armazém cadastrado</p>}
                    </div>
                )}



                {/* Clientes */}
                {tab === 'clientes' && (
                    <>
                        <table className="w-full text-left">
                            <thead><tr>
                                <ResizableHeader initialWidth={300}>NOME</ResizableHeader>
                                <ResizableHeader initialWidth={180}>CPF/CNPJ</ResizableHeader>
                                <ResizableHeader initialWidth={150}>TELEFONE</ResizableHeader>
                                <ResizableHeader initialWidth={150}>CIDADE</ResizableHeader>
                                <ResizableHeader initialWidth={150}>LIM. CRÉDITO</ResizableHeader>
                                <ResizableHeader initialWidth={100}>STATUS</ResizableHeader>
                                <th className="table-header">AÇÕES</th>
                            </tr></thead>
                            <tbody>
                                {clientes.map(c => (
                                    <tr key={c.id} className="hover:bg-brand-50/30 transition-colors">
                                        <td className="table-cell font-medium">{c.nome}</td>
                                        <td className="table-cell">{c.cpf_cnpj ?? '—'}</td>
                                        <td className="table-cell">{c.telefone ?? '—'}</td>
                                        <td className="table-cell">{c.cidade ?? '—'}</td>
                                        <td className="table-cell font-semibold text-success">{formatCurrency(c.limite_credito)}</td>
                                        <td className="table-cell"><span className={c.status === 'ativo' ? 'badge-success' : 'badge-danger'}>{c.status}</span></td>
                                        <td className="table-cell">
                                            <div className="flex gap-1">
                                                <button onClick={() => { setEditItem(c as unknown as Record<string, unknown>); setShowModal(true) }} className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition"><Pencil className="w-3.5 h-3.5" /></button>
                                                {isDono && <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-danger transition"><Trash2 className="w-3.5 h-3.5" /></button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {clientes.length === 0 && <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-8">Nenhum cliente cadastrado</td></tr>}
                            </tbody>
                        </table>
                    </>
                )}

                {/* Compradores */}
                {tab === 'compradores' && (
                    <SimpleTable data={compradores} onEdit={item => { setEditItem(item); setShowModal(true) }} onDelete={handleDelete} isDono={isDono} emptyMsg="Nenhum comprador cadastrado" />
                )}

                {/* Locais */}
                {tab === 'locais' && (
                    <SimpleTable data={locais} onEdit={item => { setEditItem(item); setShowModal(true) }} onDelete={handleDelete} isDono={isDono} emptyMsg="Nenhum local cadastrado" />
                )}

                {/* Motoristas */}
                {tab === 'motoristas' && (
                    <SimpleTable data={motoristas} onEdit={item => { setEditItem(item); setShowModal(true) }} onDelete={handleDelete} isDono={isDono} emptyMsg="Nenhum motorista cadastrado" />
                )}

                {/* Vendedores */}
                {tab === 'vendedores' && (
                    <SimpleTable data={vendedores} onEdit={item => { setEditItem(item); setShowModal(true) }} onDelete={handleDelete} isDono={isDono} emptyMsg="Nenhum vendedor cadastrado" />
                )}
            </div>

            {/* Preview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {variedades.slice(0, 1).map(v => (
                    <div key={v.id} className="card border border-brand-100">
                        <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-widest mb-1">VARIEDADE</p>
                        <h3 className="font-bold text-foreground">{v.nome}</h3>

                        <p className="text-xs text-gray-500 mt-1">Tipo: {v.tipo ?? '—'}</p>
                        <p className="text-xs text-gray-500">Cor: {v.cor ?? '—'}</p>
                        <p className="text-xs text-gray-500">Categoria: {v.categoria ?? '—'}</p>
                    </div>
                ))}
                {armazens.slice(0, 1).map(a => (
                    <div key={a.id} className="card border border-brand-100">
                        <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-widest mb-1">ARMAZÉM</p>
                        <h3 className="font-bold text-foreground">{a.nome}</h3>

                        <p className="text-xs text-gray-500 mt-1">Cidade: {a.cidade ?? '—'}</p>
                        <p className="text-xs text-gray-500">Capacidade: {a.capacidade_tons ? `${a.capacidade_tons} Tons` : '—'}</p>
                    </div>
                ))}
                {clientes.slice(0, 1).map(c => (
                    <div key={c.id} className="card border border-brand-100">
                        <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-widest mb-1">CLIENTE</p>
                        <h3 className="font-bold text-foreground">{c.nome}</h3>

                        <p className="text-xs text-gray-500 mt-1">Cidade: {c.cidade ?? '—'}</p>
                        <p className="text-xs text-success font-semibold">Limite: {formatCurrency(c.limite_credito)}</p>
                    </div>
                ))}
                <div className="card bg-brand-600 border-0 text-white flex flex-col items-center justify-center cursor-pointer hover:bg-brand-700 transition" onClick={() => { setEditItem(null); setShowModal(true) }}>
                    <Plus className="w-8 h-8 mb-2" />
                    <span className="font-semibold text-sm">Ver Todos os Registros</span>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <CadastroModal
                    tab={tab}
                    editItem={editItem}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); fetchAll() }}
                />
            )}
        </div>
    )
}

function CadastroModal({ tab, editItem, onClose, onSuccess }: {
    tab: Tab
    editItem: Record<string, unknown> | null
    onClose: () => void
    onSuccess: () => void
}) {
    const isEdit = !!editItem
    const [form, setForm] = useState<Record<string, string>>(
        editItem ? Object.fromEntries(Object.entries(editItem).map(([k, v]) => [k, String(v ?? '')])) : {}
    )
    const [saving, setSaving] = useState(false)

    const tableMap: Record<Tab, string> = { produtores: 'produtores', variedades: 'variedades', armazens: 'armazens', clientes: 'clientes', compradores: 'compradores', locais: 'locais', motoristas: 'motoristas', vendedores: 'vendedores' }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const table = tableMap[tab]
        const { id, created_at, ...payload } = form
        let error
        if (isEdit && editItem?.id) {
            const resp = await supabase.from(table).update(payload).eq('id', String(editItem.id))
            error = resp.error
        } else {
            const resp = await supabase.from(table).insert(payload)
            error = resp.error
        }
        setSaving(false)
        if (error) toast.error('Erro: ' + error.message)
        else { toast.success(isEdit ? 'Registro atualizado!' : 'Registro criado!'); onSuccess() }
    }

    const fields: Record<Tab, { key: string; label: string; type?: string; options?: string[] }[]> = {
        produtores: [
            { key: 'nome', label: 'Nome*', type: 'text' },
            { key: 'cpf_cnpj', label: 'CPF/CNPJ', type: 'text' },
            { key: 'telefone', label: 'Telefone', type: 'text' },
            { key: 'cidade', label: 'Cidade', type: 'text' },
            { key: 'estado', label: 'Estado', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
        ],
        variedades: [
            { key: 'nome', label: 'Nome*', type: 'text' },
            { key: 'tipo', label: 'Tipo', type: 'text' },
            { key: 'cor', label: 'Cor', type: 'text' },
            { key: 'categoria', label: 'Categoria', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
        ],
        armazens: [
            { key: 'nome', label: 'Nome*', type: 'text' },
            { key: 'cidade', label: 'Cidade', type: 'text' },
            { key: 'capacidade_tons', label: 'Capacidade (tons)', type: 'number' },
            { key: 'tipo', label: 'Tipo', type: 'text' },
            { key: 'custo_dia_frio', label: 'Custo/Dia Frio (R$)', type: 'number' },
            { key: 'limite_dias_frio', label: 'Limite Dias Frio', type: 'number' },
            { key: 'custo_dia_excedente', label: 'Custo Excedente/Dia (R$)', type: 'number' },
            { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
        ],
        clientes: [
            { key: 'nome', label: 'Nome*', type: 'text' },
            { key: 'cpf_cnpj', label: 'CPF/CNPJ', type: 'text' },
            { key: 'telefone', label: 'Telefone', type: 'text' },
            { key: 'cidade', label: 'Cidade', type: 'text' },
            { key: 'limite_credito', label: 'Limite de Crédito', type: 'number' },
            { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
        ],
        compradores: [
            { key: 'nome', label: 'Nome*', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
        ],
        locais: [
            { key: 'nome', label: 'Nome*', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
        ],
        motoristas: [
            { key: 'nome', label: 'Nome*', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
        ],
        vendedores: [
            { key: 'nome', label: 'Nome*', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
        ],
    }

    const tabLabel: Record<Tab, string> = { produtores: 'Produtor', variedades: 'Variedade', armazens: 'Armazém', clientes: 'Cliente', compradores: 'Comprador', locais: 'Local', motoristas: 'Motorista', vendedores: 'Vendedor' }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card bg-[var(--card)] w-full max-w-lg shadow-2xl border-brand-500/10">
                <div className="p-2">
                    <div className="flex items-center justify-between mb-6 px-4 pt-4">
                        <h2 className="text-xl font-black text-foreground tracking-tight">{isEdit ? 'Editar' : 'Novo'} {tabLabel[tab]}</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                    <form onSubmit={handleSave} className="space-y-5 px-4 pb-4">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                            {fields[tab].map(f => (
                                <div key={f.key} className={f.key === 'nome' ? 'col-span-2' : ''}>
                                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2 ml-1">{f.label}</label>
                                    {f.type === 'select' ? (
                                        <select value={form[f.key] ?? ''} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="input h-11">
                                            {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type={f.type ?? 'text'}
                                            value={form[f.key] ?? ''}
                                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            className="input h-11"
                                            required={f.label.endsWith('*')}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 justify-end pt-6 border-t border-border">
                            <button type="button" onClick={onClose} className="btn-secondary h-11 px-6">Cancelar</button>
                            <button type="submit" disabled={saving} className="btn-primary h-11 px-8">
                                {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Registro'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

    )
}

function SimpleTable({ data, onEdit, onDelete, isDono, emptyMsg }: { data: any[], onEdit: (item: any) => void, onDelete: (id: string) => void, isDono: boolean, emptyMsg: string }) {
    return (
        <table className="w-full text-left">
            <thead>
                <tr>
                    <ResizableHeader initialWidth={400}>NOME</ResizableHeader>
                    <ResizableHeader initialWidth={150}>STATUS</ResizableHeader>
                    <th className="table-header">AÇÕES</th>
                </tr>
            </thead>
            <tbody>
                {data.map(item => (
                    <tr key={item.id} className="hover:bg-brand-50/30 transition-colors">
                        <td className="table-cell font-medium">{item.nome}</td>
                        <td className="table-cell"><span className={item.status === 'ativo' ? 'badge-success' : 'badge-danger'}>{item.status}</span></td>
                        <td className="table-cell">
                            <div className="flex gap-1">
                                <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition"><Pencil className="w-3.5 h-3.5" /></button>
                                {isDono && <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-danger transition"><Trash2 className="w-3.5 h-3.5" /></button>}
                            </div>
                        </td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={3} className="table-cell text-center text-gray-400 py-8">{emptyMsg}</td></tr>}
            </tbody>
        </table>
    );
}
