import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { PTV as PTVType, StatusPTV } from '../lib/types'
import toast from 'react-hot-toast'
import { Plus, X, FileCheck2, Clock, CheckCircle, Send, AlertTriangle, FileText, TrendingDown, History } from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface CFO {
    id: string
    numero_cfo: string
    produtor_nome: string
    produto: string
    variedade: string | null
    quantidade_total: number
    unidade: string
    codigo_up: string | null
    municipio: string | null
    uf: string | null
    periodo_colheita: string | null
    data_emissao: string
    validade: string
    responsavel_tecnico: string | null
    status: 'ativo' | 'expirado' | 'esgotado'
    observacoes: string | null
    created_at: string
}

interface CFOComSaldo extends CFO {
    quantidade_utilizada: number
    saldo_disponivel: number
}

type PedidoMinimal = { id: string; numero_pedido: string | null; data_saida: string; cliente?: { nome: string } | null }

const STATUS_CONFIG: Record<StatusPTV, { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }> = {
    pendente:   { label: 'Pendente',   badgeClass: 'badge-warning', icon: Clock },
    solicitado: { label: 'Solicitado', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 badge', icon: Send },
    emitido:    { label: 'Emitido',    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 badge', icon: FileCheck2 },
    concluido:  { label: 'Concluído',  badgeClass: 'badge-success', icon: CheckCircle },
}

const STATUS_FLOW: Record<StatusPTV, StatusPTV | null> = {
    pendente: 'solicitado', solicitado: 'emitido', emitido: 'concluido', concluido: null,
}

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

// ── Página principal ──────────────────────────────────────────────────────────

export default function PTV() {
    const { role } = useAuth()
    const canOperate = role === 'dono' || role === 'operador'

    const [tab, setTab] = useState<'cfo' | 'ptv'>('cfo')

    // CFO
    const [cfos, setCfos] = useState<CFOComSaldo[]>([])
    const [loadingCfo, setLoadingCfo] = useState(true)
    const [showCfoModal, setShowCfoModal] = useState(false)
    const [editandoCfo, setEditandoCfo] = useState<CFOComSaldo | null>(null)
    const [historicoModal, setHistoricoModal] = useState<CFOComSaldo | null>(null)

    // PTV
    const [ptvs, setPtvs] = useState<PTVType[]>([])
    const [loadingPtv, setLoadingPtv] = useState(true)
    const [filtStatus, setFiltStatus] = useState<string>('')
    const [showPtvModal, setShowPtvModal] = useState(false)
    const [editandoPtv, setEditandoPtv] = useState<PTVType | null>(null)

    async function fetchCFOs() {
        setLoadingCfo(true)
        const { data } = await supabase.from('cfo_saldo').select('*').order('data_emissao', { ascending: false })
        setCfos((data ?? []) as CFOComSaldo[])
        setLoadingCfo(false)
    }

    async function fetchPTVs() {
        setLoadingPtv(true)
        const { data } = await supabase
            .from('ptv')
            .select('*, pedido:pedidos(id, numero_pedido, data_saida, cliente:clientes(nome)), cfo:cfo_id(numero_cfo, produto, variedade)')
            .order('created_at', { ascending: false })
        setPtvs((data ?? []) as PTVType[])
        setLoadingPtv(false)
    }

    useEffect(() => { fetchCFOs(); fetchPTVs() }, [])

    const hoje = new Date().toISOString().slice(0, 10)
    const cfosAtivos = cfos.filter(c => c.status === 'ativo' && c.validade >= hoje)
    const cfosVencendo = cfos.filter(c => {
        if (c.status !== 'ativo') return false
        const dias = Math.ceil((new Date(c.validade).getTime() - new Date().getTime()) / 86400000)
        return dias >= 0 && dias <= 7
    })
    const cfosComSaldoBaixo = cfos.filter(c => c.saldo_disponivel < c.quantidade_total * 0.2 && c.saldo_disponivel > 0)

    const counts: Record<StatusPTV, number> = { pendente: 0, solicitado: 0, emitido: 0, concluido: 0 }
    ptvs.forEach(p => counts[p.status]++)

    async function excluirCfo(id: string) {
        if (!confirm('Excluir este CFO? Os PTVs vinculados perderão o vínculo.')) return
        const { error } = await supabase.from('cfos').delete().eq('id', id)
        if (error) toast.error('Erro ao excluir')
        else { toast.success('CFO excluído'); fetchCFOs() }
    }

    async function avancarStatusPtv(ptv: PTVType) {
        const proximo = STATUS_FLOW[ptv.status]
        if (!proximo) return
        const update: Partial<PTVType> = { status: proximo }
        if (proximo === 'emitido') update.data_emissao = new Date().toISOString().slice(0, 10)
        const { error } = await supabase.from('ptv').update(update).eq('id', ptv.id)
        if (error) toast.error('Erro: ' + error.message)
        else { toast.success(`Status → ${STATUS_CONFIG[proximo].label}`); fetchPTVs(); fetchCFOs() }
    }

    async function excluirPtv(id: string) {
        if (!confirm('Excluir este PTV?')) return
        const { error } = await supabase.from('ptv').delete().eq('id', id)
        if (error) toast.error('Erro ao excluir')
        else { toast.success('PTV excluído'); fetchPTVs(); fetchCFOs() }
    }

    const filteredPtvs = ptvs.filter(p => !filtStatus || p.status === filtStatus)

    function formatQtd(val: number | null, unidade = 'ton') {
        if (val == null) return '—'
        return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} ${unidade}`
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">CFO / PTV</h1>
                    <p className="text-sm text-muted mt-0.5">Certificados Fitossanitários de Origem e Permissões de Trânsito Vegetal.</p>
                </div>
                {canOperate && (
                    <div className="flex gap-2">
                        {tab === 'cfo' ? (
                            <button onClick={() => { setEditandoCfo(null); setShowCfoModal(true) }} className="btn-gold text-sm py-2">
                                <Plus className="w-4 h-4" /> Registrar CFO
                            </button>
                        ) : (
                            <button onClick={() => { setEditandoPtv(null); setShowPtvModal(true) }} className="btn-gold text-sm py-2">
                                <Plus className="w-4 h-4" /> Solicitar PTV
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Alertas */}
            {(cfosVencendo.length > 0 || cfosComSaldoBaixo.length > 0) && (
                <div className="space-y-2">
                    {cfosVencendo.length > 0 && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span><strong>{cfosVencendo.length} CFO(s)</strong> vencem em até 7 dias: {cfosVencendo.map(c => `${c.numero_cfo} (${c.produto})`).join(', ')}</span>
                        </div>
                    )}
                    {cfosComSaldoBaixo.length > 0 && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 text-orange-800 dark:text-orange-300 text-sm">
                            <TrendingDown className="w-4 h-4 flex-shrink-0" />
                            <span><strong>{cfosComSaldoBaixo.length} CFO(s)</strong> com menos de 20% de saldo disponível.</span>
                        </div>
                    )}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">CFOs Ativos</p>
                    <h3 className="text-2xl font-black text-foreground">{cfosAtivos.length}</h3>
                    <p className="text-xs text-muted mt-1">de {cfos.length} total</p>
                </div>
                {(['pendente', 'solicitado', 'emitido'] as StatusPTV[]).map(s => {
                    const cfg = STATUS_CONFIG[s]
                    const Icon = cfg.icon
                    return (
                        <button key={s} onClick={() => { setTab('ptv'); setFiltStatus(filtStatus === s ? '' : s) }}
                            className={`card text-left transition-all hover:border-brand-400 ${filtStatus === s && tab === 'ptv' ? 'ring-2 ring-[var(--accent)]' : ''}`}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">PTV {cfg.label}</p>
                                <Icon className="w-4 h-4 text-muted" />
                            </div>
                            <h3 className="text-2xl font-black text-foreground">{counts[s]}</h3>
                        </button>
                    )
                })}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                <button onClick={() => setTab('cfo')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${tab === 'cfo' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-muted hover:text-foreground'}`}>
                    <FileText className="w-4 h-4" /> CFOs Recebidos
                </button>
                <button onClick={() => setTab('ptv')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${tab === 'ptv' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-muted hover:text-foreground'}`}>
                    <FileCheck2 className="w-4 h-4" /> PTVs Solicitados
                    {counts.pendente + counts.solicitado > 0 && (
                        <span className="ml-1 badge badge-warning">{counts.pendente + counts.solicitado}</span>
                    )}
                </button>
            </div>

            {/* ── Tab CFO ── */}
            {tab === 'cfo' && (
                <div className="card overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        {loadingCfo ? (
                            <div className="p-6 space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div>
                        ) : cfos.length === 0 ? (
                            <div className="p-16 text-center">
                                <FileText className="w-12 h-12 text-muted mx-auto mb-3 opacity-30" />
                                <p className="text-muted font-semibold">Nenhum CFO registrado</p>
                                <p className="text-xs text-muted mt-1">Registre os CFOs recebidos dos produtores.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr>
                                        <th className="table-header rounded-l-lg">Nº CFO</th>
                                        <th className="table-header">Produtor</th>
                                        <th className="table-header">Produto</th>
                                        <th className="table-header text-right">Qtd. Total</th>
                                        <th className="table-header text-right">Utilizado</th>
                                        <th className="table-header text-right">Saldo</th>
                                        <th className="table-header text-center">Validade</th>
                                        <th className="table-header text-center">Status</th>
                                        {canOperate && <th className="table-header rounded-r-lg text-center">Ações</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {cfos.map(cfo => {
                                        const pct = cfo.quantidade_total > 0 ? (cfo.saldo_disponivel / cfo.quantidade_total) * 100 : 0
                                        const diasVenc = Math.ceil((new Date(cfo.validade).getTime() - new Date().getTime()) / 86400000)
                                        const vencendo = diasVenc >= 0 && diasVenc <= 7
                                        const vencido = diasVenc < 0
                                        return (
                                            <tr key={cfo.id} className={`hover:bg-brand-50/30 transition-colors ${vencido ? 'opacity-60' : ''}`}>
                                                <td className="table-cell font-mono font-semibold text-foreground">{cfo.numero_cfo}</td>
                                                <td className="table-cell">
                                                    <p className="font-medium text-foreground">{cfo.produtor_nome}</p>
                                                    <p className="text-xs text-muted">{cfo.municipio}{cfo.uf ? ` / ${cfo.uf}` : ''}</p>
                                                </td>
                                                <td className="table-cell">
                                                    <p className="font-medium text-foreground">{cfo.produto}</p>
                                                    {cfo.variedade && <p className="text-xs text-muted">{cfo.variedade}</p>}
                                                </td>
                                                <td className="table-cell text-right text-muted">{formatQtd(cfo.quantidade_total, cfo.unidade)}</td>
                                                <td className="table-cell text-right text-warning">{formatQtd(cfo.quantidade_utilizada, cfo.unidade)}</td>
                                                <td className="table-cell text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={`font-black text-sm ${pct < 20 ? 'text-danger' : pct < 50 ? 'text-warning' : 'text-success'}`}>
                                                            {formatQtd(cfo.saldo_disponivel, cfo.unidade)}
                                                        </span>
                                                        <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all ${pct < 20 ? 'bg-danger' : pct < 50 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="table-cell text-center">
                                                    <span className={`text-xs font-semibold ${vencido ? 'text-danger' : vencendo ? 'text-warning' : 'text-muted'}`}>
                                                        {vencido ? '⚠ Vencido' : vencendo ? `⚠ ${diasVenc}d` : new Date(cfo.validade).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </td>
                                                <td className="table-cell text-center">
                                                    <span className={`badge ${cfo.status === 'ativo' && !vencido ? 'badge-success' : cfo.status === 'esgotado' ? 'badge-danger' : 'bg-zinc-100 text-zinc-500 badge'}`}>
                                                        {vencido ? 'vencido' : cfo.status}
                                                    </span>
                                                </td>
                                                {canOperate && (
                                                    <td className="table-cell">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => setHistoricoModal(cfo)}
                                                                className="p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 text-muted hover:text-brand-600 transition"
                                                                title="Ver histórico de uso">
                                                                <History className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={() => { setEditandoCfo(cfo); setShowCfoModal(true) }}
                                                                className="text-[10px] font-bold px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground hover:border-brand-400 transition">
                                                                Edit.
                                                            </button>
                                                            <button onClick={() => excluirCfo(cfo.id)}
                                                                className="p-1.5 rounded-lg text-muted hover:text-danger transition">
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
            )}

            {/* ── Tab PTV ── */}
            {tab === 'ptv' && (
                <>
                    {filtStatus && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">Filtrando: <strong>{STATUS_CONFIG[filtStatus as StatusPTV].label}</strong></span>
                            <button onClick={() => setFiltStatus('')} className="text-xs text-danger hover:underline flex items-center gap-1"><X className="w-3 h-3" />Limpar</button>
                        </div>
                    )}
                    <div className="card overflow-hidden p-0">
                        <div className="overflow-x-auto">
                            {loadingPtv ? (
                                <div className="p-6 space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div>
                            ) : filteredPtvs.length === 0 ? (
                                <div className="p-16 text-center">
                                    <FileCheck2 className="w-12 h-12 text-muted mx-auto mb-3 opacity-30" />
                                    <p className="text-muted font-semibold">Nenhum PTV {filtStatus ? 'com este status' : 'cadastrado'}</p>
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr>
                                            <th className="table-header rounded-l-lg">Pedido / Cliente</th>
                                            <th className="table-header">CFO Vinculado</th>
                                            <th className="table-header">Nº PTV</th>
                                            <th className="table-header">CFOP</th>
                                            <th className="table-header">Destino</th>
                                            <th className="table-header text-right">Qtd. Utilizada</th>
                                            <th className="table-header text-center">Status</th>
                                            <th className="table-header">Solicitado</th>
                                            <th className="table-header">Emitido</th>
                                            {canOperate && <th className="table-header rounded-r-lg text-center">Ações</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPtvs.map(ptv => {
                                            const cfg = STATUS_CONFIG[ptv.status]
                                            const Icon = cfg.icon
                                            const proximo = STATUS_FLOW[ptv.status]
                                            const pedido = ptv.pedido as PedidoMinimal | undefined
                                            const cfo = (ptv as any).cfo as { numero_cfo: string; produto: string; variedade?: string } | null
                                            return (
                                                <tr key={ptv.id} className="hover:bg-brand-50/30 transition-colors">
                                                    <td className="table-cell">
                                                        <p className="font-semibold text-foreground">{pedido?.numero_pedido ?? '—'}</p>
                                                        {pedido?.cliente && <p className="text-xs text-muted">{(pedido.cliente as { nome: string }).nome}</p>}
                                                    </td>
                                                    <td className="table-cell">
                                                        {cfo ? (
                                                            <>
                                                                <p className="font-mono text-xs font-semibold text-foreground">{cfo.numero_cfo}</p>
                                                                <p className="text-xs text-muted">{cfo.produto}{cfo.variedade ? ` · ${cfo.variedade}` : ''}</p>
                                                            </>
                                                        ) : <span className="text-muted text-xs italic">sem CFO</span>}
                                                    </td>
                                                    <td className="table-cell font-mono text-sm text-foreground">
                                                        {ptv.numero_ptv ?? <span className="text-muted italic text-xs">aguardando</span>}
                                                    </td>
                                                    <td className="table-cell text-muted">{ptv.cfop}</td>
                                                    <td className="table-cell">
                                                        {ptv.destino_uf ? `${ptv.destino_municipio ? ptv.destino_municipio + ' / ' : ''}${ptv.destino_uf}` : '—'}
                                                    </td>
                                                    <td className="table-cell text-right font-semibold text-foreground">
                                                        {(ptv as any).quantidade_utilizada != null
                                                            ? `${Number((ptv as any).quantidade_utilizada).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ton`
                                                            : '—'}
                                                    </td>
                                                    <td className="table-cell text-center">
                                                        <span className={`${cfg.badgeClass} flex items-center gap-1 w-fit mx-auto`}>
                                                            <Icon className="w-3 h-3" /> {cfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="table-cell text-muted text-sm">{ptv.data_solicitacao ? new Date(ptv.data_solicitacao).toLocaleDateString('pt-BR') : '—'}</td>
                                                    <td className="table-cell text-muted text-sm">{ptv.data_emissao ? new Date(ptv.data_emissao).toLocaleDateString('pt-BR') : '—'}</td>
                                                    {canOperate && (
                                                        <td className="table-cell">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {proximo && (
                                                                    <button onClick={() => avancarStatusPtv(ptv)}
                                                                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--accent)]/20 text-[#C9A236] hover:bg-[var(--accent)]/40 transition"
                                                                        title={`→ ${STATUS_CONFIG[proximo].label}`}>
                                                                        → {STATUS_CONFIG[proximo].label}
                                                                    </button>
                                                                )}
                                                                <button onClick={() => { setEditandoPtv(ptv); setShowPtvModal(true) }}
                                                                    className="text-[10px] font-bold px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground transition">
                                                                    Edit.
                                                                </button>
                                                                <button onClick={() => excluirPtv(ptv.id)} className="text-muted hover:text-danger transition p-1">
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
                </>
            )}

            {showCfoModal && (
                <CFOModal
                    cfo={editandoCfo}
                    onClose={() => { setShowCfoModal(false); setEditandoCfo(null) }}
                    onSuccess={() => { setShowCfoModal(false); setEditandoCfo(null); fetchCFOs() }}
                />
            )}
            {showPtvModal && (
                <PTVModal
                    ptv={editandoPtv}
                    cfos={cfos}
                    onClose={() => { setShowPtvModal(false); setEditandoPtv(null) }}
                    onSuccess={() => { setShowPtvModal(false); setEditandoPtv(null); fetchPTVs(); fetchCFOs() }}
                />
            )}
            {historicoModal && (
                <HistoricoCFOModal
                    cfo={historicoModal}
                    onClose={() => setHistoricoModal(null)}
                    onSolicitarPtv={() => { setHistoricoModal(null); setEditandoPtv(null); setShowPtvModal(true) }}
                />
            )}
        </div>
    )
}

// ── Modal: Histórico de uso do CFO ───────────────────────────────────────────
interface PTVHistorico {
    id: string
    numero_ptv: string | null
    quantidade_utilizada: number | null
    status: StatusPTV
    cfop: string
    destino_uf: string | null
    destino_municipio: string | null
    data_solicitacao: string | null
    data_emissao: string | null
    pedido: { numero_pedido: string | null; cliente: { nome: string } | null } | null
}

function HistoricoCFOModal({ cfo, onClose, onSolicitarPtv }: {
    cfo: CFOComSaldo
    onClose: () => void
    onSolicitarPtv: () => void
}) {
    const [ptvs, setPtvs] = useState<PTVHistorico[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase
            .from('ptv')
            .select('id, numero_ptv, quantidade_utilizada, status, cfop, destino_uf, destino_municipio, data_solicitacao, data_emissao, pedido:pedidos(numero_pedido, cliente:clientes(nome))')
            .eq('cfo_id', cfo.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => { setPtvs((data ?? []) as unknown as PTVHistorico[]); setLoading(false) })
    }, [cfo.id])

    const pct = cfo.quantidade_total > 0 ? (cfo.saldo_disponivel / cfo.quantidade_total) * 100 : 0
    const diasVenc = Math.ceil((new Date(cfo.validade).getTime() - new Date().getTime()) / 86400000)
    const vencido = diasVenc < 0
    const vencendo = !vencido && diasVenc <= 7

    function fmtQtd(v: number | null) {
        if (v == null) return '—'
        return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ${cfo.unidade}`
    }

    const STATUS_STYLE: Record<StatusPTV, string> = {
        pendente:   'badge-warning',
        solicitado: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 badge',
        emitido:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 badge',
        concluido:  'badge-success',
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col border border-border">

                {/* Header */}
                <div className="p-5 border-b border-border flex items-start justify-between flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-lg text-foreground">{cfo.numero_cfo}</span>
                            <span className={`badge ${vencido ? 'badge-danger' : vencendo ? 'badge-warning' : 'badge-success'}`}>
                                {vencido ? 'Vencido' : vencendo ? `Vence em ${diasVenc}d` : `Válido até ${new Date(cfo.validade).toLocaleDateString('pt-BR')}`}
                            </span>
                        </div>
                        <p className="text-sm text-foreground font-semibold">{cfo.produtor_nome}</p>
                        <p className="text-xs text-muted">{cfo.produto}{cfo.variedade ? ` · ${cfo.variedade}` : ''} · {cfo.municipio}/{cfo.uf}</p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-foreground mt-1"><X className="w-5 h-5" /></button>
                </div>

                {/* Saldo visual */}
                <div className="px-5 py-4 border-b border-border bg-[var(--background)] flex-shrink-0">
                    <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total CFO</p>
                            <p className="text-xl font-black text-foreground">{fmtQtd(cfo.quantidade_total)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Utilizado em PTVs</p>
                            <p className="text-xl font-black text-warning">{fmtQtd(cfo.quantidade_utilizada)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Saldo Disponível</p>
                            <p className={`text-xl font-black ${pct < 20 ? 'text-danger' : pct < 50 ? 'text-warning' : 'text-success'}`}>
                                {fmtQtd(cfo.saldo_disponivel)}
                            </p>
                        </div>
                    </div>
                    {/* Barra de progresso detalhada */}
                    <div className="relative h-4 rounded-full bg-border overflow-hidden">
                        <div
                            className={`absolute left-0 top-0 h-full rounded-full transition-all ${pct < 20 ? 'bg-danger' : pct < 50 ? 'bg-warning' : 'bg-success'}`}
                            style={{ width: `${Math.max(0, 100 - pct)}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-black text-foreground/70 mix-blend-normal">
                                {(100 - pct).toFixed(1)}% utilizado
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted mt-1">
                        <span>0</span>
                        <span>{fmtQtd(cfo.quantidade_total)}</span>
                    </div>
                </div>

                {/* Lista de PTVs */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-black text-muted uppercase tracking-widest">
                            PTVs que consumiram este CFO ({ptvs.length})
                        </h3>
                        {!vencido && cfo.saldo_disponivel > 0 && (
                            <button onClick={onSolicitarPtv} className="btn-gold text-xs py-1.5">
                                <Plus className="w-3.5 h-3.5" /> Solicitar PTV
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}</div>
                    ) : ptvs.length === 0 ? (
                        <div className="text-center py-10">
                            <FileCheck2 className="w-10 h-10 text-muted opacity-20 mx-auto mb-2" />
                            <p className="text-sm text-muted">Nenhum PTV vinculado a este CFO ainda.</p>
                            {!vencido && cfo.saldo_disponivel > 0 && (
                                <button onClick={onSolicitarPtv} className="mt-3 btn-gold text-xs py-1.5">
                                    <Plus className="w-3.5 h-3.5" /> Solicitar primeiro PTV
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {ptvs.map((p, idx) => {
                                const qtdPct = cfo.quantidade_total > 0 && p.quantidade_utilizada
                                    ? (p.quantidade_utilizada / cfo.quantidade_total) * 100
                                    : 0
                                return (
                                    <div key={p.id} className="p-3 rounded-xl border border-border bg-[var(--background)] flex items-center gap-3">
                                        {/* Número sequencial */}
                                        <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-black flex items-center justify-center flex-shrink-0">
                                            {idx + 1}
                                        </div>

                                        {/* Info principal */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-xs font-semibold text-foreground">
                                                    {p.numero_ptv ?? <span className="italic text-muted">PTV aguardando nº</span>}
                                                </span>
                                                <span className={STATUS_STYLE[p.status]}>{STATUS_CONFIG[p.status].label}</span>
                                                {p.pedido?.numero_pedido && (
                                                    <span className="text-[10px] text-muted bg-border/50 px-1.5 py-0.5 rounded">
                                                        Pedido {p.pedido.numero_pedido}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                                                {p.pedido?.cliente && <span>{(p.pedido.cliente as { nome: string }).nome}</span>}
                                                {(p.destino_municipio || p.destino_uf) && (
                                                    <span>→ {p.destino_municipio ? `${p.destino_municipio}/` : ''}{p.destino_uf}</span>
                                                )}
                                                {p.data_solicitacao && <span>Sol: {new Date(p.data_solicitacao).toLocaleDateString('pt-BR')}</span>}
                                                {p.data_emissao && <span>Emit: {new Date(p.data_emissao).toLocaleDateString('pt-BR')}</span>}
                                            </div>
                                        </div>

                                        {/* Quantidade consumida */}
                                        <div className="text-right flex-shrink-0">
                                            <p className={`font-black text-sm ${p.quantidade_utilizada ? 'text-warning' : 'text-muted'}`}>
                                                {p.quantidade_utilizada != null ? `- ${fmtQtd(p.quantidade_utilizada)}` : '—'}
                                            </p>
                                            {qtdPct > 0 && (
                                                <p className="text-[10px] text-muted">{qtdPct.toFixed(1)}% do CFO</p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Linha de total */}
                            <div className="p-3 rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--accent)]/5 flex items-center justify-between mt-2">
                                <span className="text-xs font-black text-muted uppercase tracking-widest">Total consumido em {ptvs.length} PTV(s)</span>
                                <span className="font-black text-warning">{fmtQtd(cfo.quantidade_utilizada)}</span>
                            </div>
                            <div className="p-3 rounded-xl border-2 border-success/40 bg-success/5 flex items-center justify-between">
                                <span className="text-xs font-black text-muted uppercase tracking-widest">Saldo que deveria estar disponível</span>
                                <span className={`font-black ${pct < 20 ? 'text-danger' : 'text-success'}`}>{fmtQtd(cfo.saldo_disponivel)}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border flex justify-end flex-shrink-0">
                    <button onClick={onClose} className="btn-secondary">Fechar</button>
                </div>
            </div>
        </div>
    )
}

// ── Modal: Registrar CFO ──────────────────────────────────────────────────────
function CFOModal({ cfo, onClose, onSuccess }: {
    cfo: CFOComSaldo | null
    onClose: () => void
    onSuccess: () => void
}) {
    const [numeroCfo, setNumeroCfo] = useState(cfo?.numero_cfo ?? '')
    const [produtor, setProdutor] = useState(cfo?.produtor_nome ?? '')
    const [produto, setProduto] = useState(cfo?.produto ?? '')
    const [variedade, setVariedade] = useState(cfo?.variedade ?? '')
    const [quantidade, setQuantidade] = useState(String(cfo?.quantidade_total ?? ''))
    const [unidade, setUnidade] = useState(cfo?.unidade ?? 'Toneladas')
    const [municipio, setMunicipio] = useState(cfo?.municipio ?? '')
    const [uf, setUf] = useState(cfo?.uf ?? 'PE')
    const [periodoColheita, setPeriodoColheita] = useState(cfo?.periodo_colheita ?? '')
    const [dataEmissao, setDataEmissao] = useState(cfo?.data_emissao ?? new Date().toISOString().slice(0, 10))
    const [responsavel, setResponsavel] = useState(cfo?.responsavel_tecnico ?? '')
    const [obs, setObs] = useState(cfo?.observacoes ?? '')
    const [saving, setSaving] = useState(false)

    // Validade calculada (30 dias)
    const validade = dataEmissao
        ? new Date(new Date(dataEmissao).getTime() + 30 * 86400000).toISOString().slice(0, 10)
        : ''

    async function save() {
        if (!numeroCfo.trim()) { toast.error('Informe o número do CFO'); return }
        if (!produtor.trim()) { toast.error('Informe o nome do produtor'); return }
        if (!produto.trim()) { toast.error('Informe o produto'); return }
        if (!quantidade || Number(quantidade) <= 0) { toast.error('Informe a quantidade'); return }
        setSaving(true)
        const payload = {
            numero_cfo: numeroCfo.trim(),
            produtor_nome: produtor.trim(),
            produto: produto.trim(),
            variedade: variedade || null,
            quantidade_total: Number(quantidade),
            unidade,
            municipio: municipio || null,
            uf: uf || null,
            periodo_colheita: periodoColheita || null,
            data_emissao: dataEmissao,
            responsavel_tecnico: responsavel || null,
            observacoes: obs || null,
        }
        const { error } = cfo
            ? await supabase.from('cfos').update(payload).eq('id', cfo.id)
            : await supabase.from('cfos').insert(payload)
        setSaving(false)
        if (error) toast.error('Erro: ' + error.message)
        else { toast.success(cfo ? 'CFO atualizado!' : 'CFO registrado!'); onSuccess() }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-xl border border-border">
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-foreground">{cfo ? 'Editar CFO' : 'Registrar CFO'}</h2>
                        <p className="text-xs text-muted mt-0.5">Certificado Fitossanitário de Origem recebido do produtor</p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="form-label">Nº do CFO *</label>
                            <input value={numeroCfo} onChange={e => setNumeroCfo(e.target.value)} className="input w-full font-mono" placeholder="Ex: 2626006537" />
                        </div>
                        <div className="col-span-2">
                            <label className="form-label">Produtor / Nome Empresarial *</label>
                            <input value={produtor} onChange={e => setProdutor(e.target.value)} className="input w-full" placeholder="Nome do produtor" />
                        </div>
                        <div>
                            <label className="form-label">Produto *</label>
                            <input value={produto} onChange={e => setProduto(e.target.value)} className="input w-full" placeholder="Ex: UVA VITÓRIA" />
                        </div>
                        <div>
                            <label className="form-label">Variedade</label>
                            <input value={variedade} onChange={e => setVariedade(e.target.value)} className="input w-full" placeholder="Ex: vitis spp." />
                        </div>
                        <div>
                            <label className="form-label">Quantidade Total *</label>
                            <input type="number" step="0.001" min="0.001" value={quantidade} onChange={e => setQuantidade(e.target.value)} className="input w-full" placeholder="5.71" />
                        </div>
                        <div>
                            <label className="form-label">Unidade</label>
                            <select value={unidade} onChange={e => setUnidade(e.target.value)} className="input w-full">
                                {['Toneladas', 'Kg', 'Caixas'].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Município</label>
                            <input value={municipio} onChange={e => setMunicipio(e.target.value)} className="input w-full" placeholder="Ex: Petrolina" />
                        </div>
                        <div>
                            <label className="form-label">UF</label>
                            <select value={uf} onChange={e => setUf(e.target.value)} className="input w-full">
                                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Data de Emissão *</label>
                            <input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} className="input w-full" />
                        </div>
                        <div>
                            <label className="form-label">Validade (automática)</label>
                            <input type="date" value={validade} readOnly className="input w-full opacity-60 cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="form-label">Período da Colheita</label>
                            <input type="date" value={periodoColheita} onChange={e => setPeriodoColheita(e.target.value)} className="input w-full" />
                        </div>
                        <div>
                            <label className="form-label">Responsável Técnico</label>
                            <input value={responsavel} onChange={e => setResponsavel(e.target.value)} className="input w-full" placeholder="Nome do RT" />
                        </div>
                        <div className="col-span-2">
                            <label className="form-label">Observações</label>
                            <input value={obs} onChange={e => setObs(e.target.value)} className="input w-full" placeholder="Opcional" />
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button onClick={save} disabled={saving} className="btn-gold">{saving ? 'Salvando...' : 'Salvar CFO'}</button>
                </div>
            </div>
        </div>
    )
}

// ── Modal: Solicitar PTV ──────────────────────────────────────────────────────
function PTVModal({ ptv, cfos, onClose, onSuccess }: {
    ptv: PTVType | null
    cfos: CFOComSaldo[]
    onClose: () => void
    onSuccess: () => void
}) {
    const [cfoId, setCfoId] = useState((ptv as any)?.cfo_id ?? '')
    const [quantUtilizada, setQuantUtilizada] = useState(String((ptv as any)?.quantidade_utilizada ?? ''))
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
        supabase.from('pedidos').select('id, numero_pedido, data_saida, cliente:clientes(nome)')
            .order('created_at', { ascending: false }).limit(100)
            .then(({ data }) => setPedidos((data ?? []) as unknown as PedidoMinimal[]))
    }, [])

    const cfoSelecionado = cfos.find(c => c.id === cfoId)
    const saldoDisponivel = cfoSelecionado
        ? cfoSelecionado.saldo_disponivel + (ptv ? (Number((ptv as any).quantidade_utilizada) || 0) : 0)
        : null
    const quantNum = Number(quantUtilizada) || 0
    const saldoInsuficiente = saldoDisponivel != null && quantNum > 0 && quantNum > saldoDisponivel

    async function save() {
        if (saldoInsuficiente) { toast.error(`Saldo insuficiente no CFO (disponível: ${saldoDisponivel?.toFixed(3)} ${cfoSelecionado?.unidade})`); return }
        setSaving(true)
        const payload = {
            cfo_id: cfoId || null,
            quantidade_utilizada: quantUtilizada ? Number(quantUtilizada) : null,
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
                <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto custom-scrollbar">
                    {/* CFO vinculado + saldo */}
                    <div>
                        <label className="form-label">CFO de Origem *</label>
                        <select value={cfoId} onChange={e => setCfoId(e.target.value)} className="input w-full">
                            <option value="">— Selecionar CFO —</option>
                            {cfos.filter(c => c.saldo_disponivel > 0 || c.id === (ptv as any)?.cfo_id).map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.numero_cfo} · {c.produto} · saldo: {c.saldo_disponivel.toFixed(3)} {c.unidade}
                                </option>
                            ))}
                        </select>
                        {cfoSelecionado && (
                            <div className={`mt-2 p-3 rounded-xl text-sm flex items-center justify-between ${saldoInsuficiente ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'}`}>
                                <span className="text-muted">Saldo disponível:</span>
                                <span className={`font-black ${saldoInsuficiente ? 'text-danger' : 'text-success'}`}>
                                    {saldoDisponivel?.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} {cfoSelecionado.unidade}
                                </span>
                            </div>
                        )}
                        {saldoInsuficiente && (
                            <p className="mt-1 text-xs text-danger flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> Quantidade solicitada excede o saldo do CFO.
                            </p>
                        )}
                    </div>

                    {/* Quantidade utilizada */}
                    <div>
                        <label className="form-label">Quantidade a Utilizar ({cfoSelecionado?.unidade ?? 'Toneladas'})</label>
                        <input type="number" step="0.001" min="0.001" value={quantUtilizada} onChange={e => setQuantUtilizada(e.target.value)}
                            className={`input w-full ${saldoInsuficiente ? 'border-danger focus:border-danger' : ''}`}
                            placeholder="Ex: 1.500" />
                    </div>

                    {/* Pedido */}
                    <div>
                        <label className="form-label">Pedido Vinculado</label>
                        <select value={pedidoId} onChange={e => setPedidoId(e.target.value)} className="input w-full">
                            <option value="">— Sem vínculo —</option>
                            {pedidos.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.numero_pedido ?? p.id.slice(0, 8)} · {p.cliente?.nome ?? ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">CFOP</label>
                            <input value={cfop} onChange={e => setCfop(e.target.value)} className="input w-full" placeholder="6.102" />
                        </div>
                        <div>
                            <label className="form-label">Nº PTV (após emissão)</label>
                            <input value={numeroPtv} onChange={e => setNumeroPtv(e.target.value)} className="input w-full" placeholder="Preenchido ao emitir" />
                        </div>
                        <div>
                            <label className="form-label">UF Destino</label>
                            <select value={uf} onChange={e => setUf(e.target.value)} className="input w-full">
                                <option value="">Selecionar</option>
                                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Município Destino</label>
                            <input value={municipio} onChange={e => setMunicipio(e.target.value)} className="input w-full" placeholder="Ex: Fortaleza" />
                        </div>
                        <div>
                            <label className="form-label">Valor Total NF (R$)</label>
                            <input type="number" step="0.01" min="0" value={valorNf} onChange={e => setValorNf(e.target.value)} className="input w-full" />
                        </div>
                        <div>
                            <label className="form-label">Data Solicitação</label>
                            <input type="date" value={dataSol} onChange={e => setDataSol(e.target.value)} className="input w-full" />
                        </div>
                        <div>
                            <label className="form-label">Data Emissão</label>
                            <input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} className="input w-full" />
                        </div>
                    </div>

                    <div>
                        <label className="form-label">Status</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(STATUS_CONFIG) as [StatusPTV, typeof STATUS_CONFIG[StatusPTV]][]).map(([s, cfg]) => (
                                <button key={s} onClick={() => setStatus(s)}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${status === s ? 'bg-[var(--accent)] text-[#1A0A2E] border-[var(--accent)]' : 'border-border text-muted hover:border-brand-400'}`}>
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="form-label">Observações</label>
                        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className="input w-full resize-none" />
                    </div>
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button onClick={save} disabled={saving || saldoInsuficiente} className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed">
                        {saving ? 'Salvando...' : 'Salvar PTV'}
                    </button>
                </div>
            </div>
        </div>
    )
}
