import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatCurrency } from '../lib/utils'
import type { Comprador, Classificacao, Motorista } from '../lib/types'

import toast from 'react-hot-toast'
import { X, ChevronLeft, ChevronRight, CheckCircle, Trash2 } from 'lucide-react'

import ResizableHeader from '../components/ResizableHeader'

const PAGE_SIZE = 25
const classColors: Record<string, string> = { CAT1: 'badge-cat1', CAT2: 'badge-cat2', CAT3: 'badge-cat3' }

interface ExpedicaoRow {
    id: string
    data_saida: string | null
    preco_compra: number | null
    valor_venda: number | null
    valor_venda_caixa?: number
    valor_venda_total_liquido?: number
    vendedor_nome?: string
    motorista_nome?: string
    motorista_cpf?: string
    placa_veiculo?: string
    numero_pedido?: string
    valor_total: number | null
    status: string
    palete_id: string | null
    transportador_nome?: string | null
    local_frete?: string | null
    valor_frete?: number | null
    palete: { numero_palete: string; caixas: number; peso_total_kg: number; classificacao: Classificacao; data_entrada: string; descricao: string; armazem: { nome: string } | null; produtor: { nome: string } | null; variedade: { nome: string } | null } | null
    cliente: { nome: string } | null
    comprador: { nome: string } | null
}

