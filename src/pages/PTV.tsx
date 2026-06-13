import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { PTV as PTVType, StatusPTV } from '../lib/types'

type PedidoMinimal = { id: string; numero_pedido: string | null; data_saida: string; cliente?: { nome: string } | null }
import toast from 'react-hot-toast'
import { Plus, X, FileCheck2, Clock, CheckCircle, Send } from 'lucide-react'

const STATUS_CONFIG: Record<StatusPTV, { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }> = {
    pendente:   { label: 'Pendente',   badgeClass: 'badge-warning',                                                          icon: Clock         },
    solicitado: { label: 'Solicitado', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 badge', icon: Send          },
    emitido:    { label: 'Emitido',    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 badge', icon: FileCheck2 },
    concluido:  { label: 'Concluído',  badgeClass: 'badge-success',                                                          icon: CheckCircle   },
}

const STATUS_FLOW: Record<StatusPTV, StatusPTV | null> = {
    pendente:   'solicitado',
    solicitado: 'emitido',
    emitido:    'concluido',
    concluido:  null,
}

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function PTV() {
    const { role } = useAuth()
    const canOperate = role === 'dono' || role === 'operador'

    const [ptvs, setPtvs] = useState<PTVType[]>([])
    const [loading, setLoading] = useState(true)
    const [filtStatus, setFiltStatus] = useState<string>('')
    const [showModal, setShowModal] = useState(false)
    const [editando, setEditando] = useState<PTVType | null>(null)

    async function fetchPTVs() {
        setLoading(true)
        const { data } = await supabase
            .from('ptv')
            .select('*, pedido:pedidos(id, numero_pedido, data_saida, cliente:clientes(nome))')
            .order('created_at', { ascending: false })
        setPtvs((data ?? []) as PTVType[])
        setLoading(false)
    }

    useEffect(() => { fetchPTVs() }, [])

    const filtered = ptvs.filter(p => !filtStatus || p.status === filtStatus)

    const counts: Record<StatusPTV, number> = { pendente: 0, solicitado: 0, emitido: 0, concluido: 0 }
    ptvs.forEach(p => counts[p.status]++)

    async function avancarStatus(ptv: PTVType) {
        const proximo = STATUS_FLOW[ptv.status]
        if (!proximo) return
        const update: Partial<PTVType> = { status: proximo }
        if (proximo === 'emitido') update.data_emissao = new Date().toISOString().slice(0, 10)
        const { error } = await supabase.from('ptv').update(update).eq('id', ptv.id)
        if (error) toast.error('Erro: ' + error.message)
        else { toast.success(`Status → ${STATUS_CONFIG[proximo].label}`); fetchPTVs() }
    }

    async function excluir(id: string) {
        if (!confirm('Excluir este PTV?')) return
        const { error } = await supabase.from('ptv').delete().eq('id', id)
        if (error) toast.error('Erro ao excluir')
        else { toast.success('PTV excluído'); fetchPTVs() }
    }

    function formatCurrency(v: number | null) {
        if (v == null) return '—'
        return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">PTV / CFOP</h1>
                    <p className="text-sm text-muted mt-0.5">Controle de Permissão de Trânsito Vegetal e Código Fiscal.</p>
                </div>
                {canOperate && (
                    <button onClick={() => { setEditando(null); setShowModal(true) }} className="btn-gold text-sm py-2">
                        <Plus className="w-4 h-4" /> Solicitar PTV
                    </button>
                )}
            </div>

            {/* KPIs por status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(Object.entries(STATUS_CONFIG) as [StatusPTV, typeof STATUS_CONFIG[StatusPTV]][]).map(([status, cfg]) => {
                    const Icon = cfg.icon
                    return (
                        <button
                            key={status}
                            onClick={() => setFiltStatus(filtStatus === status ? '' : status)}
                            className={`card text-left transition-all hover:border-brand-400 ${filtStatus === status ? 'ring-2 ring-[var(--accent)] border-[var(--accent)]' : ''}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">{cfg.label}</p>
                                <Icon className="w-4 h-4 text-muted" />
                            </div>
                            <h3 className="text-3xl font-black text-foreground">{counts[status]}</h3>
                        </button>
                    )
                })}
            </div>

            {filtStatus && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Filtrando por: <strong className="text-foreground">{STATUS_CONFIG[filtStatus as StatusPTV].label}</strong></span>
                    <button onClick={() => setFiltStatus('')} className="text-xs text-danger hover:underline flex items-center gap-1"><X className="w-3 h-3" />Limpar</button>
                </div>
            )}

            {/* Tabela */}
            <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-6 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-16 text-center">
                            <FileCheck2 className="w-12 h-12 text-muted mx-auto mb-3 opacity-30" />
                            <p className="text-muted font-semibold">Nenhum PTV {filtStatus ? 'com este status' : 'cadastrado'}</p>
                            <p className="text-xs text-muted mt-1">Clique em "Solicitar PTV" para adicionar.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr>
                                    <th className="table-header rounded-l-lg">Pedido / Cliente</th>
                                    <th className="table-header">Nº PTV</th>
                                    <th className="table-header">CFOP</th>
                                    <th className="table-header">Destino</th>
                                    <th className="table-header text-right">Valor NF</th>
                                    <th className="table-header text-center">Status</th>
                                    <th className="table-header">Solicitado</th>
                                    <th className="table-header">Emitido</th>
                                    {canOperate && <th className="table-header rounded-r-lg text-center">Ações</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(ptv => {
                                    const cfg = STATUS_CONFIG[ptv.status]
                                    const Icon = cfg.icon
                                    const proximo = STATUS_FLOW[ptv.status]
                                    const pedido = ptv.pedido as PedidoMinimal | undefined
                                    return (
                                        <tr key={ptv.id} className="hover:bg-brand-50/30 transition-colors">
                                            <td className="table-cell">
                                                <p className="font-semibold text-foreground">{pedido?.numero_pedido ?? '—'}</p>
                                                {pedido?.cliente && <p className="text-xs text-muted">{pedido.cliente.nome}</p>}
                                            </td>
                                            <td className="table-cell font-mono text-sm text-foreground">
                                                {ptv.numero_ptv ?? <span className="text-muted italic text-xs">aguardando</span>}
                                            </td>
                                            <td className="table-cell text-muted">{ptv.cfop}</td>
                                            <td className="table-cell">
                                                {ptv.destino_uf ? (
                                                    <span>{ptv.destino_municipio ? `${ptv.destino_municipio} / ` : ''}<strong>{ptv.destino_uf}</strong></span>
                                                ) : '—'}
                                            </td>
                                            <td className="table-cell text-right font-semibold text-foreground">{formatCurrency(ptv.valor_total_nf)}</td>
                                            <td className="table-cell text-center">
                                                <span className={`${cfg.badgeClass} flex items-center gap-1 w-fit mx-auto`}>
                                                    <Icon className="w-3 h-3" /> {cfg.label}
                                                </span>
                                            </td>
                                            <td className="table-cell text-muted text-sm">
                                                {ptv.data_solicitacao ? new Date(ptv.data_solicitacao).toLocaleDateString('pt-BR') : '—'}
                                            </td>
                                            <td className="table-cell text-muted text-sm">
                                                {ptv.data_emissao ? new Date(ptv.data_emissao).toLocaleDateString('pt-BR') : '—'}
                                            </td>
                                            {canOperate && (
                                                <td className="table-cell">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {proximo && (
                                                            <button
                                                                onClick={() => avancarStatus(ptv)}
                                                                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--accent)]/20 text-[#C9A236] hover:bg-[var(--accent)]/40 transition"
                                                                title={`Avançar para ${STATUS_CONFIG[proximo].label}`}
                                                            >
                                                                → {STATUS_CONFIG[proximo].label}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => { setEditando(ptv); setShowModal(true) }}
                                                            className="text-[10px] font-bold px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground hover:border-brand-400 transition"
                                                        >
                                                            Edit.
                                                        </button>
                                                        <button
                                                            onClick={() => excluir(ptv.id)}
                                                            className="text-[10px] font-bold px-2 py-1 rounded-lg text-muted hover:text-danger transition"
                                                        >
                                                            <X className="w-3 h-3" />
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

            {showModal && (
                <PTVModal
                    ptv={editando}
                    onClose={() => { setShowModal(false); setEditando(null) }}
                    onSuccess={() => { setShowModal(false); setEditando(null); fetchPTVs() }}
                />
            )}
        </div>
    )
}

// ── Modal: Criar / Editar PTV ─────────────────────────────────────────────────
function PTVModal({ ptv, onClose, onSuccess }: {
    ptv: PTVType | null
    onClose: () => void
    onSuccess: () => void
}) {
    const [pedidoId, setPedidoId] = useState(ptv?.pedido_id ?? '')
    const [numeroPtv, setNumeroPtv] = useState(ptv?.numero_ptv ?? '')
    const [cfop, setCfop] = useState(ptv?.cfop ?? '6.102')
    const [uf, setUf] = useState(ptv?.destino_uf ?? '')
    const [municipio, setMunicipio] = useState(ptv?.destino_municipio ?? '')
    const [valorNf, setValorNf] = useState(String(ptv?.valor_total_nf ?? ''))
    const [dataSol, setDataSol] = useState(ptv?.data_solicitacao ?? new Date().toISOString().slice(0, 10))
    const [dataEmissao, setDataEmissao] = useState(ptv?.data_emissao ?? '')
    const [status, setStatus] = useState<StatusPTV>(ptv?.status ?? 'pendente')
    const [obs, setObs] = useState(ptv?.observacoes ?? '')
    const [pedidos, setPedidos] = useState<PedidoMinimal[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        supabase.from('pedidos')
            .select('id, numero_pedido, data_saida, cliente:clientes(nome)')
            .order('created_at', { ascending: false })
            .limit(100)
            .then(({ data }) => setPedidos((data ?? []) as unknown as PedidoMinimal[]))
    }, [])

    async function save() {
        setSaving(true)
        const payload = {
            pedido_id: pedidoId || null,
            numero_ptv: numeroPtv || null,
            cfop,
            destino_uf: uf || null,
            destino_municipio: municipio || null,
            valor_total_nf: valorNf ? Number(valorNf) : null,
            data_solicitacao: dataSol || null,
            data_emissao: dataEmissao || null,
            status,
            observacoes: obs || null,
        }
        const { error } = ptv
            ? await supabase.from('ptv').update(payload).eq('id', ptv.id)
            : await supabase.from('ptv').insert(payload)
        setSaving(false)
        if (error) toast.error('Erro: ' + error.message)
        else { toast.success(ptv ? 'PTV atualizado!' : 'PTV criado!'); onSuccess() }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg border border-border">
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="font-bold text-foreground">{ptv ? 'Editar PTV' : 'Solicitar PTV'}</h2>
                    <button onClick={onClose} className="text-muted hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Pedido */}
                    <div>
                        <label className="form-label">Pedido Vinculado</label>
                        <select value={pedidoId} onChange={e => setPedidoId(e.target.value)} className="input w-full">
                            <option value="">— Sem vínculo —</option>
                            {pedidos.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.numero_pedido ?? p.id.slice(0, 8)} · {p.cliente?.nome ?? ''}
                                    {' '}({new Date(p.data_saida).toLocaleDateString('pt-BR')})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* CFOP e Nº PTV */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">CFOP</label>
                            <input value={cfop} onChange={e => setCfop(e.target.value)} className="input w-full" placeholder="6.102" />
                        </div>
                        <div>
                            <label className="form-label">Nº PTV (após emissão)</label>
                            <input value={numeroPtv} onChange={e => setNumeroPtv(e.target.value)} className="input w-full" placeholder="Preenchido ao emitir" />
                        </div>
                    </div>

                    {/* Destino */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">UF Destino</label>
                            <select value={uf} onChange={e => setUf(e.target.value)} className="input w-full">
                                <option value="">Selecionar</option>
                                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Município Destino</label>
                            <input value={municipio} onChange={e => setMunicipio(e.target.value)} className="input w-full" placeholder="Ex: São Paulo" />
                        </div>
                    </div>

                    {/* Valor NF */}
                    <div>
                        <label className="form-label">Valor Total da NF (R$)</label>
                        <input type="number" step="0.01" min="0" value={valorNf} onChange={e => setValorNf(e.target.value)} className="input w-full" placeholder="0,00" />
                    </div>

                    {/* Datas */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">Data de Solicitação</label>
                            <input type="date" value={dataSol} onChange={e => setDataSol(e.target.value)} className="input w-full" />
                        </div>
                        <div>
                            <label className="form-label">Data de Emissão</label>
                            <input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} className="input w-full" />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="form-label">Status</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(STATUS_CONFIG) as [StatusPTV, typeof STATUS_CONFIG[StatusPTV]][]).map(([s, cfg]) => (
                                <button
                                    key={s}
                                    onClick={() => setStatus(s)}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${status === s
                                        ? 'bg-[var(--accent)] text-[#1A0A2E] border-[var(--accent)]'
                                        : 'border-border text-muted hover:border-brand-400'
                                    }`}
                                >
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Observações */}
                    <div>
                        <label className="form-label">Observações</label>
                        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className="input w-full resize-none" placeholder="Informações adicionais..." />
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
