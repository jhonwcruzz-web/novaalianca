import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, calcDaysFromDate } from '../lib/utils'
import type { EstoquePalete, Classificacao, Variedade, Produtor, Armazem, Comprador, Pedido } from '../lib/types'

import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
    FileDown, FileUp, ClipboardList, X, ChevronLeft, ChevronRight,
    Trash2, RefreshCw
} from 'lucide-react'
import ResizableHeader from '../components/ResizableHeader'

const PAGE_SIZE = 25
const classColors: Record<string, string> = { CAT1: 'badge-cat1', CAT2: 'badge-cat2', CAT3: 'badge-cat3' }

export default function Estoque() {
    const { role } = useAuth()
    const canOperate = role === 'dono' || role === 'operador'


    const [paletes, setPaletes] = useState<EstoquePalete[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // Reference data
    const [variedades, setVariedades] = useState<Variedade[]>([])
    const [produtores, setProdutores] = useState<Produtor[]>([])
    const [armazens, setArmazens] = useState<Armazem[]>([])
    const [compradores, setCompradores] = useState<Comprador[]>([])

    // Filters
    const [fClassificacao, setFClassificacao] = useState('')
    const [fVariedade, setFVariedade] = useState('')
    const [fProdutor, setFProdutor] = useState('')
    const [fArmazem, setFArmazem] = useState('')
    const [fDataInicio, setFDataInicio] = useState('')
    const [fDataFim, setFDataFim] = useState('')
    const [fSomenteDisponivel, setFSomenteDisponivel] = useState(false)

    // Modals
    const [showImport, setShowImport] = useState(false)
    const [showRomaneio, setShowRomaneio] = useState(false)

    // Romaneio form
    const [romComprador, setRomComprador] = useState('')
    const [romPedido, setRomPedido] = useState('')
    const [romData, setRomData] = useState(new Date().toISOString().slice(0, 10))
    const [rowPrices, setRowPrices] = useState<Record<string, string>>({})
    const [savingRom, setSavingRom] = useState(false)
    const [pedidosAbertos, setPedidosAbertos] = useState<Pedido[]>([])
    const [totais, setTotais] = useState({ caixas: 0, peso: 0, frios: 0 })

    useEffect(() => {
        const fetchRefs = async () => {
            const [v, p, a, c] = await Promise.all([
                supabase.from('variedades').select('*').order('nome'),
                supabase.from('produtores').select('*').order('nome'),
                supabase.from('armazens').select('*').order('nome'),
                supabase.from('compradores').select('*').order('nome'),
            ])
            setVariedades(v.data ?? [])
            setProdutores(p.data ?? [])
            setArmazens(a.data ?? [])
            setCompradores(c.data ?? [])
        }
        fetchRefs()
        // Carregar pedidos pendentes para vincular ao romaneio
        supabase.from('pedidos').select('*, cliente:cliente_id(nome)').in('status', ['pendente', 'aprovado']).order('created_at', { ascending: false }).then(({ data }) => setPedidosAbertos((data as Pedido[]) ?? []))
    }, [])





    const fetchPaletes = useCallback(async () => {
        setLoading(true)
        let query = supabase
            .from('estoque')
            .select('*, variedade_id, variedade:variedade_id(nome), produtor_id, produtor:produtor_id(nome), armazem_id, armazem:armazem_id(nome)', { count: 'exact' })
            .order('data_estoque', { ascending: false })
            .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

        let sumQuery = supabase.from('estoque').select('caixas, peso_total_kg, data_entrada, armazem:armazem_id(nome)')

        if (fClassificacao) { query = query.eq('classificacao', fClassificacao); sumQuery = sumQuery.eq('classificacao', fClassificacao) }
        if (fVariedade) { query = query.eq('variedade_id', fVariedade); sumQuery = sumQuery.eq('variedade_id', fVariedade) }
        if (fProdutor) { query = query.eq('produtor_id', fProdutor); sumQuery = sumQuery.eq('produtor_id', fProdutor) }
        if (fArmazem) { query = query.eq('armazem_id', fArmazem); sumQuery = sumQuery.eq('armazem_id', fArmazem) }
        if (fDataInicio) { query = query.gte('data_entrada', fDataInicio); sumQuery = sumQuery.gte('data_entrada', fDataInicio) }
        if (fDataFim) { query = query.lte('data_entrada', fDataFim); sumQuery = sumQuery.lte('data_entrada', fDataFim) }
        if (fSomenteDisponivel) { query = query.eq('status', 'disponivel'); sumQuery = sumQuery.eq('status', 'disponivel') }

        const [{ data, count }, { data: allData }] = await Promise.all([query, sumQuery])

        setPaletes((data as EstoquePalete[]) ?? [])
        setTotal(count ?? 0)

        if (allData) {
            const now = new Date()
            let c = 0, p = 0, f = 0
            allData.forEach((row: any) => {
                c += (row.caixas ?? 0)
                p += (row.peso_total_kg ?? 0)
                const armazemNome = row.armazem?.nome ? row.armazem.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""
                if (armazemNome.includes('camara') && row.data_entrada) {
                    if ((now.getTime() - new Date(row.data_entrada).getTime()) / 86400000 >= 7) f++
                }
            })
            setTotais({ caixas: c, peso: p, frios: f })
        }

        setLoading(false)
    }, [page, fClassificacao, fVariedade, fProdutor, fArmazem, fDataInicio, fDataFim, fSomenteDisponivel])


    useEffect(() => { fetchPaletes() }, [fetchPaletes])

    const selectedPaletes = paletes.filter(p => selected.has(p.id))
    const totalCaixasSel = selectedPaletes.reduce((s, p) => s + (p.caixas ?? 0), 0)
    const totalPesoSel = selectedPaletes.reduce((s, p) => s + (p.peso_total_kg ?? 0), 0)
    const totalPages = Math.ceil(total / PAGE_SIZE)

    function toggleSelect(id: string) {
        setSelected(prev => {
            const n = new Set(prev)
            if (n.has(id)) n.delete(id)
            else n.add(id)
            return n
        })
    }

    function exportExcel() {
        const data = paletes.map(p => ({
            'Nº Palete': p.numero_palete,
            'Data Estoque': formatDate(p.data_estoque),
            'Data Entrada': formatDate(p.data_entrada),
            'Descrição': p.descricao,
            'Caixas': p.caixas,
            'Peso Caixa': p.peso_caixa,
            'Peso Total KG': p.peso_total_kg,
            'Mascaro': p.mascaro,
            'Variedade': (p.variedade as any)?.nome,
            'Produtor': (p.produtor as any)?.nome,
            'Classificação': p.classificacao,
            'Embalagem': p.embalagem,
            'Marca': p.marca,
            'Armazém': (p.armazem as any)?.nome,
            'Status': p.status,
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Estoque')
        XLSX.writeFile(wb, `estoque_${new Date().toISOString().slice(0, 10)}.xlsx`)
        toast.success('Excel exportado!')
    }

    async function confirmarRomaneio() {
        if (!romComprador) { toast.error('Selecione o comprador'); return }
        if (selected.size === 0) { toast.error('Selecione ao menos um palete'); return }

        setSavingRom(true)

        // Se tem pedido vinculado, buscar os dados do pedido para copiar na expedição
        let pedidoExtra: Record<string, unknown> = {}
        let pedidoItens: any[] = []
        if (romPedido) {
            const [{ data: ped }, { data: pitens }] = await Promise.all([
                supabase
                    .from('pedidos')
                    .select('cliente_id, numero_pedido, vendedor_nome, motorista_nome, motorista_cpf, placa_veiculo')
                    .eq('id', romPedido)
                    .single(),
                supabase
                    .from('pedido_itens')
                    .select('*')
                    .eq('pedido_id', romPedido)
            ])

            if (ped) {
                pedidoExtra = {
                    cliente_id: ped.cliente_id ?? null,
                    numero_pedido: ped.numero_pedido ?? null,
                    vendedor_nome: ped.vendedor_nome ?? null,
                    motorista_nome: ped.motorista_nome ?? null,
                    motorista_cpf: ped.motorista_cpf ?? null,
                    placa_veiculo: ped.placa_veiculo ?? null,
                }
            }
            if (pitens) pedidoItens = pitens
        }

        const expedicaoEntries = selectedPaletes.map(p => {
            const priceKg = Number(rowPrices[p.id]) || 0
            const weight = p.peso_total_kg || 0

            // Busca preço de venda no pedido
            // 1. Tenta correspondência exata (Variedade + CAT)
            let matchingItem = pedidoItens.find(item =>
                item.variedade_id === p.variedade_id &&
                item.classificacao === p.classificacao
            )

            // 2. Fallback: Se não achou exato, tenta apenas por Variedade (qualquer CAT)
            if (!matchingItem) {
                matchingItem = pedidoItens.find(item => item.variedade_id === p.variedade_id)
            }

            const vendaCx = matchingItem?.preco_caixa || 0

            return {
                palete_id: p.id,
                comprador_id: romComprador || null,
                pedido_id: romPedido || null,
                data_saida: romData,
                preco_compra: priceKg,
                valor_venda: priceKg,
                valor_total: priceKg * weight,
                valor_venda_caixa: vendaCx,
                valor_venda_total_bruto: vendaCx * (p.caixas || 0),
                valor_venda_total_liquido: vendaCx * (p.caixas || 0),
                valor_desconto: 0,
                status: 'pendente',
                ...pedidoExtra,
            }
        })

        const { error: expErr } = await supabase.from('expedicao').insert(expedicaoEntries)

        if (expErr) {
            toast.error('Erro ao salvar expedição: ' + expErr.message);
            setSavingRom(false);
            return
        }

        // Atualiza status do estoque para reservado
        const { error: stErr } = await supabase.from('estoque').update({ status: 'reservado' }).in('id', Array.from(selected))
        if (stErr) { toast.error('Erro ao atualizar estoque'); setSavingRom(false); return }

        toast.success(`Expedição gerada! ${selected.size} paletes movidos.`)
        setSelected(new Set())
        setShowRomaneio(false)
        setSavingRom(false)
        setRomComprador('')
        setRomPedido('')
        setRomData(new Date().toISOString().slice(0, 10))
        setRowPrices({})

        fetchPaletes()
    }

    async function syncPaletes() {
        if (!confirm('Deseja sincronizar o status dos paletes? Isso liberará paletes que não possuem registros de expedição ativos.')) return

        setLoading(true)
        try {
            // 1. Buscar todos os paletes reservados/expedidos
            const { data: stuckPaletes } = await supabase
                .from('estoque')
                .select('id, numero_palete')
                .in('status', ['reservado', 'expedido'])

            if (!stuckPaletes || stuckPaletes.length === 0) {
                toast.success('Todos os paletes já estão sincronizados!')
                setLoading(false)
                return
            }

            // 2. Buscar paletes que possuem expedição ativa
            const { data: activeExpeditions } = await supabase
                .from('expedicao')
                .select('palete_id')
                .not('status', 'eq', 'cancelado')

            const activeIds = new Set(activeExpeditions?.map(e => e.palete_id) || [])

            // 3. Identificar os "órfãos" (estão no estoque mas não na expedição)
            const orphanedIds = stuckPaletes
                .filter(p => !activeIds.has(p.id))
                .map(p => p.id)

            if (orphanedIds.length > 0) {
                const { error: upErr } = await supabase
                    .from('estoque')
                    .update({ status: 'disponivel' })
                    .in('id', orphanedIds)

                if (upErr) throw upErr
                toast.success(`${orphanedIds.length} paletes liberados e sincronizados!`)
            } else {
                toast.success('Status sincronizado! Nenhum palete órfão encontrado.')
            }
            fetchPaletes()
        } catch (err: any) {
            toast.error('Erro ao sincronizar: ' + err.message)
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestão de Estoque</h1>
                    <p className="text-sm text-muted mt-0.5">Visão detalhada e controle de paletes em tempo real.</p>
                </div>

                {canOperate && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowImport(true)} className="btn-secondary text-sm py-2">
                            <FileUp className="w-4 h-4" /> Importar Excel
                        </button>
                        <button onClick={exportExcel} className="btn-secondary text-sm py-2">
                            <FileDown className="w-4 h-4" /> Exportar Excel
                        </button>
                        <button onClick={syncPaletes} className="btn-secondary text-sm py-2 group" title="Sincronizar status com expedição">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} /> Sincronizar
                        </button>
                        <button onClick={() => { if (selected.size === 0) { toast.error('Selecione ao menos 1 palete'); return } setShowRomaneio(true) }}
                            className="btn-primary text-sm py-2">
                            <ClipboardList className="w-4 h-4" /> Gerar Romaneio
                            {selected.size > 0 && <span className="bg-white text-brand-600 rounded-full px-1.5 text-xs font-bold">{selected.size}</span>}
                        </button>
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card border-none bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-zinc-900/50 shadow-md">
                    <p className="text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest mb-1">Total de Paletes</p>
                    <h3 className="text-2xl font-black text-foreground">{total.toLocaleString('pt-BR')}</h3>
                </div>
                <div className="card">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total de Caixas</p>
                    <h3 className="text-2xl font-black text-foreground">{totais.caixas.toLocaleString('pt-BR')}</h3>
                </div>
                <div className="card">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Peso Estimado (KG)</p>
                    <h3 className="text-2xl font-black text-foreground">{Math.round(totais.peso).toLocaleString('pt-BR')} kg</h3>
                </div>
                <div className="card">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Alerta Frios</p>
                    <h3 className="text-2xl font-black text-warning leading-none">{totais.frios}</h3>
                </div>
            </div>

            {/* Filters */}
            <div className="card py-3">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted uppercase tracking-widest">Filtros:</span>
                        <select value={fClassificacao} onChange={e => { setFClassificacao(e.target.value); setPage(0) }} className="input w-36 py-1.5 h-10">
                            <option value="">Qualquer CAT</option>
                            <option value="CAT1">CAT1</option>
                            <option value="CAT2">CAT2</option>
                            <option value="CAT3">CAT3</option>
                        </select>
                    </div>
                    <select value={fVariedade} onChange={e => setFVariedade(e.target.value)} className="input w-44 text-sm">
                        <option value="">Variedade</option>
                        {variedades.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                    </select>
                    <select value={fProdutor} onChange={e => setFProdutor(e.target.value)} className="input w-44 text-sm">
                        <option value="">Produtor</option>
                        {produtores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                    <select value={fArmazem} onChange={e => setFArmazem(e.target.value)} className="input w-40 text-sm">
                        <option value="">Armazém</option>
                        {armazens.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                    <div className="flex items-center gap-2 border-l border-border pl-4 ml-2">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Entrada:</span>
                        <input type="date" value={fDataInicio} onChange={e => { setFDataInicio(e.target.value); setPage(0) }} className="input py-1.5 text-xs w-32" />
                        <span className="text-muted text-xs">~</span>
                        <input type="date" value={fDataFim} onChange={e => { setFDataFim(e.target.value); setPage(0) }} className="input py-1.5 text-xs w-32" />

                        <label className="flex items-center gap-2 ml-4 cursor-pointer">
                            <input
                                type="checkbox"
                                className="accent-brand-600 w-4 h-4 cursor-pointer"
                                checked={fSomenteDisponivel}
                                onChange={e => { setFSomenteDisponivel(e.target.checked); setPage(0) }}
                            />
                            <span className="text-xs font-bold text-brand-600 uppercase tracking-widest whitespace-nowrap">Somente Disponíveis</span>
                        </label>
                    </div>
                    <button onClick={() => { setFClassificacao(''); setFVariedade(''); setFProdutor(''); setFArmazem(''); setFDataInicio(''); setFDataFim(''); setFSomenteDisponivel(false) }}
                        className="text-sm text-muted hover:text-danger flex items-center gap-1 transition ml-auto">
                        <X className="w-4 h-4" /> Limpar
                    </button>

                </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="space-y-2 py-4">
                            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
                        </div>
                    ) : (
                        <table className="w-full text-left min-w-[1400px]">
                            <thead>
                                <tr>
                                    <th className="table-header w-10"><input type="checkbox" className="accent-brand-600" onChange={e => {
                                        if (e.target.checked) setSelected(new Set(paletes.filter(p => p.status === 'disponivel').map(p => p.id)))
                                        else setSelected(new Set())
                                    }} /></th>
                                    <ResizableHeader initialWidth={130}>DATA EST.</ResizableHeader>
                                    <ResizableHeader initialWidth={130}>DATA ENT.</ResizableHeader>
                                    <ResizableHeader initialWidth={160}>Nº PALETE</ResizableHeader>
                                    <ResizableHeader initialWidth={110}>IDADE</ResizableHeader>
                                    <ResizableHeader initialWidth={120}>DIAS FRIO</ResizableHeader>
                                    <ResizableHeader initialWidth={350}>DESCRIÇÃO</ResizableHeader>
                                    <ResizableHeader initialWidth={110} className="text-right">CAIXAS</ResizableHeader>
                                    <ResizableHeader initialWidth={120} className="text-right">PESO CX</ResizableHeader>
                                    <ResizableHeader initialWidth={130} className="text-right">PESO KG</ResizableHeader>
                                    <ResizableHeader initialWidth={180}>MASCARO</ResizableHeader>
                                    <ResizableHeader initialWidth={200}>VARIEDADE</ResizableHeader>
                                    <ResizableHeader initialWidth={300}>PRODUTOR</ResizableHeader>
                                    <ResizableHeader initialWidth={120}>CLASS.</ResizableHeader>
                                    <ResizableHeader initialWidth={200}>EMBALAGEM</ResizableHeader>
                                    <ResizableHeader initialWidth={200}>MARCA</ResizableHeader>
                                    <ResizableHeader initialWidth={200}>ARMAZÉM</ResizableHeader>
                                    <ResizableHeader initialWidth={130}>STATUS</ResizableHeader>
                                    <th className="table-header whitespace-nowrap">AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paletes.map(p => {
                                    const diasFrio = calcDaysFromDate(p.data_entrada)
                                    const idadePalete = calcDaysFromDate(p.data_entrada)
                                    const firoAlert = diasFrio >= 7
                                    return (
                                        <tr key={p.id} className={`hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-colors ${selected.has(p.id) ? 'bg-brand-500/10 dark:bg-brand-500/20 shadow-[inset_4px_0_0_0_#0891B2]' : ''}`}>

                                            <td className="table-cell">
                                                <input
                                                    type="checkbox"
                                                    className="accent-brand-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    checked={selected.has(p.id)}
                                                    onChange={() => toggleSelect(p.id)}
                                                    disabled={p.status !== 'disponivel'}
                                                />
                                            </td>
                                            <td className="table-cell whitespace-nowrap">{formatDate(p.data_estoque)}</td>
                                            <td className="table-cell whitespace-nowrap">{formatDate(p.data_entrada)}</td>
                                            <td className="table-cell font-mono font-medium text-brand-700">{p.numero_palete}</td>
                                            <td className="table-cell whitespace-nowrap">{idadePalete}d</td>
                                            <td className="table-cell whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${firoAlert ? 'text-danger' : 'text-blue-500'}`}>
                                                    <span className={`w-2 h-2 rounded-full ${firoAlert ? 'bg-danger' : 'bg-blue-400'}`} />
                                                    {diasFrio}d
                                                </span>
                                            </td>
                                            <td className="table-cell">{p.descricao ?? '—'}</td>
                                            <td className="table-cell text-right">{p.caixas ?? '—'}</td>
                                            <td className="table-cell text-right">{p.peso_caixa ?? '—'}</td>
                                            <td className="table-cell text-right font-medium">{p.peso_total_kg?.toLocaleString('pt-BR') ?? '—'}</td>
                                            <td className="table-cell">{p.mascaro ?? '—'}</td>
                                            <td className="table-cell whitespace-nowrap">{(p.variedade as any)?.nome ?? '—'}</td>
                                            <td className="table-cell whitespace-nowrap">{(p.produtor as any)?.nome ?? '—'}</td>
                                            <td className="table-cell">
                                                {p.classificacao ? <span className={classColors[p.classificacao]}>{p.classificacao}</span> : '—'}
                                            </td>
                                            <td className="table-cell">{p.embalagem ?? '—'}</td>
                                            <td className="table-cell">{p.marca ?? '—'}</td>
                                            <td className="table-cell">{(p.armazem as any)?.nome ?? '—'}</td>
                                            <td className="table-cell">
                                                <span className={p.status === 'disponivel' ? 'badge-success' : p.status === 'reservado' ? 'badge-warning' : 'badge badge-cat3'}>
                                                    {p.status === 'disponivel' ? 'DISPONÍVEL' : p.status === 'reservado' ? 'EM EXPEDIÇÃO' : 'EXPEDIDO'}
                                                </span>
                                            </td>
                                            <td className="table-cell">
                                                {canOperate && (
                                                    <button onClick={async () => {
                                                        if (!confirm('Excluir este palete permanentemente do sistema?')) return
                                                        const { error } = await supabase.from('estoque').delete().eq('id', p.id)
                                                        if (error) toast.error('Erro ao excluir')
                                                        else { toast.success('Palete excluído'); fetchPaletes() }
                                                    }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted hover:text-danger transition" title="Excluir">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </td>

                                        </tr>
                                    )
                                })}
                                {paletes.length === 0 && (
                                    <tr><td colSpan={19} className="table-cell text-center text-gray-400 py-12">Nenhum palete encontrado</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2">
                    <span className="text-sm text-gray-500">
                        Exibindo {Math.min(page * PAGE_SIZE + 1, total)}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total} paletes
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                            <button key={i} onClick={() => setPage(i)}
                                className={`px-3 py-1.5 rounded-input text-sm font-medium transition ${page === i ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400'}`}>
                                {i + 1}
                            </button>
                        ))}
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Import Modal */}
            {/* Import Modal */}
            {showImport && <ImportModal onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); fetchPaletes() }} variedades={variedades} produtores={produtores} armazens={armazens} />}



            {/* Romaneio Modal */}
            {/* Romaneio Modal */}
            {
                showRomaneio && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="p-6 pb-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Gerar Romaneio</h2>
                                    <div className="flex gap-4 mt-1 text-xs text-muted">
                                        <span>PRODUTOR: <b className="text-foreground">{(selectedPaletes[0]?.produtor as any)?.nome || '—'}</b></span>
                                    </div>
                                </div>
                                <button onClick={() => setShowRomaneio(false)} className="text-muted hover:text-foreground transition"><X className="w-6 h-6" /></button>
                            </div>

                            {/* Content */}
                            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 dark:bg-zinc-900/50">
                                {Object.entries(
                                    selectedPaletes.reduce((acc, p) => {
                                        const cat = p.classificacao || 'S/C'
                                        if (!acc[cat]) acc[cat] = []
                                        acc[cat].push(p)
                                        return acc
                                    }, {} as Record<string, EstoquePalete[]>)
                                ).sort().map(([cat, ps]) => {
                                    const subCaixas = ps.reduce((s, p) => s + (p.caixas || 0), 0)
                                    const subPeso = ps.reduce((s, p) => s + (p.peso_total_kg || 0), 0)

                                    return (
                                        <div key={cat} className="mb-6 last:mb-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`${classColors[cat] || 'badge-gray'} text-xs font-bold px-3 py-1 rounded-full uppercase tracking-tighter`}>{cat}</span>
                                                </div>
                                                <div className="h-px flex-1 bg-gray-200 dark:bg-zinc-800 mx-4" />
                                                <div className="text-[10px] font-bold text-muted/60">Total {ps.length} paletes</div>
                                            </div>

                                            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-muted/30">
                                                            <th className="px-4 py-2 text-left font-semibold text-muted text-[10px] uppercase tracking-wider">Nº Palete</th>
                                                            <th className="px-4 py-2 text-left font-semibold text-muted text-[10px] uppercase tracking-wider">Descrição</th>
                                                            <th className="px-4 py-2 text-right font-semibold text-muted text-[10px] uppercase tracking-wider">Cx.</th>
                                                            <th className="px-4 py-2 text-right font-semibold text-muted text-[10px] uppercase tracking-wider">KG</th>
                                                            <th className="px-4 py-2 text-center font-semibold text-muted text-[10px] uppercase tracking-wider w-40">
                                                                <div className="mb-1 text-[10px]">Valor Compra KG</div>
                                                                <div className="flex items-center justify-center gap-1 bg-muted/10 px-1.5 py-1 rounded-lg border border-border">
                                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#0891B2]">Em Massa:</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="0,00"
                                                                        className="w-14 px-1 py-0.5 h-6 text-center text-[10px] border border-dashed border-muted/50 rounded focus:border-brand-500 bg-white dark:bg-zinc-800 font-normal shadow-sm outline-none"
                                                                        onChange={(e) => {
                                                                            const price = e.target.value;
                                                                            setRowPrices(prev => {
                                                                                const next = { ...prev };
                                                                                ps.forEach(p => { next[p.id] = price; });
                                                                                return next;
                                                                            });
                                                                        }}
                                                                    />
                                                                </div>
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {ps.map(p => (
                                                            <tr key={p.id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                                                                <td className="px-4 py-2.5 font-mono text-brand-600 font-medium">{p.numero_palete}</td>
                                                                <td className="px-4 py-2.5 text-foreground">{p.descricao || (p.variedade as any)?.nome || '—'}</td>
                                                                <td className="px-4 py-2.5 text-right font-medium">{p.caixas}</td>
                                                                <td className="px-4 py-2.5 text-right text-muted">{p.peso_total_kg?.toLocaleString('pt-BR')}</td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="0,00"
                                                                        value={rowPrices[p.id] || ''}
                                                                        onChange={e => setRowPrices(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                                        className="input w-24 py-1 text-center text-xs bg-muted/20 border-border/50 focus:bg-card"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        <tr className="bg-brand-50/10 dark:bg-brand-500/5 border-t border-brand-200/20">
                                                            <td colSpan={2} className="px-4 py-2 text-xs font-bold text-brand-600 dark:text-brand-400">SUBTOTAL {cat}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-brand-700 dark:text-brand-300">{subCaixas}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-brand-700 dark:text-brand-300">{subPeso.toLocaleString('pt-BR')} kg</td>
                                                            <td />
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )
                                })}


                                {/* General Info */}
                                <div className="mt-8 p-6 bg-card border border-border rounded-2xl shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Vincular a Pedido <span className="font-normal normal-case text-muted">(opcional)</span></label>
                                            <select
                                                value={romPedido}
                                                onChange={e => setRomPedido(e.target.value)}
                                                className="input h-11"
                                            >
                                                <option value="">Sem vínculo com pedido</option>
                                                {pedidosAbertos.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.numero_pedido} — {(p.cliente as any)?.nome}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Comprador</label>
                                            <select
                                                value={romComprador}
                                                onChange={e => setRomComprador(e.target.value)}
                                                className="input h-11"
                                                required
                                            >
                                                <option value="">Selecione o Comprador</option>
                                                {compradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Data da Entrada</label>
                                            <input
                                                type="date"
                                                value={romData}
                                                onChange={e => setRomData(e.target.value)}
                                                className="input h-11"
                                            />
                                        </div>
                                        <div className="flex flex-col justify-end">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="text-center p-3 rounded-xl bg-muted/20">
                                                    <p className="text-[10px] font-bold text-muted uppercase">Total Geral Cx.</p>
                                                    <p className="text-xl font-black text-foreground">{totalCaixasSel}</p>
                                                </div>
                                                <div className="text-center p-3 rounded-xl bg-muted/20">
                                                    <p className="text-[10px] font-bold text-muted uppercase">Total Geral Peso</p>
                                                    <p className="text-xl font-black text-foreground">{totalPesoSel.toLocaleString('pt-BR')} kg</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-muted/20 border-t border-border flex gap-3 justify-end">
                                <button onClick={() => setShowRomaneio(false)} className="btn-secondary h-11 px-6">Cancelar</button>
                                <button
                                    onClick={confirmarRomaneio}
                                    disabled={savingRom}
                                    className="btn-primary h-11 px-8 shadow-lg shadow-brand-500/20 disabled:opacity-50"
                                >
                                    {savingRom ? 'Salvando...' : '🚀 CONFIRMAR ROMANEIO E EXPEDIR'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}


function ImportModal({ onClose, onSuccess, variedades, produtores, armazens }: {
    onClose: () => void
    onSuccess: () => void
    variedades: Variedade[]
    produtores: Produtor[]
    armazens: Armazem[]
}) {
    const [dragOver, setDragOver] = useState(false)
    const [rows, setRows] = useState<Record<string, unknown>[]>([])
    const [importing, setImporting] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    function handleFile(file: File) {
        const reader = new FileReader()
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer)
            const wb = XLSX.read(data, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            // raw: false converts dates to strings like "m/d/yy" or "dd/mm/yyyy" based on cell format
            const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false })
            setRows(json)
        }
        reader.readAsArrayBuffer(file)
    }

    async function confirmImport() {
        if (rows.length === 0) return
        setImporting(true)

        // Função de normalização para comparação de nomes (remove acentos, espaços extras e caixa alta)
        const norm = (s: string) => s.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .replace(/\s+/g, ' ');

        const varMap: Record<string, string> = {}
        variedades.forEach(v => { varMap[norm(v.nome)] = v.id })
        const prodMap: Record<string, string> = {}
        produtores.forEach(p => { prodMap[norm(p.nome)] = p.id })
        const armMap: Record<string, string> = {}
        armazens.forEach(a => { armMap[norm(a.nome)] = a.id })

        const payload = rows.map((r, i) => {

            const rawCat = String(r['Classificação'] ?? r['classificacao'] ?? '').toUpperCase()

            let cleanCat: Classificacao = 'CAT1' // Default
            if (rawCat.includes('3') || rawCat.includes('III')) cleanCat = 'CAT3'
            else if (rawCat.includes('2') || rawCat.includes('II')) cleanCat = 'CAT2'
            else if (rawCat.includes('1') || rawCat.includes('I')) cleanCat = 'CAT1'
            else if (rawCat.includes('CAT1')) cleanCat = 'CAT1'
            else if (rawCat.includes('CAT2')) cleanCat = 'CAT2'
            else if (rawCat.includes('CAT3')) cleanCat = 'CAT3'

            // Função mais robusta para converter datas do Excel pro banco
            const parseDate = (val: unknown) => {
                if (!val) return new Date().toISOString().slice(0, 10);
                let str = String(val).trim();

                // Se for DD/MM/YYYY
                if (str.includes('/')) {
                    const parts = str.split('/');
                    if (parts.length === 3) {
                        return `${parts[2].length === 2 ? '20' + parts[2] : parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    }
                }

                // Tenta limpar strings com hora (ex: "2026 19:01:05-01-30" -> pegar só parte da data se possível)
                // Ou apenas tenta converter via JavaScript nativo
                try {
                    const d = new Date(str);
                    if (!isNaN(d.getTime())) {
                        return d.toISOString().slice(0, 10);
                    }
                } catch (e) {
                    // ignora erro e tenta fallback
                }

                // Se cair aqui, a data é inválida ou estranha, retorna hoje por segurança
                return new Date().toISOString().slice(0, 10);
            }

            return {
                data_estoque: parseDate(r['Data Estoque'] ?? r['data_estoque']),
                data_entrada: parseDate(r['Data Entrada'] ?? r['data_entrada']),
                numero_palete: String(r['Nº Palete'] ?? r['Numero Palete'] ?? r['numero_palete'] ?? `IMP-${Date.now()}-${i}`),
                descricao: String(r['Descrição'] ?? r['descricao'] ?? ''),
                caixas: Number(r['Caixas'] ?? r['caixas'] ?? 0),
                peso_caixa: Number(r['Peso Caixa'] ?? r['peso_caixa'] ?? 0),
                mascaro: String(r['Mascaro'] ?? r['mascaro'] ?? ''),
                variedade_id: varMap[norm(String(r['Variedade'] ?? r['variedade'] ?? ''))] ?? null,
                produtor_id: prodMap[norm(String(r['Produtor'] ?? r['produtor'] ?? ''))] ?? null,
                classificacao: cleanCat,
                embalagem: String(r['Embalagem'] ?? r['embalagem'] ?? ''),
                marca: String(r['Marca'] ?? r['marca'] ?? ''),
                armazem_id: armMap[norm(String(r['Armazém'] ?? r['Armazem'] ?? r['armazem'] ?? ''))] ?? null,

                status: 'disponivel' as const,
            }
        })

        // Remover duplicatas de dentro do arquivo Excel (evita o erro "command cannot affect row a second time")
        // Ficamos apenas com a última ocorrência de cada Nº Palete presente no arquivo
        const uniquePayload = Array.from(
            payload.reduce((map, item) => {
                map.set(item.numero_palete, item);
                return map;
            }, new Map<string, typeof payload[0]>()).values()
        )

        // Buscar status atuais no banco para não sobrescrever paletes que já foram expedidos/reservados
        const paleteNumbers = uniquePayload.map(p => p.numero_palete)

        // Em caso de muitos itens, seria ideal dividir em chunks, mas para planilhas típicas isso é OK
        const { data: existingPaletes } = await supabase
            .from('estoque')
            .select('numero_palete, status')
            .in('numero_palete', paleteNumbers)

        if (existingPaletes && existingPaletes.length > 0) {
            const statusMap = new Map()
            existingPaletes.forEach(p => statusMap.set(p.numero_palete, p.status))

            uniquePayload.forEach(p => {
                if (statusMap.has(p.numero_palete)) {
                    p.status = statusMap.get(p.numero_palete)
                }
            })
        }

        const { error } = await supabase
            .from('estoque')
            .upsert(uniquePayload, { onConflict: 'numero_palete' })

        setImporting(false)
        if (error) { toast.error('Erro na importação: ' + error.message) }
        else { toast.success(`${payload.length} paletes processados!`); onSuccess() }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-border">

                {/* Header - Fixed */}
                <div className="p-6 pb-4 border-b border-border flex items-center justify-between flex-shrink-0">

                    <h2 className="text-lg font-bold text-foreground">Importar Excel</h2>

                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                        onClick={() => fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-400'}`}
                    >
                        <FileUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-600">Arraste um arquivo .xlsx ou clique para selecionar</p>
                        <p className="text-xs text-gray-400 mt-1">Máximo 5 MB</p>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                    </div>

                    {rows.length > 0 && (
                        <div className="mt-4">
                            <p className="text-sm font-medium text-foreground/80 mb-2">
                                {rows.length} linhas detectadas. Preview (primeiras 5 linhas):</p>
                            <div className="overflow-x-auto border border-gray-100 rounded-xl">
                                <table className="text-xs w-full">
                                    <thead><tr>{Object.keys(rows[0]).slice(0, 6).map(k => <th key={k} className="table-header">{k}</th>)}</tr></thead>
                                    <tbody>{rows.slice(0, 5).map((r, i) => (
                                        <tr key={i}>{Object.values(r).slice(0, 6).map((v, j) => <td key={j} className="table-cell">{String(v)}</td>)}</tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer - Fixed */}
                <div className="p-6 pt-4 border-t border-gray-100 flex gap-3 justify-end flex-shrink-0">
                    <button onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button onClick={confirmImport} disabled={rows.length === 0 || importing} className="btn-primary">
                        {importing ? 'Importando...' : '✅ Confirmar Importação'}
                    </button>
                </div>
            </div>
        </div>
    )
}