export default function Expedicao() {
    const { role, isBeta } = useAuth()
    const canOperate = role === 'dono' || role === 'operador'

    const [rows, setRows] = useState<ExpedicaoRow[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)
    const [loading, setLoading] = useState(true)
    const [compradores, setCompradores] = useState<Comprador[]>([])
    const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([])
    const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([])
    const [motoristasList, setMotoristasList] = useState<Motorista[]>([])
    const [fComprador, setFComprador] = useState('')

    const [fStatus, setFStatus] = useState('')
    const [fDataInicio, setFDataInicio] = useState('')
    const [fDataFim, setFDataFim] = useState('')
    const [showSelector, setShowSelector] = useState(false)
    const [selectedBulk, setSelectedBulk] = useState<Set<string>>(new Set())
    const [isBulkProcessing, setIsBulkProcessing] = useState(false)


    // KPIs
    const totalCaixas = rows.reduce((s, r) => s + (r.palete?.caixas ?? 0), 0)
    const totalPeso = rows.reduce((s, r) => s + (r.palete?.peso_total_kg ?? 0), 0)
    const totalCompra = canOperate ? rows.reduce((s, r) => s + (r.valor_total ?? 0), 0) : 0

    useEffect(() => {
        supabase.from('compradores').select('*').order('nome').then(({ data }) => setCompradores(data ?? []))
        supabase.from('clientes').select('id, nome').order('nome').then(({ data }) => setClientes(data ?? []))
        supabase.from('vendedores').select('id, nome').eq('status', 'ativo').order('nome').then(({ data }) => setVendedores(data as any ?? []))
        supabase.from('motoristas').select('*').eq('status', 'ativo').order('nome').then(({ data }) => setMotoristasList(data ?? []))
    }, [])


    const fetchRows = useCallback(async () => {
        setLoading(true)
        let query = supabase
            .from('expedicao')
            .select(`
                id, data_saida, preco_compra, valor_venda, status,
                vendedor_nome, motorista_nome, motorista_cpf, placa_veiculo,
                numero_pedido, valor_venda_caixa, valor_venda_total_bruto,
                valor_desconto, valor_venda_total_liquido,
                transportador_nome, local_frete, valor_frete,
                palete:palete_id(numero_palete, caixas, peso_total_kg, classificacao, data_entrada, descricao,
                  armazem:armazem_id(nome), produtor:produtor_id(nome), variedade:variedade_id(nome)),
                comprador:comprador_id(nome), 
                cliente:cliente_id(nome),
                valor_total,
                palete_id
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

        if (fComprador) query = query.eq('comprador_id', fComprador)

        if (fStatus) query = query.eq('status', fStatus)
        if (fDataInicio) query = query.gte('data_saida', fDataInicio)
        if (fDataFim) query = query.lte('data_saida', fDataFim)


        const { data, count } = await query
        setRows((data as unknown as ExpedicaoRow[]) ?? [])
        setTotal(count ?? 0)
        setLoading(false)
    }, [page, fComprador, fStatus, fDataInicio, fDataFim])



    useEffect(() => { fetchRows() }, [fetchRows])

    const toggleBulkSelect = (id: string) => {
        const next = new Set(selectedBulk)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedBulk(next)
    }

    const selectAllVisible = () => {
        if (selectedBulk.size === rows.length && rows.length > 0) {
            setSelectedBulk(new Set())
        } else {
            setSelectedBulk(new Set(rows.map(r => r.id)))
        }
    }

    async function handleBulkAction(action: 'cancel' | 'delete') {
        if (selectedBulk.size === 0) return
        const msg = action === 'cancel'
            ? `Deseja cancelar ${selectedBulk.size} expedições selecionadas?`
            : `Deseja EXCLUIR permanentemente ${selectedBulk.size} registros selecionados?`

        if (!confirm(msg)) return

        setIsBulkProcessing(true)
        const ids = Array.from(selectedBulk)

        try {
            if (action === 'cancel') {
                const { error } = await supabase.from('expedicao').update({ status: 'cancelado' }).in('id', ids)
                if (error) throw error

                // Reverter status no estoque
                const paletesToRevert = rows.filter(r => selectedBulk.has(r.id) && r.palete_id).map(r => r.palete_id)
                if (paletesToRevert.length > 0) {
                    await supabase.from('estoque').update({ status: 'disponivel' }).in('id', paletesToRevert)
                }

                toast.success(`${selectedBulk.size} expedições canceladas`)
            } else {
                // Reverter status no estoque ANTES de excluir
                const paletesToRevert = rows.filter(r => selectedBulk.has(r.id) && r.palete_id).map(r => r.palete_id)
                if (paletesToRevert.length > 0) {
                    await supabase.from('estoque').update({ status: 'disponivel' }).in('id', paletesToRevert)
                }

                const { error } = await supabase.from('expedicao').delete().in('id', ids)
                if (error) throw error
                toast.success(`${selectedBulk.size} registros excluídos`)
            }
            setSelectedBulk(new Set())
            fetchRows()
        } catch (err: any) {
            toast.error('Erro na operação em lote: ' + err.message)
        } finally {
            setIsBulkProcessing(false)
        }
    }

    async function cancelarExpedicao(row: ExpedicaoRow) {
        if (!confirm('Cancelar esta expedição?')) return

        // 1. Reverter status no estoque
        if (row.palete_id) {
            const { error: stErr } = await supabase.from('estoque').update({ status: 'disponivel' }).eq('id', row.palete_id)
            if (stErr) { toast.error('Erro ao retornar palete ao estoque'); return }
        }

        // 2. Cancelar expedição
        const { error } = await supabase.from('expedicao').update({ status: 'cancelado' }).eq('id', row.id)
        if (error) toast.error('Erro ao cancelar')
        else { toast.success('Expedição cancelada e palete disponível'); fetchRows() }
    }

    const totalPages = Math.ceil(total / PAGE_SIZE)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Gestão de Expedição</h1>
                    <p className="text-sm text-muted mt-0.5">Controle de paletes, saídas e lucratividade operacional.</p>
                </div>

                <div className="flex gap-3">
                    {selectedBulk.size > 0 && canOperate && (
                        <div className="flex items-center gap-2 bg-brand-500/10 dark:bg-brand-500/20 px-4 py-2 rounded-2xl border border-brand-500/30 animate-in fade-in slide-in-from-right-4 duration-300">
                            <span className="text-xs font-bold text-brand-600 dark:text-brand-400 mr-2">{selectedBulk.size} selecionados</span>
                            <button
                                onClick={() => handleBulkAction('cancel')}
                                disabled={isBulkProcessing}
                                className="text-xs font-bold text-warning hover:underline px-2"
                            >
                                Cancelar Lote
                            </button>
                            <button
                                onClick={() => handleBulkAction('delete')}
                                disabled={isBulkProcessing}
                                className="text-xs font-bold text-red-500 hover:underline px-2"
                            >
                                Excluir Lote
                            </button>
                            <button onClick={() => setSelectedBulk(new Set())} className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition">
                                <X className="w-3.5 h-3.5 text-muted" />
                            </button>
                        </div>
                    )}
                    {canOperate && (
                        <div className="flex gap-2">
                            <button onClick={() => fetchRows()} className="btn-secondary text-sm py-2">
                                <X className="w-4 h-4" /> Cancelar
                            </button>
                            <button onClick={() => setShowSelector(true)} className="btn-primary text-sm py-2">
                                <CheckCircle className="w-4 h-4" /> Confirmar Expedição
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="card"><p className="text-xs text-muted uppercase tracking-wide">Total de Caixas</p><p className="text-2xl font-bold mt-1 text-foreground">{totalCaixas.toLocaleString('pt-BR')}</p></div>
                <div className="card"><p className="text-xs text-muted uppercase tracking-wide">Peso Total (KG)</p><p className="text-2xl font-bold mt-1 text-foreground">{totalPeso.toLocaleString('pt-BR')}</p></div>
                {canOperate && (
                    <div className="card"><p className="text-xs text-muted uppercase tracking-wide">Total Compra Fruit</p><p className="text-2xl font-bold mt-1 text-brand-600">{formatCurrency(totalCompra)}</p></div>
                )}
            </div>

            {/* Filters */}
            <div className="card py-3">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted uppercase tracking-widest">Filtros:</span>
                        <select value={fComprador} onChange={e => { setFComprador(e.target.value); setPage(0) }} className="input w-48 py-1.5 h-10">
                            <option value="">Todos os Compradores</option>
                            {compradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>

                    <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(0) }} className="input w-36 py-1.5 h-10">
                        <option value="">Todos</option>
                        <option value="pendente">Pendente</option>
                        <option value="expedido">Confirmado</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                    <div className="flex items-center gap-2 border-l border-border pl-4 ml-2">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Saída:</span>
                        <input type="date" value={fDataInicio} onChange={e => { setFDataInicio(e.target.value); setPage(0) }} className="input py-1.5 text-xs w-32" />
                        <span className="text-muted text-xs">~</span>
                        <input type="date" value={fDataFim} onChange={e => { setFDataFim(e.target.value); setPage(0) }} className="input py-1.5 text-xs w-32" />
                    </div>
                    <button onClick={() => setShowSelector(true)} className="btn-primary text-sm py-2">
                        🔀 Selecionar para Expedição
                    </button>
                    <button onClick={() => { setFComprador(''); setFStatus(''); setFDataInicio(''); setFDataFim('') }} className="text-sm text-muted hover:text-danger flex items-center gap-1">
                        <X className="w-4 h-4" /> Limpar
                    </button>


                </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="space-y-2 py-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
                    ) : (
                        <table className="w-full text-left min-w-[1200px]">
                            <thead>
                                <tr>
                                    <th className="table-header w-10">
                                        <input
                                            type="checkbox"
                                            className="accent-brand-600 cursor-pointer"
                                            checked={selectedBulk.size > 0 && selectedBulk.size === rows.length}
                                            onChange={selectAllVisible}
                                        />
                                    </th>
                                    <ResizableHeader initialWidth={120}>DATA ENT.</ResizableHeader>
                                    <ResizableHeader initialWidth={110}>DIAS FRIO</ResizableHeader>
                                    <ResizableHeader initialWidth={130}>Nº PALETE</ResizableHeader>
                                    {canOperate && <ResizableHeader initialWidth={120}>COMPRA KG</ResizableHeader>}
                                    {canOperate && <ResizableHeader initialWidth={150}>TOTAL COMPRA</ResizableHeader>}
                                    <ResizableHeader initialWidth={220}>PRODUTOR</ResizableHeader>
                                    <ResizableHeader initialWidth={220}>COMPRADOR</ResizableHeader>

                                    <ResizableHeader initialWidth={120}>DATA SAÍDA</ResizableHeader>
                                    <ResizableHeader initialWidth={250}>DESCRIÇÃO</ResizableHeader>
                                    <ResizableHeader initialWidth={100} className="text-right">CAIXAS</ResizableHeader>
                                    <ResizableHeader initialWidth={100} className="text-right">PESO KG</ResizableHeader>
                                    <ResizableHeader initialWidth={90}>CLASS.</ResizableHeader>
                                    <ResizableHeader initialWidth={170}>VAR.</ResizableHeader>
                                    <ResizableHeader initialWidth={170}>ARMAZÉM</ResizableHeader>
                                    <ResizableHeader initialWidth={100}>PEDIDO</ResizableHeader>
                                    <ResizableHeader initialWidth={220}>CLIENTE FINAL</ResizableHeader>
                                    <ResizableHeader initialWidth={200}>VENDEDOR</ResizableHeader>
                                    <ResizableHeader initialWidth={200}>MOTORISTA</ResizableHeader>
                                    <ResizableHeader initialWidth={130}>CPF MOT.</ResizableHeader>
                                    <ResizableHeader initialWidth={100}>PLACA</ResizableHeader>
                                    <ResizableHeader initialWidth={160}>TRANSPORTADOR</ResizableHeader>
                                    <ResizableHeader initialWidth={140}>LOCAL FRETE</ResizableHeader>
                                    {!isBeta && <ResizableHeader initialWidth={120} className="text-right">VLR. FRETE</ResizableHeader>}
                                    {!isBeta && <ResizableHeader initialWidth={110} className="text-right">VENDA CX</ResizableHeader>}
                                    {!isBeta && <ResizableHeader initialWidth={150} className="text-right">VENDA TOTAL</ResizableHeader>}
                                    <ResizableHeader initialWidth={100}>STATUS</ResizableHeader>
                                    <th className="table-header whitespace-nowrap">AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {rows.map(r => (
                                    <tr key={r.id} className={`hover:bg-brand-50/30 transition-colors ${selectedBulk.has(r.id) ? 'bg-brand-500/5 shadow-[inset_4px_0_0_0_#C9A236]' : ''}`}>
                                        <td className="table-cell">
                                            <input
                                                type="checkbox"
                                                className="accent-brand-600 cursor-pointer"
                                                checked={selectedBulk.has(r.id)}
                                                onChange={() => toggleBulkSelect(r.id)}
                                            />
                                        </td>
                                        <td className="table-cell whitespace-nowrap">{r.palete ? formatDate(r.palete.data_entrada) : '—'}</td>
                                        <td className="table-cell whitespace-nowrap">
                                            {r.palete?.data_entrada ? (
                                                (() => {
                                                    const dias = Math.floor((new Date().getTime() - new Date(r.palete.data_entrada).getTime()) / 86400000)
                                                    const alert = dias >= 7
                                                    return (
                                                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${alert ? 'text-danger' : 'text-blue-500'}`}>
                                                            <span className={`w-2 h-2 rounded-full ${alert ? 'bg-danger' : 'bg-blue-400'}`} />
                                                            {dias}d
                                                        </span>
                                                    )
                                                })()
                                            ) : '—'}
                                        </td>
                                        <td className="table-cell font-mono font-medium text-brand-700">{r.palete?.numero_palete ?? '—'}</td>
                                        {canOperate && <td className="table-cell">{formatCurrency(r.preco_compra)}</td>}
                                        {canOperate && <td className="table-cell font-bold text-brand-600">{formatCurrency(r.valor_total)}</td>}
                                        <td className="table-cell">{(r.palete?.produtor as any)?.nome ?? '—'}</td>
                                        <td className="table-cell font-medium">{(r.comprador as any)?.nome ?? '—'}</td>

                                        <td className="table-cell whitespace-nowrap">{formatDate(r.data_saida)}</td>
                                        <td className="table-cell max-w-[120px] truncate">{r.palete?.descricao ?? '—'}</td>
                                        <td className="table-cell text-right">{r.palete?.caixas?.toLocaleString('pt-BR') ?? '—'}</td>
                                        <td className="table-cell text-right">{r.palete?.peso_total_kg?.toLocaleString('pt-BR') ?? '—'}</td>
                                        <td className="table-cell">
                                            {r.palete?.classificacao ? <span className={classColors[r.palete.classificacao]}>{r.palete.classificacao}</span> : '—'}
                                        </td>
                                        <td className="table-cell">{(r.palete?.variedade as any)?.nome ?? '—'}</td>
                                        <td className="table-cell">{(r.palete?.armazem as any)?.nome ?? '—'}</td>
                                        <td className="table-cell">{r.numero_pedido ?? '—'}</td>
                                        <td className="table-cell font-medium text-brand-700">{r.cliente?.nome ?? '—'}</td>
                                        <td className="table-cell">{r.vendedor_nome ?? '—'}</td>
                                        <td className="table-cell">{r.motorista_nome ?? '—'}</td>
                                        <td className="table-cell text-xs">{r.motorista_cpf ?? '—'}</td>
                                        <td className="table-cell font-mono">{r.placa_veiculo ?? '—'}</td>
                                        <td className="table-cell">{r.transportador_nome ?? '—'}</td>
                                        <td className="table-cell">{r.local_frete ?? '—'}</td>
                                        {!isBeta && <td className="table-cell text-right font-medium">{r.valor_frete != null ? formatCurrency(r.valor_frete) : '—'}</td>}
                                        {!isBeta && <td className="table-cell text-right font-medium">{formatCurrency(r.valor_venda_caixa)}</td>}
                                        {!isBeta && <td className="table-cell text-right font-black text-brand-600">{formatCurrency(r.valor_venda_total_liquido)}</td>}
                                        <td className="table-cell">
                                            <span className={r.status === 'expedido' ? 'badge-success' : r.status === 'pendente' ? 'badge-warning' : 'badge-danger'}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            <div className="flex gap-2">
                                                {canOperate && r.status !== 'cancelado' && (
                                                    <button onClick={() => cancelarExpedicao(r)} className="text-xs text-warning hover:underline" title="Cancelar">Cancelar</button>
                                                )}
                                                {canOperate && (
                                                    <button onClick={async () => {
                                                        if (!confirm('Excluir este registro de expedição permanentemente?')) return

                                                        // 1. Reverter status no estoque
                                                        if (r.palete_id) {
                                                            await supabase.from('estoque').update({ status: 'disponivel' }).eq('id', r.palete_id)
                                                        }

                                                        // 2. Excluir expedição
                                                        const { error } = await supabase.from('expedicao').delete().eq('id', r.id)
                                                        if (error) toast.error('Erro ao excluir')
                                                        else { toast.success('Expedição excluída e palete disponível'); fetchRows() }
                                                    }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted hover:text-danger transition" title="Excluir">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}

                                            </div>
                                        </td>

                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td colSpan={16} className="table-cell text-center text-muted py-12">Nenhuma expedição encontrada</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2">
                    <span className="text-sm text-muted">Exibindo {Math.min(page * PAGE_SIZE + 1, total)}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total} registros</span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                            <button key={i} onClick={() => setPage(i)}
                                className={`px-3 py-1.5 rounded-input text-sm font-medium transition ${page === i ? 'bg-brand-600 text-white' : 'bg-[var(--card)] border border-border text-foreground hover:border-brand-400'}`}>{i + 1}</button>

                        ))}
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>

            {/* Selector Modal */}
            {
                showSelector && (
                    <PaleteSelector
                        onClose={() => setShowSelector(false)}
                        onSuccess={() => { setShowSelector(false); fetchRows() }}
                        clientes={clientes}
                        vendedores={vendedores}
                        motoristas={motoristasList}
                    />
                )
            }

        </div >
    )
}

