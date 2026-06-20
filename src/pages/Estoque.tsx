import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, calcDaysFromDate, formatCurrency } from '../lib/utils'
import type { EstoquePalete, Classificacao, Variedade, Produtor, Armazem, Comprador, Pedido } from '../lib/types'

import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
    FileDown, FileUp, ClipboardList, X, ChevronLeft, ChevronRight,
    Trash2, RefreshCw, Plus, Layers
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
    const [showAddPalete, setShowAddPalete] = useState(false)
    const [frioAlertMode, setFrioAlertMode] = useState(false)
    const [frioData, setFrioData] = useState<EstoquePalete[]>([])
    const [frioImportAlert, setFrioImportAlert] = useState<EstoquePalete[]>([])

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
            .select('*, variedade_id, variedade:variedade_id(nome), produtor_id, produtor:produtor_id(nome), armazem_id, armazem:armazem_id(nome, custo_dia_frio, limite_dias_frio, custo_dia_excedente)', { count: 'exact' })
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
                if ((armazemNome.includes('camara') || armazemNome.includes('gvs') || armazemNome.includes('caj')) && row.data_entrada) {
                    if ((now.getTime() - new Date(row.data_entrada).getTime()) / 86400000 >= 7) f++
                }
            })
            setTotais({ caixas: c, peso: p, frios: f })
        }

        setLoading(false)
    }, [page, fClassificacao, fVariedade, fProdutor, fArmazem, fDataInicio, fDataFim, fSomenteDisponivel])


    useEffect(() => { fetchPaletes() }, [fetchPaletes])

    async function fetchFrioData() {
        const { data } = await supabase
            .from('estoque')
            .select('*, variedade:variedade_id(nome), produtor:produtor_id(nome), armazem:armazem_id(nome, custo_dia_frio, limite_dias_frio, custo_dia_excedente)')
            .neq('status', 'expedido')
            .order('data_entrada', { ascending: true })
        const camara = (data ?? []).filter((p: any) => {
            const nome: string = p.armazem?.nome?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? ''
            return nome.includes('camara') || nome.includes('gvs') || nome.includes('caj')
        })
        setFrioData(camara as EstoquePalete[])
    }

    useEffect(() => { if (frioAlertMode) fetchFrioData() }, [frioAlertMode])

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


    async function handleImportSuccess() {
        setShowImport(false)
        fetchPaletes()
        const { data } = await supabase
            .from('estoque')
            .select('*, armazem:armazem_id(nome, custo_dia_frio, limite_dias_frio, custo_dia_excedente)')
            .neq('status', 'expedido')
        const hoje = new Date()
        const atRisk = ((data ?? []) as EstoquePalete[]).filter(p => {
            const arm = p.armazem as { nome?: string; limite_dias_frio?: number } | null
            const nome = arm?.nome?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? ''
            if (!nome.includes('camara') && !nome.includes('gvs') && !nome.includes('caj')) return false
            const limite = arm?.limite_dias_frio ?? 7
            const dias = p.data_entrada ? Math.floor((hoje.getTime() - new Date(p.data_entrada).getTime()) / 86400000) : 0
            return dias > limite || (limite - dias) <= 0
        }).sort((a, b) => {
            const da = a.data_entrada ? Math.floor((hoje.getTime() - new Date(a.data_entrada).getTime()) / 86400000) : 0
            const db = b.data_entrada ? Math.floor((hoje.getTime() - new Date(b.data_entrada).getTime()) / 86400000) : 0
            return db - da
        })
        if (atRisk.length > 0) setFrioImportAlert(atRisk)
    }

    async function deleteSelected() {
        if (selected.size === 0) return
        if (!confirm(`Excluir ${selected.size} palete(s) permanentemente? Esta ação não pode ser desfeita.`)) return
        const ids = Array.from(selected)
        const { error } = await supabase.from('estoque').delete().in('id', ids)
        if (error) {
            toast.error('Erro ao excluir: ' + error.message)
        } else {
            toast.success(`${ids.length} palete(s) excluído(s)`)
            setSelected(new Set())
            fetchPaletes()
        }
    }

    const _hoje = new Date()
    const tableData = frioAlertMode
        ? frioData
            .filter(p => {
                const arm = p.armazem as { limite_dias_frio?: number } | null
                const limite = arm?.limite_dias_frio ?? 7
                const dias = p.data_entrada ? Math.floor((_hoje.getTime() - new Date(p.data_entrada).getTime()) / 86400000) : 0
                return dias > limite || (limite - dias) <= 0
            })
            .sort((a, b) => {
                const da = a.data_entrada ? Math.floor((_hoje.getTime() - new Date(a.data_entrada).getTime()) / 86400000) : 0
                const db = b.data_entrada ? Math.floor((_hoje.getTime() - new Date(b.data_entrada).getTime()) / 86400000) : 0
                return db - da
            })
        : paletes

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
                        {selected.size > 0 && (
                            <button onClick={deleteSelected} className="btn-danger text-sm py-2">
                                <Trash2 className="w-4 h-4" /> Excluir {selected.size} selecionado(s)
                            </button>
                        )}
                        <button onClick={() => setShowAddPalete(true)} className="btn-gold text-sm py-2">
                            <Plus className="w-4 h-4" /> Adicionar
                        </button>
                        <button onClick={() => setShowImport(true)} className="btn-secondary text-sm py-2">
                            <FileUp className="w-4 h-4" /> Importar Excel
                        </button>
                        <button onClick={exportExcel} className="btn-secondary text-sm py-2">
                            <FileDown className="w-4 h-4" /> Exportar Excel
                        </button>
                        <button onClick={fetchPaletes} className="btn-secondary text-sm py-2 group" title="Recarregar dados">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} /> Atualizar
                        </button>
                        <button onClick={syncPaletes} className="btn-secondary text-sm py-2" title="Sincronizar status com expedição">
                            <RefreshCw className="w-4 h-4" /> Sincronizar
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
                <button
                    onClick={() => setFrioAlertMode(p => !p)}
                    className={`card text-left transition-all hover:border-brand-400 ${frioAlertMode ? 'ring-2 ring-warning border-warning' : ''}`}
                >
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">⚠ Alerta Frios</p>
                    <h3 className="text-2xl font-black text-warning leading-none">{totais.frios}</h3>
                    <p className="text-[10px] text-muted mt-1">{frioAlertMode ? 'Sair do modo alerta' : 'Filtrar tabela'}</p>
                </button>
            </div>

            {/* Alerta Frios Banner */}
            {frioAlertMode && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <p className="text-sm font-bold text-warning flex items-center gap-2">
                        ❄️ Modo Alerta Frios — paletes em câmara fria que precisam de atenção, ordenados por urgência
                    </p>
                    <button onClick={() => setFrioAlertMode(false)} className="text-muted hover:text-foreground flex items-center gap-1 text-xs font-semibold ml-4 flex-shrink-0">
                        <X className="w-3.5 h-3.5" /> Sair
                    </button>
                </div>
            )}

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
                                    <th className="table-header w-10 sticky left-0 z-20"><input type="checkbox" className="accent-brand-600" onChange={e => {
                                        if (e.target.checked) setSelected(new Set(paletes.filter(p => p.status === 'disponivel').map(p => p.id)))
                                        else setSelected(new Set())
                                    }} /></th>
                                    <ResizableHeader initialWidth={130}>DATA EST.</ResizableHeader>
                                    <ResizableHeader initialWidth={130}>DATA ENT.</ResizableHeader>
                                    <ResizableHeader initialWidth={160} className="sticky left-10 z-20 bg-[var(--background)]">Nº PALETE</ResizableHeader>
                                    <ResizableHeader initialWidth={110}>IDADE</ResizableHeader>
                                    <ResizableHeader initialWidth={120}>DIAS FRIO</ResizableHeader>
                                    <ResizableHeader initialWidth={130} className="text-right">CUSTO FRIO</ResizableHeader>
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
                                {tableData.map(p => {
                                    const diasFrio = calcDaysFromDate(p.data_entrada)
                                    const idadePalete = calcDaysFromDate(p.data_entrada)
                                    const firoAlert = diasFrio >= 7
                                    return (
                                        <tr key={p.id} className={`hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-colors ${selected.has(p.id) ? 'bg-brand-500/10 dark:bg-brand-500/20 shadow-[inset_4px_0_0_0_#C9A236]' : ''}`}>

                                            <td className="table-cell-sticky left-0">
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
                                            <td className="table-cell-sticky left-10 font-mono font-medium text-brand-700">{p.numero_palete}</td>
                                            <td className="table-cell whitespace-nowrap">{idadePalete}d</td>
                                            <td className="table-cell whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${firoAlert ? 'text-danger' : 'text-blue-500'}`}>
                                                    <span className={`w-2 h-2 rounded-full ${firoAlert ? 'bg-danger' : 'bg-blue-400'}`} />
                                                    {diasFrio}d
                                                </span>
                                            </td>
                                            <td className="table-cell text-right whitespace-nowrap">
                                                {(() => {
                                                    const arm = p.armazem as { custo_dia_frio?: number; limite_dias_frio?: number; custo_dia_excedente?: number } | null
                                                    if (!arm?.custo_dia_frio) return <span className="text-muted">—</span>
                                                    const lim = arm.limite_dias_frio ?? Infinity
                                                    const excedente = arm.custo_dia_excedente ?? arm.custo_dia_frio
                                                    const custo = diasFrio <= lim
                                                        ? diasFrio * arm.custo_dia_frio
                                                        : lim * arm.custo_dia_frio + (diasFrio - lim) * excedente
                                                    const isExc = diasFrio > lim
                                                    return <span className={`font-semibold ${isExc ? 'text-danger' : 'text-foreground'}`}>{formatCurrency(custo)}</span>
                                                })()}
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
                                {tableData.length === 0 && (
                                    <tr><td colSpan={19} className="table-cell text-center text-gray-400 py-12">
                                        {frioAlertMode ? '✅ Nenhum palete em situação crítica' : 'Nenhum palete encontrado'}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {frioAlertMode && <p className="text-xs text-muted text-center py-2">{tableData.length} paletes em situação crítica</p>}
                <div className={`flex items-center justify-between pt-4 border-t border-gray-100 mt-2 ${frioAlertMode ? 'hidden' : ''}`}>
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
            {showImport && <ImportModal onClose={() => setShowImport(false)} onSuccess={handleImportSuccess} variedades={variedades} produtores={produtores} armazens={armazens} />}
            {frioImportAlert.length > 0 && <FrioImportAlertModal paletes={frioImportAlert} onClose={() => setFrioImportAlert([])} />}

            {/* Adicionar Palete Manual */}
            {showAddPalete && <AddPaleteModal onClose={() => setShowAddPalete(false)} onSuccess={() => { setShowAddPalete(false); fetchPaletes() }} variedades={variedades} produtores={produtores} armazens={armazens} />}



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
                                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--accent)]">Em Massa:</span>
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
    const [step, setStep] = useState<'config' | 'upload'>('config')
    const [configDate, setConfigDate] = useState(new Date().toISOString().slice(0, 10))
    const [configArmazem, setConfigArmazem] = useState('')
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

        // Extrai o nome do produtor de LOCAL_ESTOQUE (sufixo após o primeiro "-")
        const extrairProdutor = (local: string): string => {
            const idx = local.indexOf('-')
            return idx >= 0 ? local.slice(idx + 1).trim() : local.trim()
        }

        // Busca fresca do banco para garantir maps atualizados (independente da prop)
        const [{ data: varFresh }, { data: prodFresh }] = await Promise.all([
            supabase.from('variedades').select('id, nome'),
            supabase.from('produtores').select('id, nome'),
        ])
        if (varFresh) varFresh.forEach(v => { varMap[norm(v.nome)] = v.id })
        if (prodFresh) prodFresh.forEach(p => { prodMap[norm(p.nome)] = p.id })

        // Cria produtores e variedades ausentes
        const novosNomes = new Set<string>()
        rows.forEach(r => {
            const direto = String(r['Produtor'] ?? r['produtor'] ?? '').trim()
            const nome = direto || extrairProdutor(String(r['LOCAL_ESTOQUE'] ?? r['Local Estoque'] ?? '').trim())
            if (nome && !prodMap[norm(nome)]) novosNomes.add(nome)
        })
        if (novosNomes.size > 0) {
            await supabase.from('produtores')
                .insert(Array.from(novosNomes).map(nome => ({ nome, status: 'ativo' })))
            const { data: todosProd } = await supabase.from('produtores').select('id, nome')
            if (todosProd) todosProd.forEach(p => { prodMap[norm(p.nome)] = p.id })
        }

        const novasVariedades = new Set<string>()
        rows.forEach(r => {
            const nome = String(r['Variedade'] ?? r['variedade'] ?? r['VARIEDADE'] ?? '').trim()
            if (nome && !varMap[norm(nome)]) novasVariedades.add(nome)
        })
        if (novasVariedades.size > 0) {
            const { error: errVar } = await supabase.from('variedades')
                .insert(Array.from(novasVariedades).map(nome => ({ nome })))
            if (errVar) toast.error('Erro ao criar variedades: ' + errVar.message)
            const { data: todasVar } = await supabase.from('variedades').select('id, nome')
            if (todasVar) todasVar.forEach(v => { varMap[norm(v.nome)] = v.id })
        }

        const payload = rows.map((r, _i) => {

            // Suporte a dois formatos de cabeçalho:
            // Formato A (sistema): "Classificação", "Nº Palete", "Data Estoque", etc.
            // Formato B (CSV externo): "MERCADO" (MI=CAT1, vazio=CAT3), "PALLET", "DATA", etc.
            const rawCat = String(r['Classificação'] ?? r['classificacao'] ?? '').toUpperCase()
            const rawMercado = String(r['MERCADO'] ?? r['Mercado'] ?? r['mercado'] ?? '').trim().toUpperCase()

            let cleanCat: Classificacao
            if (rawCat.includes('3') || rawCat.includes('III')) cleanCat = 'CAT3'
            else if (rawCat.includes('2') || rawCat.includes('II')) cleanCat = 'CAT2'
            else if (rawCat.includes('1') || rawCat.includes('I')) cleanCat = 'CAT1'
            else if (rawMercado === 'MI') cleanCat = 'CAT1'
            else if (rawMercado === '') cleanCat = 'CAT3'
            else cleanCat = 'CAT1'

            const parseDate = (val: unknown) => {
                if (!val) return new Date().toISOString().slice(0, 10);
                let str = String(val).trim();

                // Remove parte de hora se vier junto (ex: "15/05/2026 20:05:45")
                if (str.includes(' ')) str = str.split(' ')[0];

                if (str.includes('/')) {
                    const parts = str.split('/');
                    if (parts.length === 3) {
                        return `${parts[2].length === 2 ? '20' + parts[2] : parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    }
                }

                try {
                    const d = new Date(str);
                    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
                } catch (_) { /* ignora */ }

                return new Date().toISOString().slice(0, 10);
            }

            // data_entrada vem da coluna DATA do arquivo (data original do palete)
            const dataB = r['DATA'] ?? r['Data']
            const dataEntrada = r['Data Entrada'] ?? r['data_entrada'] ?? dataB

            const diasFrio = r['DIAS_FRIO'] ?? r['Dias Frio'] ?? r['dias_frio']

            const pesoCaixa = (() => {
                const raw = r['Peso Caixa'] ?? r['peso_caixa'] ?? r['PESO'] ?? r['Peso']
                if (raw != null && raw !== '') return Number(String(raw).replace(',', '.'))
                const match = String(r['PRODUTO'] ?? r['Produto'] ?? r['Descrição'] ?? r['descricao'] ?? '').match(/(\d+[,.]?\d*)\s*[Kk]g/)
                return match ? Number(match[1].replace(',', '.')) : 0
            })()

            // Embalagem automática por peso quando não informada explicitamente
            const embalagemCSV = String(r['Embalagem'] ?? r['embalagem'] ?? '').trim()
            const embalagem = embalagemCSV || (pesoCaixa === 5 ? 'Caixa 5kg' : pesoCaixa === 8 ? 'Caixa 8kg' : '')

            // Armazém: usa o selecionado no passo 1 se informado, senão tenta coluna da planilha
            const armazem_id = configArmazem || (armMap[norm(String(r['Armazém'] ?? r['Armazem'] ?? r['armazem'] ?? r['LOCAL_ESTOQUE'] ?? r['Local Estoque'] ?? ''))] ?? null)

            return {
                data_estoque: configDate,
                data_entrada: parseDate(dataEntrada),
                numero_palete: (() => {
                    const raw = String(r['Nº Palete'] ?? r['Numero Palete'] ?? r['numero_palete'] ?? r['PALLET'] ?? r['Pallet'] ?? '').trim()
                    // "PICADO" e valores não numéricos recebem número único P + 7 dígitos aleatórios
                    if (!raw || raw.toUpperCase() === 'PICADO') return `P${Math.floor(1000000 + Math.random() * 9000000)}`
                    return raw
                })(),
                descricao: String(r['Descrição'] ?? r['descricao'] ?? r['PRODUTO'] ?? r['Produto'] ?? ''),
                caixas: Number(String(r['Caixas'] ?? r['caixas'] ?? r['QTD_CX'] ?? r['Qtd Cx'] ?? 0).replace(',', '.')),
                peso_caixa: pesoCaixa,
                mascaro: String(r['Mascaro'] ?? r['mascaro'] ?? r['NUMERO_TERCEIRO'] ?? r['Numero Terceiro'] ?? ''),
                variedade_id: varMap[norm(String(r['Variedade'] ?? r['variedade'] ?? r['VARIEDADE'] ?? ''))] ?? null,
                produtor_id: (() => {
                    const direto = String(r['Produtor'] ?? r['produtor'] ?? '').trim()
                    const nome = direto || extrairProdutor(String(r['LOCAL_ESTOQUE'] ?? r['Local Estoque'] ?? '').trim())
                    return prodMap[norm(nome)] ?? null
                })(),
                classificacao: cleanCat,
                embalagem,
                marca: (() => {
                    const fromCol = String(r['Marca'] ?? r['marca'] ?? '').trim()
                    if (fromCol) return fromCol
                    // Extrai da descrição: "... - CINTA DOCE DIVERSAO" → "DOCE DIVERSAO"
                    const produto = String(r['PRODUTO'] ?? r['Produto'] ?? r['Descrição'] ?? r['descricao'] ?? '')
                    const match = produto.match(/(?:CINTA|ETIQUETA)\s+(.+)$/i)
                    return match ? match[1].trim() : ''
                })(),
                armazem_id,
                dias_frio: diasFrio != null && diasFrio !== '' ? Number(diasFrio) : null,
                mercado: rawMercado || (String(r['Mercado'] ?? '').trim()) || null,
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

        if (!error) {
            // Alimenta a base de templates com as descrições únicas desta importação
            const rawTemplates = uniquePayload
                .filter(p => p.descricao && p.variedade_id)
                .map(p => ({
                    descricao: p.descricao,
                    variedade_id: p.variedade_id ?? null,
                    classificacao: p.classificacao ?? null,
                    peso_caixa: p.peso_caixa ?? null,
                    embalagem: p.embalagem ?? null,
                    marca: p.marca ?? null,
                }))
            const uniqueTemplates = Array.from(new Map(rawTemplates.map(t => [t.descricao, t])).values())
            if (uniqueTemplates.length > 0) {
                await supabase.from('produto_templates').upsert(uniqueTemplates, { onConflict: 'descricao' })
            }
        }

        setImporting(false)
        if (error) { toast.error('Erro na importação: ' + error.message) }
        else { toast.success(`${payload.length} paletes processados!`); onSuccess() }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-border">

                {/* Header */}
                <div className="p-6 pb-4 border-b border-border flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Importar Excel</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Passo {step === 'config' ? '1' : '2'} de 2 — {step === 'config' ? 'Configurar importação' : 'Selecionar arquivo'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">

                    {step === 'config' ? (
                        <div className="flex flex-col gap-5">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Data de Entrada no Estoque</label>
                                <input
                                    type="date"
                                    value={configDate}
                                    onChange={e => setConfigDate(e.target.value)}
                                    className="input w-full"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Será aplicada a todos os paletes do arquivo.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Armazém <span className="text-red-500">*</span></label>
                                <select
                                    value={configArmazem}
                                    onChange={e => setConfigArmazem(e.target.value)}
                                    className="input w-full"
                                >
                                    <option value="">— Selecione um armazém —</option>
                                    {armazens.map(a => (
                                        <option key={a.id} value={a.id}>{a.nome}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">Obrigatório para continuar.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 p-3 bg-muted/40 rounded-xl text-xs text-muted-foreground flex gap-4">
                                <span><span className="font-medium text-foreground">Data:</span> {configDate}</span>
                                <span><span className="font-medium text-foreground">Armazém:</span> {configArmazem ? (armazens.find(a => a.id === configArmazem)?.nome ?? '—') : 'da planilha'}</span>
                            </div>
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
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 border-t border-gray-100 flex gap-3 justify-end flex-shrink-0">
                    {step === 'config' ? (
                        <>
                            <button onClick={onClose} className="btn-secondary">Cancelar</button>
                            <button onClick={() => setStep('upload')} disabled={!configDate || !configArmazem} className="btn-primary">
                                Próximo →
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setStep('config')} className="btn-secondary">← Voltar</button>
                            <button onClick={confirmImport} disabled={rows.length === 0 || importing} className="btn-primary">
                                {importing ? 'Importando...' : '✅ Confirmar Importação'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Modal: Adicionar Paletes Manualmente ─────────────────────────────────────

interface ProdutoTemplate {
    id: string
    descricao: string
    variedade_id: string | null
    classificacao: string | null
    peso_caixa: number | null
    embalagem: string | null
    marca: string | null
}

interface AddLinha {
    id: string
    template_id: string
    template: ProdutoTemplate | null
    classificacao: string
    caixas: string
}

const LINHA_VAZIA = (): AddLinha => ({
    id: String(Date.now() + Math.random()),
    template_id: '',
    template: null,
    classificacao: 'CAT1',
    caixas: '',
})

// ── Modal de Alerta Frio pós-importação ───────────────────────────────────────
function FrioImportAlertModal({ paletes, onClose }: { paletes: EstoquePalete[]; onClose: () => void }) {
    const hoje = new Date()
    const withDias = paletes.map(p => {
        const arm = p.armazem as { nome?: string; limite_dias_frio?: number } | null
        const limite = arm?.limite_dias_frio ?? 7
        const dias = p.data_entrada ? Math.floor((hoje.getTime() - new Date(p.data_entrada).getTime()) / 86400000) : 0
        return { ...p, dias, limite, emExcedente: dias > limite }
    })

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-border">
                <div className="p-6 pb-4 border-b border-border flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">❄️ Alerta de Câmara Fria</h2>
                        <p className="text-xs text-danger font-semibold mt-0.5">
                            {paletes.length} palete(s) precisam de atenção imediata
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                    {withDias.map(p => (
                        <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${p.emExcedente ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : 'border-amber-200 bg-amber-50 dark:bg-amber-900/10'}`}>
                            <div className="min-w-0 flex-1">
                                <span className="font-mono text-xs font-bold text-foreground">{p.numero_palete}</span>
                                <p className="text-xs text-muted truncate">{p.descricao ?? (p.variedade as any)?.nome ?? '—'}</p>
                                <p className="text-[10px] text-muted">{(p.armazem as any)?.nome} · entrada {formatDate(p.data_entrada)}</p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                                <p className={`text-xl font-black ${p.emExcedente ? 'text-danger' : 'text-warning'}`}>{p.dias}d</p>
                                <p className="text-[10px] text-muted">{p.emExcedente ? `+${p.dias - p.limite}d excedente` : 'vence hoje'}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-border flex justify-end flex-shrink-0">
                    <button onClick={onClose} className="btn-primary">Entendido</button>
                </div>
            </div>
        </div>
    )
}

// ── Painel de Câmara Fria (inativo — substituído pelo modo alerta na tabela) ──
function _FrioPainel({ paletes, onClose, onReload }: {
    paletes: EstoquePalete[]
    onClose: () => void
    onReload: () => void
}) {
    const hoje = new Date()

    const comDias = paletes.map(p => {
        const dias = p.data_entrada
            ? Math.floor((hoje.getTime() - new Date(p.data_entrada).getTime()) / 86400000)
            : 0
        const arm = p.armazem as { nome: string; custo_dia_frio?: number; limite_dias_frio?: number; custo_dia_excedente?: number } | null
        const limite = arm?.limite_dias_frio ?? 7
        const custoDia = arm?.custo_dia_frio ?? 0
        const custoExc = arm?.custo_dia_excedente ?? custoDia
        const custoTotal = custoDia > 0
            ? dias <= limite
                ? dias * custoDia
                : limite * custoDia + (dias - limite) * custoExc
            : null
        const diasRestantes = limite - dias
        const emExcedente = dias > limite
        return { ...p, dias, limite, custoTotal, diasRestantes, emExcedente, arm }
    }).sort((a, b) => b.dias - a.dias)

    const emExcedente = comDias.filter(p => p.emExcedente)
    const vencendoHoje = comDias.filter(p => p.diasRestantes === 0)
    const vencendoBreve = comDias.filter(p => p.diasRestantes > 0 && p.diasRestantes <= 2)
    const seguros = comDias.filter(p => p.diasRestantes > 2)
    const totalCustoExcedente = emExcedente.reduce((s, p) => s + (p.custoTotal ?? 0), 0)

    const faixas = [
        { label: 'Em Excedente (pagando a mais)', itens: emExcedente, cor: 'text-danger', bg: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800', dot: 'bg-danger' },
        { label: 'Vence hoje / amanhã', itens: [...vencendoHoje, ...vencendoBreve], cor: 'text-warning', bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700', dot: 'bg-warning' },
        { label: 'Dentro do prazo', itens: seguros, cor: 'text-success', bg: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800', dot: 'bg-success' },
    ]

    return (
        <div className="card border-warning/40 bg-amber-50/30 dark:bg-amber-900/5 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-black text-foreground flex items-center gap-2">
                        ❄️ Painel de Câmara Fria
                        <span className="text-xs font-semibold text-muted">({paletes.length} paletes monitorados)</span>
                    </h2>
                    {emExcedente.length > 0 && (
                        <p className="text-sm text-danger font-semibold mt-0.5">
                            {emExcedente.length} palete(s) em excedente — custo estimado: {formatCurrency(totalCustoExcedente)}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onReload} className="btn-secondary text-xs py-1.5">↻ Atualizar</button>
                    <button onClick={onClose} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
            </div>

            {paletes.length === 0 ? (
                <p className="text-center text-muted text-sm py-6">Nenhum palete em câmara fria encontrado.</p>
            ) : (
                <div className="space-y-4">
                    {faixas.map(faixa => faixa.itens.length === 0 ? null : (
                        <div key={faixa.label}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${faixa.dot} flex-shrink-0`} />
                                <h3 className={`text-xs font-black uppercase tracking-widest ${faixa.cor}`}>
                                    {faixa.label} ({faixa.itens.length})
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                {faixa.itens.map(p => (
                                    <div key={p.id} className={`p-3 rounded-xl border ${faixa.bg} flex items-center gap-3`}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-xs font-bold text-foreground">{p.numero_palete}</span>
                                                <span className="text-[10px] text-muted bg-white/60 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded">
                                                    {(p.armazem as any)?.nome ?? '—'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted mt-0.5 truncate">{p.descricao ?? `${(p.variedade as any)?.nome ?? ''}`}</p>
                                            <p className="text-xs text-muted">{p.caixas} cx · entrada {formatDate(p.data_entrada)}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className={`text-lg font-black ${p.emExcedente ? 'text-danger' : p.diasRestantes <= 2 ? 'text-warning' : 'text-success'}`}>
                                                {p.dias}d
                                            </p>
                                            <p className="text-[10px] text-muted">
                                                {p.emExcedente
                                                    ? `+${p.dias - p.limite}d excedente`
                                                    : p.diasRestantes === 0 ? 'vence hoje'
                                                    : `${p.diasRestantes}d restantes`}
                                            </p>
                                            {p.custoTotal != null && (
                                                <p className={`text-xs font-bold mt-0.5 ${p.emExcedente ? 'text-danger' : 'text-muted'}`}>
                                                    {formatCurrency(p.custoTotal)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function AddPaleteModal({ onClose, onSuccess, produtores, armazens }: {
    onClose: () => void
    onSuccess: () => void
    variedades: Variedade[]
    produtores: Produtor[]
    armazens: Armazem[]
}) {
    const [produtor_id, setProdutorId] = useState('')
    const [armazem_id, setArmazemId] = useState('')
    const [data, setData] = useState(new Date().toISOString().slice(0, 10))
    const [cxPorPalete, setCxPorPalete] = useState('110')
    const [linhas, setLinhas] = useState<AddLinha[]>([LINHA_VAZIA()])
    const [templates, setTemplates] = useState<ProdutoTemplate[]>([])
    const [loadingTemplates, setLoadingTemplates] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        supabase
            .from('produto_templates')
            .select('*')
            .order('descricao')
            .then(({ data }) => {
                setTemplates((data ?? []) as ProdutoTemplate[])
                setLoadingTemplates(false)
            })
    }, [])

    function addLinha() {
        setLinhas(prev => [...prev, LINHA_VAZIA()])
    }

    function removeLinha(id: string) {
        setLinhas(prev => prev.filter(l => l.id !== id))
    }

    function selectTemplate(linhaId: string, templateId: string) {
        const tpl = templates.find(t => t.id === templateId) ?? null
        setLinhas(prev => prev.map(l =>
            l.id === linhaId
                ? { ...l, template_id: templateId, template: tpl, classificacao: tpl?.classificacao ?? l.classificacao }
                : l
        ))
    }

    function updateCaixas(linhaId: string, value: string) {
        setLinhas(prev => prev.map(l => l.id === linhaId ? { ...l, caixas: value } : l))
    }

    function updateClassificacao(linhaId: string, value: string) {
        setLinhas(prev => prev.map(l => l.id === linhaId ? { ...l, classificacao: value } : l))
    }

    const cxPP = Math.max(1, Number(cxPorPalete) || 110)

    interface PreviewItem {
        descricao: string
        cat: string
        tipo: 'COMPLETO' | 'PICADO'
        caixas: number
        variedade_id: string | null
        peso_caixa: number | null
        embalagem: string | null
        marca: string | null
    }

    const previewItems: PreviewItem[] = linhas.flatMap(l => {
        const total = Number(l.caixas) || 0
        if (total === 0 || !l.template) return []
        const tpl = l.template
        const cat = l.classificacao
        const full = Math.floor(total / cxPP)
        const remainder = total % cxPP
        const items: PreviewItem[] = []
        for (let i = 0; i < full; i++) {
            items.push({ descricao: tpl.descricao, cat, tipo: 'COMPLETO', caixas: cxPP, variedade_id: tpl.variedade_id, peso_caixa: tpl.peso_caixa, embalagem: tpl.embalagem, marca: tpl.marca })
        }
        if (remainder > 0) {
            items.push({ descricao: `PICADO - ${tpl.descricao}`, cat, tipo: 'PICADO', caixas: remainder, variedade_id: tpl.variedade_id, peso_caixa: tpl.peso_caixa, embalagem: tpl.embalagem, marca: tpl.marca })
        }
        return items
    })

    async function save() {
        if (!produtor_id) { toast.error('Selecione o produtor'); return }
        if (!armazem_id) { toast.error('Selecione o armazém'); return }
        const linhasValidas = linhas.filter(l => l.template && Number(l.caixas) > 0)
        if (linhasValidas.length === 0) { toast.error('Informe ao menos uma linha com produto e quantidade'); return }

        setSaving(true)
        const dateStr = data || new Date().toISOString().slice(0, 10)

        // Prefixo: 3 primeiras letras do nome do armazém (só letras, maiúsculas)
        const armNome = armazens.find(a => a.id === armazem_id)?.nome ?? 'MAN'
        const prefixo = armNome.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X')

        // Conta total atual do estoque para gerar sequencial
        const { count: estoqueCount } = await supabase
            .from('estoque')
            .select('*', { count: 'exact', head: true })
        let seq = (estoqueCount ?? 0) + 1

        const records = linhasValidas.flatMap(l => {
            const tpl = l.template!
            const cat = (l.classificacao || tpl.classificacao || 'CAT1') as Classificacao
            const total = Number(l.caixas)
            const full = Math.floor(total / cxPP)
            const remainder = total % cxPP
            const items: any[] = []

            for (let i = 0; i < full; i++) {
                items.push({
                    numero_palete: `${prefixo}${String(seq++).padStart(7, '0')}`,
                    data_estoque: dateStr,
                    data_entrada: dateStr,
                    descricao: tpl.descricao,
                    caixas: cxPP,
                    peso_caixa: tpl.peso_caixa ?? 0,
                    variedade_id: tpl.variedade_id ?? null,
                    produtor_id,
                    classificacao: cat,
                    embalagem: tpl.embalagem ?? null,
                    marca: tpl.marca ?? null,
                    armazem_id,
                    status: 'disponivel' as const,
                })
            }

            if (remainder > 0) {
                items.push({
                    numero_palete: `${prefixo}${String(seq++).padStart(7, '0')}`,
                    data_estoque: dateStr,
                    data_entrada: dateStr,
                    descricao: `PICADO - ${tpl.descricao}`,
                    caixas: remainder,
                    peso_caixa: tpl.peso_caixa ?? 0,
                    variedade_id: tpl.variedade_id ?? null,
                    produtor_id,
                    classificacao: cat,
                    embalagem: tpl.embalagem ?? null,
                    marca: tpl.marca ?? null,
                    armazem_id,
                    status: 'disponivel' as const,
                })
            }

            return items
        })

        const { error } = await supabase.from('estoque').insert(records)
        setSaving(false)

        if (error) {
            toast.error('Erro ao salvar: ' + error.message)
        } else {
            toast.success(`${records.length} palete(s) criado(s) com sucesso!`)
            onSuccess()
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-border">

                {/* Header */}
                <div className="p-6 pb-4 border-b border-border flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Layers className="w-5 h-5 text-[var(--accent)]" />
                            Adicionar Paletes Manualmente
                        </h2>
                        <p className="text-xs text-muted mt-0.5">Produtos cadastrados automaticamente ao importar Excel</p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-foreground transition"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-5">

                    {/* Dados base */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Produtor <span className="text-red-400">*</span></label>
                            <select value={produtor_id} onChange={e => setProdutorId(e.target.value)} className="input w-full">
                                <option value="">— Selecione —</option>
                                {produtores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Armazém <span className="text-red-400">*</span></label>
                            <select value={armazem_id} onChange={e => setArmazemId(e.target.value)} className="input w-full">
                                <option value="">— Selecione —</option>
                                {armazens.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Data de Entrada</label>
                            <input type="date" value={data} onChange={e => setData(e.target.value)} className="input w-full" />
                        </div>
                        <div>
                            <label className="form-label">Caixas por Palete Completo</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    value={cxPorPalete}
                                    onChange={e => setCxPorPalete(e.target.value)}
                                    className="input w-full"
                                    placeholder="110"
                                />
                                <span className="text-xs text-muted whitespace-nowrap">cx / plt</span>
                            </div>
                            <p className="text-[10px] text-muted mt-1">Sobra vira PICADO automaticamente.</p>
                        </div>
                    </div>

                    {/* Linhas de lote */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="form-label mb-0">Produtos Recebidos</label>
                            <button onClick={addLinha} className="text-xs text-[var(--accent)] font-bold hover:opacity-80 flex items-center gap-1 transition">
                                <Plus className="w-3.5 h-3.5" /> Adicionar linha
                            </button>
                        </div>

                        {loadingTemplates ? (
                            <div className="space-y-2">
                                {[1, 2].map(i => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {templates.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted mb-1">
                                        Nenhum produto na base ainda — importe um Excel e a lista será preenchida automaticamente.
                                    </div>
                                )}
                                {linhas.map((l, idx) => (
                                    <div key={l.id} className="rounded-xl border border-border bg-[var(--background)] overflow-hidden">
                                        {/* Linha principal */}
                                        <div className="flex items-center gap-2 p-3">
                                            <span className="text-[10px] font-bold text-muted w-4 text-right flex-shrink-0">{idx + 1}</span>
                                            <select
                                                value={l.template_id}
                                                onChange={e => selectTemplate(l.id, e.target.value)}
                                                className="input flex-1 min-w-0 text-sm py-1.5 truncate"
                                            >
                                                <option value="">— Selecione o produto —</option>
                                                {templates.map(t => (
                                                    <option key={t.id} value={t.id}>{t.descricao}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={l.classificacao}
                                                onChange={e => updateClassificacao(l.id, e.target.value)}
                                                className="input w-24 flex-shrink-0 text-sm py-1.5 font-bold"
                                            >
                                                <option value="CAT1">CAT 1</option>
                                                <option value="CAT2">CAT 2</option>
                                                <option value="CAT3">CAT 3</option>
                                            </select>
                                            <div className="relative flex-shrink-0 w-28">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder="Qtd"
                                                    value={l.caixas}
                                                    onChange={e => updateCaixas(l.id, e.target.value)}
                                                    className="input w-full text-sm py-1.5 pr-7"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted font-bold">cx</span>
                                            </div>
                                            {linhas.length > 1 && (
                                                <button onClick={() => removeLinha(l.id)} className="text-muted hover:text-danger transition flex-shrink-0">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Detalhes do template selecionado */}
                                        {l.template && (
                                            <div className="px-4 pb-3 flex flex-wrap gap-3 border-t border-border/50 pt-2">
                                                {l.template.classificacao && (
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.template.classificacao === 'CAT1' ? 'badge-cat1' : l.template.classificacao === 'CAT2' ? 'badge-cat2' : 'badge-cat3'}`}>
                                                        {l.template.classificacao}
                                                    </span>
                                                )}
                                                {l.template.peso_caixa != null && (
                                                    <span className="text-[10px] text-muted font-semibold">{l.template.peso_caixa} kg/cx</span>
                                                )}
                                                {l.template.embalagem && (
                                                    <span className="text-[10px] text-muted font-semibold">{l.template.embalagem}</span>
                                                )}
                                                {l.template.marca && (
                                                    <span className="text-[10px] text-muted font-semibold">{l.template.marca}</span>
                                                )}
                                                {l.caixas && Number(l.caixas) > 0 && (
                                                    <span className="ml-auto text-[10px] font-bold text-[var(--accent)]">
                                                        {Math.floor(Number(l.caixas) / cxPP)} plt + {Number(l.caixas) % cxPP > 0 ? `1 PICADO (${Number(l.caixas) % cxPP} cx)` : 'sem resto'}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Preview total */}
                    {previewItems.length > 0 && (
                        <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] mb-3">
                                Serão criados {previewItems.length} palete(s)
                            </p>
                            <div className="space-y-1.5">
                                {previewItems.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${item.tipo === 'PICADO' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'}`}>
                                                {item.tipo}
                                            </span>
                                            <span className="font-semibold text-foreground truncate">{item.descricao}</span>
                                        </div>
                                        <span className="font-bold text-foreground flex-shrink-0 ml-3">{item.caixas} cx</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-[var(--accent)]/20 flex justify-between text-xs font-bold">
                                <span className="text-muted">Total de caixas</span>
                                <span className="text-foreground">{previewItems.reduce((s, i) => s + i.caixas, 0).toLocaleString('pt-BR')} cx</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border flex justify-end gap-3 flex-shrink-0">
                    <button onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button
                        onClick={save}
                        disabled={saving || previewItems.length === 0}
                        className="btn-gold"
                    >
                        {saving ? 'Salvando...' : `Criar ${previewItems.length} Palete(s)`}
                    </button>
                </div>
            </div>
        </div>
    )
}
