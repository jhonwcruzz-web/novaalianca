import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Insumo, MovimentoInsumo, CategoriaInsumo, TipoMovimento } from '../lib/types'
import toast from 'react-hot-toast'
import { Plus, X, ArrowDownCircle, ArrowUpCircle, Trash2, AlertTriangle, Package } from 'lucide-react'

const CATEGORIAS: { value: CategoriaInsumo; label: string }[] = [
    { value: 'embalagem', label: 'Embalagem' },
    { value: 'paletizacao', label: 'Paletização' },
    { value: 'colheita', label: 'Colheita' },
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'descartavel', label: 'Descartável' },
    { value: 'outros', label: 'Outros' },
]

const CAT_COLORS: Record<CategoriaInsumo, string> = {
    embalagem:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    paletizacao: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    colheita:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    manutencao:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    descartavel: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    outros:      'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

export default function Insumos() {
    const { role } = useAuth()
    const canOperate = role === 'dono' || role === 'operador'

    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [loading, setLoading] = useState(true)
    const [filtCat, setFiltCat] = useState<string>('')
    const [filtBaixo, setFiltBaixo] = useState(false)

    const [showCadastro, setShowCadastro] = useState(false)
    const [editando, setEditando] = useState<Insumo | null>(null)
    const [movModal, setMovModal] = useState<{ insumo: Insumo; tipo: TipoMovimento } | null>(null)
    const [historicoModal, setHistoricoModal] = useState<Insumo | null>(null)

    async function fetchInsumos() {
        setLoading(true)
        const { data } = await supabase.from('insumos').select('*').order('categoria').order('nome')
        setInsumos((data ?? []) as Insumo[])
        setLoading(false)
    }

    useEffect(() => { fetchInsumos() }, [])

    const filtered = insumos.filter(i => {
        if (filtCat && i.categoria !== filtCat) return false
        if (filtBaixo && i.estoque_atual > i.estoque_minimo) return false
        return true
    })

    const totalItens = insumos.length
    const emAlerta = insumos.filter(i => i.estoque_atual <= i.estoque_minimo && i.estoque_minimo > 0).length

    async function excluirInsumo(id: string) {
        if (!confirm('Excluir este insumo? O histórico de movimentos também será excluído.')) return
        const { error } = await supabase.from('insumos').delete().eq('id', id)
        if (error) toast.error('Erro ao excluir')
        else { toast.success('Insumo excluído'); fetchInsumos() }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Insumos & Materiais</h1>
                    <p className="text-sm text-muted mt-0.5">Controle de estoque de embalagens, materiais de colheita e paletização.</p>
                </div>
                {canOperate && (
                    <button onClick={() => { setEditando(null); setShowCadastro(true) }} className="btn-gold text-sm py-2">
                        <Plus className="w-4 h-4" /> Cadastrar Material
                    </button>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total de Materiais</p>
                    <h3 className="text-2xl font-black text-foreground">{totalItens}</h3>
                </div>
                <div className="card">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Estoque Baixo</p>
                    <h3 className={`text-2xl font-black ${emAlerta > 0 ? 'text-warning' : 'text-foreground'}`}>{emAlerta}</h3>
                </div>
                {CATEGORIAS.slice(0, 2).map(c => {
                    const count = insumos.filter(i => i.categoria === c.value).length
                    return (
                        <div key={c.value} className="card">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">{c.label}</p>
                            <h3 className="text-2xl font-black text-foreground">{count}</h3>
                        </div>
                    )
                })}
            </div>

            {/* Filtros */}
            <div className="card py-3">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-muted uppercase tracking-widest">Filtros:</span>
                    <select value={filtCat} onChange={e => setFiltCat(e.target.value)} className="input w-44 text-sm">
                        <option value="">Todas as categorias</option>
                        {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <label className="flex items-center gap-2 cursor-pointer ml-2">
                        <input type="checkbox" checked={filtBaixo} onChange={e => setFiltBaixo(e.target.checked)} className="accent-brand-600 w-4 h-4" />
                        <span className="text-xs font-bold text-warning uppercase tracking-widest flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Somente estoque baixo
                        </span>
                    </label>
                    {(filtCat || filtBaixo) && (
                        <button onClick={() => { setFiltCat(''); setFiltBaixo(false) }} className="text-sm text-muted hover:text-danger flex items-center gap-1 ml-auto">
                            <X className="w-4 h-4" /> Limpar
                        </button>
                    )}
                </div>
            </div>

            {/* Tabela */}
            <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-6 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-16 text-center">
                            <Package className="w-12 h-12 text-muted mx-auto mb-3 opacity-30" />
                            <p className="text-muted font-semibold">Nenhum material cadastrado</p>
                            <p className="text-xs text-muted mt-1">Clique em "Cadastrar Material" para começar.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr>
                                    <th className="table-header rounded-l-lg">Material</th>
                                    <th className="table-header">Categoria</th>
                                    <th className="table-header text-center">Unidade</th>
                                    <th className="table-header text-right">Estoque Atual</th>
                                    <th className="table-header text-right">Mínimo</th>
                                    <th className="table-header text-center">Status</th>
                                    {canOperate && <th className="table-header rounded-r-lg text-center">Ações</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(insumo => {
                                    const baixo = insumo.estoque_minimo > 0 && insumo.estoque_atual <= insumo.estoque_minimo
                                    return (
                                        <tr key={insumo.id} className={`hover:bg-brand-50/30 transition-colors ${baixo ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                                            <td className="table-cell font-semibold text-foreground">
                                                <div className="flex items-center gap-2">
                                                    {baixo && <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />}
                                                    {insumo.nome}
                                                </div>
                                                {insumo.observacoes && <p className="text-[10px] text-muted mt-0.5">{insumo.observacoes}</p>}
                                            </td>
                                            <td className="table-cell">
                                                <span className={`badge ${CAT_COLORS[insumo.categoria]}`}>
                                                    {CATEGORIAS.find(c => c.value === insumo.categoria)?.label ?? insumo.categoria}
                                                </span>
                                            </td>
                                            <td className="table-cell text-center text-muted">{insumo.unidade}</td>
                                            <td className={`table-cell text-right font-black text-lg ${baixo ? 'text-warning' : 'text-foreground'}`}>
                                                {insumo.estoque_atual.toLocaleString('pt-BR')}
                                            </td>
                                            <td className="table-cell text-right text-muted">
                                                {insumo.estoque_minimo > 0 ? insumo.estoque_minimo.toLocaleString('pt-BR') : '—'}
                                            </td>
                                            <td className="table-cell text-center">
                                                <span className={`badge ${insumo.status === 'ativo' ? 'badge-success' : 'badge-danger'}`}>
                                                    {insumo.status}
                                                </span>
                                            </td>
                                            {canOperate && (
                                                <td className="table-cell">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => setMovModal({ insumo, tipo: 'entrada' })}
                                                            className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-muted hover:text-success transition"
                                                            title="Registrar Entrada"
                                                        >
                                                            <ArrowDownCircle className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setMovModal({ insumo, tipo: 'saida' })}
                                                            className="p-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-muted hover:text-warning transition"
                                                            title="Registrar Saída"
                                                        >
                                                            <ArrowUpCircle className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setHistoricoModal(insumo)}
                                                            className="p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 text-muted hover:text-brand-600 transition text-[10px] font-bold"
                                                            title="Ver histórico"
                                                        >
                                                            Hist.
                                                        </button>
                                                        <button
                                                            onClick={() => { setEditando(insumo); setShowCadastro(true) }}
                                                            className="p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 text-muted hover:text-brand-600 transition text-[10px] font-bold"
                                                        >
                                                            Edit.
                                                        </button>
                                                        <button
                                                            onClick={() => excluirInsumo(insumo.id)}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted hover:text-danger transition"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showCadastro && (
                <CadastroInsumoModal
                    insumo={editando}
                    onClose={() => { setShowCadastro(false); setEditando(null) }}
                    onSuccess={() => { setShowCadastro(false); setEditando(null); fetchInsumos() }}
                />
            )}
            {movModal && (
                <MovimentoModal
                    insumo={movModal.insumo}
                    tipoInicial={movModal.tipo}
                    onClose={() => setMovModal(null)}
                    onSuccess={() => { setMovModal(null); fetchInsumos() }}
                />
            )}
            {historicoModal && (
                <HistoricoModal
                    insumo={historicoModal}
                    onClose={() => setHistoricoModal(null)}
                />
            )}
        </div>
    )
}

// ── Modal: Cadastro / Edição de Insumo ────────────────────────────────────────
function CadastroInsumoModal({ insumo, onClose, onSuccess }: {
    insumo: Insumo | null
    onClose: () => void
    onSuccess: () => void
}) {
    const [nome, setNome] = useState(insumo?.nome ?? '')
    const [categoria, setCategoria] = useState<CategoriaInsumo>(insumo?.categoria ?? 'embalagem')
    const [unidade, setUnidade] = useState(insumo?.unidade ?? 'un')
    const [minimo, setMinimo] = useState(String(insumo?.estoque_minimo ?? 0))
    const [obs, setObs] = useState(insumo?.observacoes ?? '')
    const [saving, setSaving] = useState(false)

    async function save() {
        if (!nome.trim()) { toast.error('Informe o nome do material'); return }
        setSaving(true)
        const payload = { nome: nome.trim(), categoria, unidade, estoque_minimo: Number(minimo), observacoes: obs || null }
        const { error } = insumo
            ? await supabase.from('insumos').update(payload).eq('id', insumo.id)
            : await supabase.from('insumos').insert(payload)
        setSaving(false)
        if (error) toast.error('Erro: ' + error.message)
        else { toast.success(insumo ? 'Material atualizado!' : 'Material cadastrado!'); onSuccess() }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-md border border-border">
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="font-bold text-foreground">{insumo ? 'Editar Material' : 'Cadastrar Material'}</h2>
                    <button onClick={onClose} className="text-muted hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="form-label">Nome do Material *</label>
                        <input value={nome} onChange={e => setNome(e.target.value)} className="input w-full" placeholder="Ex: Caixa Plástica CAT1" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">Categoria</label>
                            <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaInsumo)} className="input w-full">
                                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Unidade</label>
                            <select value={unidade} onChange={e => setUnidade(e.target.value)} className="input w-full">
                                {['un', 'cx', 'kg', 'rolo', 'm', 'par', 'fardo'].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="form-label">Estoque Mínimo (alerta)</label>
                        <input type="number" min="0" value={minimo} onChange={e => setMinimo(e.target.value)} className="input w-full" />
                    </div>
                    <div>
                        <label className="form-label">Observações</label>
                        <input value={obs} onChange={e => setObs(e.target.value)} className="input w-full" placeholder="Opcional" />
                    </div>
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button onClick={save} disabled={saving} className="btn-gold">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
            </div>
        </div>
    )
}

// ── Modal: Registrar Movimento ────────────────────────────────────────────────
function MovimentoModal({ insumo, tipoInicial, onClose, onSuccess }: {
    insumo: Insumo
    tipoInicial: TipoMovimento
    onClose: () => void
    onSuccess: () => void
}) {
    const [tipo, setTipo] = useState<TipoMovimento>(tipoInicial)
    const [quantidade, setQuantidade] = useState('')
    const [referencia, setReferencia] = useState('')
    const [data, setData] = useState(new Date().toISOString().slice(0, 10))
    const [obs, setObs] = useState('')
    const [saving, setSaving] = useState(false)

    async function save() {
        const qtd = Number(quantidade)
        if (!qtd || qtd <= 0) { toast.error('Informe a quantidade'); return }
        if (tipo === 'saida' && qtd > insumo.estoque_atual) { toast.error(`Estoque insuficiente (atual: ${insumo.estoque_atual} ${insumo.unidade})`); return }
        setSaving(true)
        const payload = { insumo_id: insumo.id, tipo, quantidade: qtd, referencia: referencia || null, data, observacoes: obs || null }
        const { error } = await supabase.from('movimentos_insumos').insert(payload)
        setSaving(false)
        if (error) toast.error('Erro: ' + error.message)
        else { toast.success('Movimento registrado!'); onSuccess() }
    }

    const TIPO_LABELS: Record<TipoMovimento, string> = {
        entrada: 'Entrada',
        saida: 'Saída / Uso',
        descarte: 'Descarte',
        ajuste: 'Ajuste de Inventário',
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-md border border-border">
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-foreground">Registrar Movimento</h2>
                        <p className="text-xs text-muted mt-0.5">{insumo.nome} · estoque atual: <strong>{insumo.estoque_atual} {insumo.unidade}</strong></p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="form-label">Tipo de Movimento</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['entrada', 'saida', 'descarte', 'ajuste'] as TipoMovimento[]).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTipo(t)}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${tipo === t
                                        ? 'bg-[var(--accent)] text-[#1A0A2E] border-[var(--accent)]'
                                        : 'border-border text-muted hover:border-brand-400'
                                    }`}
                                >
                                    {TIPO_LABELS[t]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">Quantidade ({insumo.unidade})</label>
                            <input type="number" min="0.01" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} className="input w-full" placeholder="0" />
                        </div>
                        <div>
                            <label className="form-label">Data</label>
                            <input type="date" value={data} onChange={e => setData(e.target.value)} className="input w-full" />
                        </div>
                    </div>
                    <div>
                        <label className="form-label">Referência</label>
                        <input value={referencia} onChange={e => setReferencia(e.target.value)} className="input w-full" placeholder="Ex: Expedição, NF de compra, Colheita..." />
                    </div>
                    <div>
                        <label className="form-label">Observações</label>
                        <input value={obs} onChange={e => setObs(e.target.value)} className="input w-full" placeholder="Opcional" />
                    </div>
                    {tipo === 'ajuste' && (
                        <p className="text-xs text-warning flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Ajuste define o estoque atual para o valor informado.
                        </p>
                    )}
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button onClick={save} disabled={saving} className="btn-gold">{saving ? 'Salvando...' : 'Registrar'}</button>
                </div>
            </div>
        </div>
    )
}

// ── Modal: Histórico de Movimentos ────────────────────────────────────────────
function HistoricoModal({ insumo, onClose }: { insumo: Insumo; onClose: () => void }) {
    const [movimentos, setMovimentos] = useState<MovimentoInsumo[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase.from('movimentos_insumos')
            .select('*')
            .eq('insumo_id', insumo.id)
            .order('data', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(50)
            .then(({ data }) => { setMovimentos((data ?? []) as MovimentoInsumo[]); setLoading(false) })
    }, [insumo.id])

    const TIPO_STYLE: Record<TipoMovimento, string> = {
        entrada:  'badge-success',
        saida:    'badge-warning',
        descarte: 'badge-danger',
        ajuste:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 badge',
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-border">
                <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="font-bold text-foreground">Histórico de Movimentos</h2>
                        <p className="text-xs text-muted mt-0.5">{insumo.nome} · saldo atual: <strong>{insumo.estoque_atual} {insumo.unidade}</strong></p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                    {loading ? (
                        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div>
                    ) : movimentos.length === 0 ? (
                        <p className="text-center text-muted text-sm py-8">Nenhum movimento registrado ainda.</p>
                    ) : (
                        <div className="space-y-2">
                            {movimentos.map(m => (
                                <div key={m.id} className="flex items-center justify-between p-3 bg-[var(--background)] rounded-xl border border-border">
                                    <div className="flex items-center gap-3">
                                        <span className={TIPO_STYLE[m.tipo as TipoMovimento]}>{m.tipo}</span>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">
                                                {m.tipo === 'ajuste' ? `→ ${m.quantidade}` : m.tipo === 'saida' || m.tipo === 'descarte' ? `- ${m.quantidade}` : `+ ${m.quantidade}`}
                                                {' '}{insumo.unidade}
                                            </p>
                                            {m.referencia && <p className="text-[10px] text-muted">{m.referencia}</p>}
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted">{new Date(m.data).toLocaleDateString('pt-BR')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