function PaleteSelector({ onClose, onSuccess, clientes, vendedores, motoristas }: {
    onClose: () => void;
    onSuccess: () => void;
    clientes: { id: string, nome: string }[];
    vendedores: { id: string, nome: string }[];
    motoristas: Motorista[];
}) {
    const [rows, setRows] = useState<any[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())

    const [clienteId, setClienteId] = useState('')
    const [dataSaida, setDataSaida] = useState(new Date().toISOString().slice(0, 10))
    const [vendedor, setVendedor] = useState('')
    const [motorista, setMotorista] = useState('')
    const [placa, setPlaca] = useState('')
    const [cpf, setCpf] = useState('')
    const [pedido, setPedido] = useState('')
    const [precoCx, setPrecoCx] = useState('')
    const [descontos, setDescontos] = useState('0')
    const [transportador, setTransportador] = useState('')
    const [localFrete, setLocalFrete] = useState('')
    const [valorFrete, setValorFrete] = useState('')

    const [saving, setSaving] = useState(false)


    useEffect(() => {
        supabase.from('expedicao')
            .select(`
                id,
                comprador_id,
                preco_compra,
                palete:palete_id(numero_palete, caixas, peso_total_kg, classificacao, variedade:variedade_id(nome), produtor:produtor_id(nome)),
                comprador:comprador_id(nome)
            `)
            .eq('status', 'pendente')
            .order('created_at', { ascending: false })
            .then(({ data }) => setRows(data ?? []))
    }, [])

    async function confirmar() {
        if (!clienteId) { toast.error('Selecione um cliente'); return }
        if (selected.size === 0) { toast.error('Selecione ao menos 1 item'); return }
        if (!precoCx) { toast.error('Informe o valor de venda por caixa'); return }

        setSaving(true)
        const selectedArr = Array.from(selected)
        const prCx = Number(precoCx) || 0
        const desc = Number(descontos) || 0
        const selectedRows = rows.filter(r => selected.has(r.id))

        let finalPedido = pedido
        if (!finalPedido) {
            const { data: lastPed } = await supabase.from('pedidos').select('numero_pedido').order('created_at', { ascending: false }).limit(1).maybeSingle()
            let nextNum = 1
            if (lastPed?.numero_pedido && lastPed.numero_pedido.startsWith('NP')) {
                nextNum = parseInt(lastPed.numero_pedido.slice(2)) + 1
            }
            finalPedido = `NP${String(nextNum).padStart(4, '0')}`
        }

        const totalCaixasSel = selectedRows.reduce((sum, r) => sum + (r.palete?.caixas || 0), 0)
        const brutoTotal = totalCaixasSel * prCx
        const liquidoTotal = brutoTotal - desc

        // 1. Criar o Pedido
        const { data: pedidoData, error: pedErr } = await supabase.from('pedidos').insert({
            cliente_id: clienteId,
            vendedor_nome: vendedor,
            motorista_nome: motorista,
            motorista_cpf: cpf,
            placa_veiculo: placa,
            numero_pedido: finalPedido,
            data_saida: dataSaida,
            valor_total_bruto: brutoTotal,
            valor_desconto: desc,
            valor_total_liquido: liquidoTotal,
            status: 'pendente'
        }).select().single()

        if (pedErr) {
            toast.error('Erro ao criar pedido: ' + pedErr.message)
            setSaving(false)
            return
        }

        // 2. Vincular itens de expedição ao pedido
        for (const id of selectedArr) {
            const row = rows.find(r => r.id === id)
            const caixas = row?.palete?.caixas || 0
            const bruto = caixas * prCx
            const propDesc = totalCaixasSel > 0 ? (caixas / totalCaixasSel) * desc : 0

            const { error: upErr } = await supabase.from('expedicao').update({
                pedido_id: pedidoData.id,
                cliente_id: clienteId,
                data_saida: dataSaida,
                vendedor_nome: vendedor,
                motorista_nome: motorista,
                motorista_cpf: cpf,
                placa_veiculo: placa,
                numero_pedido: pedido,
                valor_venda_caixa: prCx,
                valor_venda_total_bruto: bruto,
                valor_desconto: propDesc,
                valor_venda_total_liquido: bruto - propDesc,
                transportador_nome: transportador || null,
                local_frete: localFrete || null,
                valor_frete: valorFrete ? Number(valorFrete) : null,
                status: 'expedido'
            }).eq('id', id)

            if (upErr) {
                toast.error('Erro ao atualizar item: ' + id)
                console.error(upErr)
            }
        }

        // 3. Atualizar status dos paletes no estoque para "expedido" (viajou)
        const paletesIds = selectedRows.map(r => r.palete_id).filter(Boolean)
        if (paletesIds.length > 0) {
            const { error: stErr } = await supabase.from('estoque').update({ status: 'expedido' }).in('id', paletesIds)
            if (stErr) console.error('Erro ao atualizar status do estoque:', stErr)
        }

        toast.success(`Expedição de ${selectedArr.length} itens confirmada!`)
        setSaving(false)
        onSuccess()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">Selecionar Paletes para Expedição</h2>
                    <button onClick={onClose} className="text-muted hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/50 dark:bg-zinc-800/20 border-b border-border">
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Cliente Destino</label>
                        <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="input h-10">
                            <option value="">Selecione o Cliente</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Data Saída</label>
                        <input type="date" value={dataSaida} onChange={e => setDataSaida(e.target.value)} className="input h-10" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Nº Pedido</label>
                        <input type="text" value={pedido} onChange={e => setPedido(e.target.value)} className="input h-10" placeholder="Ex: 502" />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Vendedor</label>
                        <select value={vendedor} onChange={e => setVendedor(e.target.value)} className="input h-10">
                            <option value="">Selecione</option>
                            {vendedores.map(v => <option key={v.id} value={v.nome || ''}>{v.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Motorista</label>
                        <select
                            value={motorista}
                            onChange={e => {
                                const name = e.target.value
                                setMotorista(name)
                                const mot = motoristas.find(m => m.nome === name)
                                if (mot?.cpf) setCpf(mot.cpf)
                            }}
                            className="input h-10"
                        >
                            <option value="">Selecione</option>
                            {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">CPF Motorista</label>
                        <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} className="input h-10" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Placa Veículo</label>
                        <input type="text" value={placa} onChange={e => setPlaca(e.target.value)} className="input h-10" />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Valor Venda CX</label>
                        <input type="number" step="0.01" value={precoCx} onChange={e => setPrecoCx(e.target.value)} className="input h-10" placeholder="0,00" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Descontos (Total)</label>
                        <input type="number" step="0.01" value={descontos} onChange={e => setDescontos(e.target.value)} className="input h-10" placeholder="0,00" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Transportador / Freteiro</label>
                        <input type="text" value={transportador} onChange={e => setTransportador(e.target.value)} className="input h-10" placeholder="Nome do transportador" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Local / Rota do Frete</label>
                        <input type="text" value={localFrete} onChange={e => setLocalFrete(e.target.value)} className="input h-10" placeholder="Ex: SP → CE" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Valor do Frete (R$)</label>
                        <input type="number" step="0.01" min="0" value={valorFrete} onChange={e => setValorFrete(e.target.value)} className="input h-10" placeholder="0,00" />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                        <div className="w-full p-2 bg-brand-50 dark:bg-brand-900/10 rounded-lg border border-brand-100 dark:border-brand-900/30 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-brand-600 uppercase">Total Bruto Estimado:</span>
                            <span className="font-bold text-brand-700">{formatCurrency((rows.filter(r => selected.has(r.id)).reduce((s, r) => s + (r.palete?.caixas || 0), 0) * (Number(precoCx) || 0)))}</span>
                        </div>
                    </div>
                </div>


                <div className="flex-1 overflow-y-auto px-5">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white dark:bg-zinc-900 z-10">
                            <tr>
                                <th className="table-header w-10"></th>
                                {['Nº PALETE', 'PRODUTOR', 'COMPRADOR (ROM.)', 'CAIXAS', 'PESO KG', 'P. COMPRA', 'CLASS.'].map(h => <th key={h} className="table-header">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.id} className={`hover:bg-brand-50/40 transition-colors ${selected.has(r.id) ? 'bg-brand-50' : ''}`}>
                                    <td className="table-cell"><input type="checkbox" className="accent-brand-600" checked={selected.has(r.id)} onChange={() => {
                                        setSelected(prev => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n })
                                    }} /></td>
                                    <td className="table-cell font-mono text-brand-700">{r.palete?.numero_palete}</td>
                                    <td className="table-cell">{r.palete?.produtor?.nome ?? '—'}</td>
                                    <td className="table-cell text-muted">{r.comprador?.nome ?? '—'}</td>
                                    <td className="table-cell text-right font-bold">{r.palete?.caixas}</td>
                                    <td className="table-cell text-right">{r.palete?.peso_total_kg?.toLocaleString('pt-BR')} kg</td>
                                    <td className="table-cell text-right text-brand-600 font-medium">{formatCurrency(r.preco_compra)}</td>
                                    <td className="table-cell">
                                        {r.palete?.classificacao ? <span className={(classColors[r.palete.classificacao] ?? 'badge')}>{r.palete.classificacao}</span> : '—'}
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && <tr><td colSpan={8} className="table-cell text-center text-gray-400 py-12">Nenhum palete pendente (Gere um Romaneio primeiro)</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="p-5 border-t border-border flex items-center justify-between bg-gray-50/50 dark:bg-zinc-900">
                    <div className="text-sm">
                        <span className="font-bold text-foreground">{selected.size}</span> itens selecionados |
                        <span className="ml-2 font-bold text-brand-600">{rows.filter(r => selected.has(r.id)).reduce((s, r) => s + (r.palete?.caixas || 0), 0)}</span> caixas totais
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="btn-secondary px-6">Cancelar</button>
                        <button onClick={confirmar} disabled={saving || selected.size === 0} className="btn-primary px-8">
                            {saving ? 'Confirmando...' : 'Confirmar Saída Final'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
