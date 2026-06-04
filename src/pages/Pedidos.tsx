import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatCurrency } from '../lib/utils'
import type { Pedido, PedidoItem, Cliente, Variedade, Vendedor, Motorista, Classificacao } from '../lib/types'
import toast from 'react-hot-toast'
import {
    Plus, X, FileText, ChevronLeft, ChevronRight,
    Printer, PackageCheck, Edit2, Save, Trash2,
    ClipboardList, TrendingUp, AlertCircle, CheckCircle2
} from 'lucide-react'

const PAGE_SIZE = 25

type FormItem = {
    variedade_id: string
    classificacao: Classificacao
    caixas_solicitadas: string
    preco_caixa: string
}

const EMPTY_ITEM: FormItem = {
    variedade_id: '',
    classificacao: 'CAT1',
    caixas_solicitadas: '',
    preco_caixa: '',
}

function ProgressBar({ done, total }: { done: number; total: number }) {
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
    const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-bold text-muted w-8 text-right">{pct}%</span>
        </div>
    )
}

function StatusBadge({ status }: { status: Pedido['status'] }) {
    const map: Record<Pedido['status'], string> = {
        pendente: 'badge-warning',
        aprovado: 'badge-cat1',
        despachado: 'badge-success',
        cancelado: 'bg-red-100 text-red-600 text-xs font-bold rounded-lg px-2 py-0.5',
    }
    const label: Record<Pedido['status'], string> = {
        pendente: '● Pendente',
        aprovado: '● Aprovado',
        despachado: '● Despachado',
        cancelado: '● Cancelado',
    }
    return <span className={map[status]}>{label[status]}</span>
}

export default function Pedidos() {
    const { role } = useAuth()
    const isDono = role === 'dono'

    const [pedidos, setPedidos] = useState<Pedido[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)
    const [loading, setLoading] = useState(true)

    // Detail modal
    const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [savingEdit, setSavingEdit] = useState(false)
    const [editData, setEditData] = useState({ motorista_nome: '', motorista_cpf: '', placa_veiculo: '', vendedor_nome: '' })

    // Full edit modal
    const [showEditModal, setShowEditModal] = useState(false)
    const [savingFullEdit, setSavingFullEdit] = useState(false)
    const [editForm, setEditForm] = useState({
        cliente_id: '', data_saida: '', vendedor_nome: '', motorista_nome: '', motorista_cpf: '', placa_veiculo: ''
    })
    const [editItems, setEditItems] = useState<FormItem[]>([])

    // New order modal
    const [showNewModal, setShowNewModal] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [variedades, setVariedades] = useState<Variedade[]>([])
    const [vendedores, setVendedores] = useState<Vendedor[]>([])
    const [motoristas, setMotoristas] = useState<Motorista[]>([])

    const [form, setForm] = useState({
        cliente_id: '',
        data_saida: new Date().toISOString().slice(0, 10),
        vendedor_nome: '',
        motorista_nome: '',
        motorista_cpf: '',
        placa_veiculo: '',
    })
    const [items, setItems] = useState<FormItem[]>([{ ...EMPTY_ITEM }])

    useEffect(() => {
        supabase.from('clientes').select('*').eq('status', 'ativo').order('nome').then(({ data }) => setClientes(data ?? []))
        supabase.from('variedades').select('*').order('nome').then(({ data }) => setVariedades(data ?? []))
        supabase.from('vendedores').select('*').eq('status', 'ativo').order('nome').then(({ data }) => setVendedores(data ?? []))
        supabase.from('motoristas').select('*').eq('status', 'ativo').order('nome').then(({ data }) => setMotoristas(data ?? []))
    }, [])

    // ─── Fetch pedidos com progresso ────────────────────────────────────────
    const fetchPedidos = useCallback(async () => {
        setLoading(true)
        const { data, count } = await supabase
            .from('pedidos')
            .select('*, cliente:cliente_id(nome)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

        if (!data) { setLoading(false); return }

        const ids = data.map(p => p.id)

        const [{ data: pedItens }, { data: expData }] = await Promise.all([
            supabase.from('pedido_itens').select('*, variedade:variedade_id(nome)').in('pedido_id', ids),
            supabase.from('expedicao')
                .select('pedido_id, palete:palete_id(caixas)')
                .in('pedido_id', ids)
                .not('pedido_id', 'is', null),
        ])

        const pedidosComProgresso = data.map(p => {
            const pitens = ((pedItens ?? []).filter(i => i.pedido_id === p.id)) as PedidoItem[]
            const totalSolicitadas = pitens.reduce((s, i) => s + (i.caixas_solicitadas || 0), 0)
            const totalExpedidas = (expData ?? [])
                .filter(e => e.pedido_id === p.id)
                .reduce((s, e) => s + ((e.palete as any)?.caixas || 0), 0)

            const itensComProgresso = pitens.map(item => {
                const proporcao = totalSolicitadas > 0 ? item.caixas_solicitadas / totalSolicitadas : 0
                return { ...item, caixas_expedidas: Math.round(totalExpedidas * proporcao) }
            })

            return { ...p, pedido_itens: itensComProgresso }
        })

        setPedidos(pedidosComProgresso as any)
        setTotal(count ?? 0)
        setLoading(false)
    }, [page])

    useEffect(() => { fetchPedidos() }, [fetchPedidos])

    // ─── Ver detalhes ────────────────────────────────────────────────────────
    async function handleViewDetails(id: string) {
        const [{ data: ped }, { data: pitens }, { data: exps }] = await Promise.all([
            supabase.from('pedidos').select('*, cliente:cliente_id(nome), itens:expedicao(id, palete:palete_id(numero_palete, caixas, peso_total_kg, classificacao, produtor:produtor_id(nome), variedade:variedade_id(nome)))').eq('id', id).single(),
            supabase.from('pedido_itens').select('*, variedade:variedade_id(nome)').eq('pedido_id', id),
            supabase.from('expedicao').select('palete:palete_id(caixas)').eq('pedido_id', id).not('pedido_id', 'is', null),
        ])
        if (!ped) { toast.error('Erro ao buscar detalhes'); return }

        const totalExpedidas = (exps ?? []).reduce((s, e) => s + ((e.palete as any)?.caixas || 0), 0)
        const totalSolicitadas = ((pitens ?? []) as PedidoItem[]).reduce((s, i) => s + (i.caixas_solicitadas || 0), 0)

        const itensComProgresso = ((pitens ?? []) as PedidoItem[]).map(item => {
            const proporcao = totalSolicitadas > 0 ? item.caixas_solicitadas / totalSolicitadas : 0
            return { ...item, caixas_expedidas: Math.round(totalExpedidas * proporcao) }
        })

        setSelectedPedido({ ...ped, pedido_itens: itensComProgresso } as any)
        setEditData({ motorista_nome: ped.motorista_nome || '', motorista_cpf: ped.motorista_cpf || '', placa_veiculo: ped.placa_veiculo || '', vendedor_nome: ped.vendedor_nome || '' })
        setIsEditing(false)
    }

    // ─── Abrir modal de edição completa ─────────────────────────────────────────────
    async function handleOpenEdit(ped: Pedido) {
        setEditForm({
            cliente_id: (ped as any).cliente_id || '',
            data_saida: ped.data_saida || '',
            vendedor_nome: ped.vendedor_nome || '',
            motorista_nome: ped.motorista_nome || '',
            motorista_cpf: ped.motorista_cpf || '',
            placa_veiculo: ped.placa_veiculo || '',
        })
        const { data: pitens } = await supabase.from('pedido_itens').select('*, variedade:variedade_id(nome)').eq('pedido_id', ped.id)
        setEditItems((pitens ?? []).map((i: any) => ({
            variedade_id: i.variedade_id || '',
            classificacao: i.classificacao || 'CAT1',
            caixas_solicitadas: String(i.caixas_solicitadas || ''),
            preco_caixa: String(i.preco_caixa || ''),
        })))
        setShowEditModal(true)
    }

    // ─── Salvar edição completa ──────────────────────────────────────────────────
    async function handleSaveFullEdit() {
        if (!selectedPedido) return
        const validItems = editItems.filter(i => i.variedade_id && i.caixas_solicitadas)
        if (validItems.length === 0) { toast.error('Adicione ao menos 1 item'); return }
        setSavingFullEdit(true)
        try {
            const totalBruto = validItems.reduce((s, i) => s + (Number(i.caixas_solicitadas) * Number(i.preco_caixa || 0)), 0)
            await supabase.from('pedidos').update({
                ...editForm,
                valor_total_bruto: totalBruto,
                valor_total_liquido: totalBruto,
            }).eq('id', selectedPedido.id)

            // Recria os itens do pedido
            await supabase.from('pedido_itens').delete().eq('pedido_id', selectedPedido.id)
            await supabase.from('pedido_itens').insert(validItems.map(i => ({
                pedido_id: selectedPedido.id,
                variedade_id: i.variedade_id || null,
                classificacao: i.classificacao,
                caixas_solicitadas: Number(i.caixas_solicitadas),
                preco_caixa: i.preco_caixa ? Number(i.preco_caixa) : null,
            })))

            toast.success('Pedido atualizado!')
            setShowEditModal(false)
            fetchPedidos()
            handleViewDetails(selectedPedido.id)
        } catch (err: any) {
            toast.error('Erro: ' + err.message)
        } finally { setSavingFullEdit(false) }
    }

    // ─── Salvar edição ───────────────────────────────────────────────────────
    async function handleSaveEdit() {
        if (!selectedPedido) return
        setSavingEdit(true)
        try {
            await supabase.from('pedidos').update(editData).eq('id', selectedPedido.id)
            await supabase.from('expedicao').update(editData).eq('pedido_id', selectedPedido.id)
            toast.success('Pedido atualizado!')
            setIsEditing(false)
            fetchPedidos()
            setSelectedPedido({ ...selectedPedido, ...editData } as any)
        } catch (err: any) {
            toast.error('Erro: ' + err.message)
        } finally { setSavingEdit(false) }
    }

    // ─── Criar pedido ────────────────────────────────────────────────────────
    async function handleCreatePedido(e: React.FormEvent) {
        e.preventDefault()
        if (!form.cliente_id) { toast.error('Selecione o cliente'); return }
        const validItems = items.filter(i => i.variedade_id && i.caixas_solicitadas)
        if (validItems.length === 0) { toast.error('Adicione ao menos 1 item ao pedido'); return }

        setSubmitting(true)
        try {
            const totalBruto = validItems.reduce((s, i) => s + (Number(i.caixas_solicitadas) * Number(i.preco_caixa || 0)), 0)
            const numero = `PED-${Date.now().toString().slice(-6)}`

            const { data: ped, error: pedErr } = await supabase.from('pedidos').insert({
                cliente_id: form.cliente_id,
                data_saida: form.data_saida,
                vendedor_nome: form.vendedor_nome || null,
                motorista_nome: form.motorista_nome || null,
                motorista_cpf: form.motorista_cpf || null,
                placa_veiculo: form.placa_veiculo || null,
                numero_pedido: numero,
                valor_total_bruto: totalBruto,
                valor_desconto: 0,
                valor_total_liquido: totalBruto,
                status: 'pendente',
            }).select().single()

            if (pedErr) throw pedErr

            const linhas = validItems.map(i => ({
                pedido_id: ped.id,
                variedade_id: i.variedade_id || null,
                classificacao: i.classificacao,
                caixas_solicitadas: Number(i.caixas_solicitadas),
                preco_caixa: i.preco_caixa ? Number(i.preco_caixa) : null,
            }))
            const { error: itemErr } = await supabase.from('pedido_itens').insert(linhas)
            if (itemErr) throw itemErr

            toast.success(`Pedido ${numero} criado!`)
            setShowNewModal(false)
            setForm({ cliente_id: '', data_saida: new Date().toISOString().slice(0, 10), vendedor_nome: '', motorista_nome: '', motorista_cpf: '', placa_veiculo: '' })
            setItems([{ ...EMPTY_ITEM }])
            fetchPedidos()
        } catch (err: any) {
            toast.error('Erro ao criar pedido: ' + err.message)
        } finally { setSubmitting(false) }
    }

    // ─── Excluir pedido ────────────────────────────────────────────────────────
    async function handleDeletePedido(id: string, expedidas: number) {
        if (expedidas > 0) {
            toast.error('Exclusão bloqueada: cancele as expedições vinculadas primeiro.')
            return
        }
        if (!confirm('Deseja excluir este pedido permanentemente?')) return
        try {
            const { error: pedErr } = await supabase.from('pedidos').delete().eq('id', id)
            if (pedErr) throw pedErr
            toast.success('Pedido excluído!')
            fetchPedidos()
        } catch (err: any) {
            toast.error('Erro ao excluir: ' + err.message)
        }
    }


    function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM }]) }
    function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }
    function updateItem(i: number, field: keyof FormItem, value: string) {
        setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
    }

    const totalPages = Math.ceil(total / PAGE_SIZE)

    function calcProgresso(p: Pedido) {
        const itens = p.pedido_itens ?? []
        const solicitadas = itens.reduce((s, i) => s + (i.caixas_solicitadas || 0), 0)
        const expedidas = itens.reduce((s, i) => s + (i.caixas_expedidas || 0), 0)
        return { solicitadas, expedidas }
    }

    return (
        <>
            {/* ── Conteúdo da página - ESCONDIDO na impressão ── */}
            <div className="space-y-6 print:hidden">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Gestão de Pedidos</h1>
                        <p className="text-sm text-muted mt-0.5">Pedidos dos clientes e acompanhamento do atendimento.</p>
                    </div>
                    <button onClick={() => setShowNewModal(true)} className="btn-primary">
                        <Plus className="w-4 h-4" /> Novo Pedido
                    </button>
                </div>

                {/* ── Lista ── */}
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="space-y-2 py-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}</div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr>
                                        <th className="table-header">Nº PEDIDO</th>
                                        <th className="table-header">CLIENTE</th>
                                        <th className="table-header">DATA SAÍDA</th>
                                        <th className="table-header">VENDEDOR</th>
                                        <th className="table-header w-48">PROGRESSO</th>
                                        <th className="table-header">STATUS</th>
                                        {isDono && <th className="table-header text-right">VALOR</th>}
                                        <th className="table-header">AÇÕES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedidos.map(p => {
                                        const { solicitadas, expedidas } = calcProgresso(p)
                                        return (
                                            <tr key={p.id} className="hover:bg-brand-50/30 transition-colors">
                                                <td className="table-cell font-mono font-bold text-brand-600">{p.numero_pedido || 'S/N'}</td>
                                                <td className="table-cell font-medium text-foreground">{(p.cliente as any)?.nome || '—'}</td>
                                                <td className="table-cell">{formatDate(p.data_saida)}</td>
                                                <td className="table-cell text-sm">{p.vendedor_nome || '—'}</td>
                                                <td className="table-cell">
                                                    {solicitadas > 0 ? (
                                                        <div>
                                                            <ProgressBar done={expedidas} total={solicitadas} />
                                                            <p className="text-[10px] text-muted mt-0.5">{expedidas}/{solicitadas} cx</p>
                                                        </div>
                                                    ) : <span className="text-xs text-muted">Sem itens</span>}
                                                </td>
                                                <td className="table-cell"><StatusBadge status={p.status} /></td>
                                                {isDono && <td className="table-cell text-right font-black text-brand-700">{formatCurrency(p.valor_total_liquido)}</td>}
                                                <td className="table-cell">
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => handleViewDetails(p.id)} className="btn-secondary py-1 text-xs flex items-center gap-1.5">
                                                            <FileText className="w-3 h-3" /> Detalhes
                                                        </button>
                                                        {isDono && (
                                                            <button
                                                                onClick={() => handleDeletePedido(p.id, expedidas)}
                                                                disabled={expedidas > 0}
                                                                title={expedidas > 0 ? "Exclusão bloqueada: possui paletes expedidos" : "Excluir pedido"}
                                                                className="btn-secondary py-1 px-2 text-xs text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {pedidos.length === 0 && (
                                        <tr><td colSpan={8} className="table-cell text-center text-muted py-12">Nenhum pedido encontrado</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
                        <span className="text-sm text-muted">Exibindo {pedidos.length} de {total} pedidos</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>

                {/* ── Modal Novo Pedido ── */}
                {showNewModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="card bg-[var(--card)] w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
                            <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg"><ClipboardList className="w-5 h-5 text-brand-600" /></div>
                                    <div>
                                        <h2 className="text-lg font-black text-foreground">Novo Pedido</h2>
                                        <p className="text-xs text-muted">Informe os dados do cliente e os itens solicitados.</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowNewModal(false)} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="p-5 overflow-y-auto flex-1">
                                <form id="pedido-form" onSubmit={handleCreatePedido} className="space-y-5">
                                    <div>
                                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Dados do Pedido</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Cliente *</label>
                                                <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} className="input" required>
                                                    <option value="">Selecione o cliente</option>
                                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Data de Saída</label>
                                                <input type="date" value={form.data_saida} onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))} className="input" required />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Vendedor</label>
                                                <select value={form.vendedor_nome} onChange={e => setForm(f => ({ ...f, vendedor_nome: e.target.value }))} className="input">
                                                    <option value="">Nenhum</option>
                                                    {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Motorista</label>
                                                <select value={form.motorista_nome} onChange={e => {
                                                    const m = motoristas.find(x => x.nome === e.target.value)
                                                    setForm(f => ({ ...f, motorista_nome: m?.nome || '', motorista_cpf: m?.cpf || '' }))
                                                }} className="input">
                                                    <option value="">Nenhum</option>
                                                    {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Placa</label>
                                                <input type="text" value={form.placa_veiculo} onChange={e => setForm(f => ({ ...f, placa_veiculo: e.target.value }))} placeholder="Ex: ABC-1234" className="input uppercase" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Itens do pedido */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Itens Solicitados *</p>
                                            <button type="button" onClick={addItem} className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5">
                                                <Plus className="w-3 h-3" /> Adicionar Item
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-12 gap-2 px-1">
                                                <span className="col-span-4 text-[10px] font-bold text-muted uppercase">Variedade</span>
                                                <span className="col-span-2 text-[10px] font-bold text-muted uppercase">CAT.</span>
                                                <span className="col-span-3 text-[10px] font-bold text-muted uppercase">Caixas</span>
                                                <span className="col-span-2 text-[10px] font-bold text-muted uppercase">Preço/Cx</span>
                                                <span className="col-span-1" />
                                            </div>
                                            {items.map((item, i) => (
                                                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-2">
                                                    <div className="col-span-4">
                                                        <select value={item.variedade_id} onChange={e => updateItem(i, 'variedade_id', e.target.value)} className="input py-1.5 text-sm">
                                                            <option value="">Selecione...</option>
                                                            {variedades.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <select value={item.classificacao} onChange={e => updateItem(i, 'classificacao', e.target.value)} className="input py-1.5 text-sm">
                                                            {(['CAT1', 'CAT2', 'CAT3'] as Classificacao[]).map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="col-span-3">
                                                        <input type="number" min="1" placeholder="0" value={item.caixas_solicitadas} onChange={e => updateItem(i, 'caixas_solicitadas', e.target.value)} className="input py-1.5 text-sm" />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <input type="number" step="0.01" min="0" placeholder="R$ 0" value={item.preco_caixa} onChange={e => updateItem(i, 'preco_caixa', e.target.value)} className="input py-1.5 text-sm" />
                                                    </div>
                                                    <div className="col-span-1 flex justify-center">
                                                        {items.length > 1 && (
                                                            <button type="button" onClick={() => removeItem(i)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {items.some(i => i.caixas_solicitadas && i.preco_caixa) && (
                                            <div className="mt-3 flex justify-end">
                                                <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl px-4 py-2 text-sm">
                                                    <span className="text-muted">Total estimado: </span>
                                                    <span className="font-black text-brand-700">
                                                        {formatCurrency(items.reduce((s, i) => s + (Number(i.caixas_solicitadas || 0) * Number(i.preco_caixa || 0)), 0))}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </form>
                            </div>

                            <div className="p-5 border-t border-border flex justify-end gap-3 flex-shrink-0 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl">
                                <button type="button" onClick={() => setShowNewModal(false)} className="btn-secondary">Cancelar</button>
                                <button type="submit" form="pedido-form" disabled={submitting} className="btn-primary">
                                    <ClipboardList className="w-4 h-4" />
                                    {submitting ? 'Criando...' : 'Criar Pedido'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal Detalhes - FORA do print:hidden para imprimir ── */}
            {selectedPedido && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:bg-white print:items-start print:justify-start print:p-0">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:w-full">

                        {/* Header — escondido na impressão */}
                        <div className="p-5 border-b border-border flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/30 print:hidden">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg"><FileText className="w-5 h-5 text-brand-600" /></div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Pedido #{selectedPedido.numero_pedido || 'S/N'}</h2>
                                    <p className="text-xs text-muted">{(selectedPedido.cliente as any)?.nome} · {formatDate(selectedPedido.data_saida)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => window.print()} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
                                <button onClick={() => setSelectedPedido(null)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition"><X className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto space-y-6 print:overflow-visible print:p-6">
                            {/* Cabeçalho apenas para impressão */}
                            <div className="hidden print:flex print:items-center print:justify-between print:mb-4 print:pb-3 print:border-b-2 print:border-gray-300">
                                <div>
                                    <h1 className="text-xl font-bold">Pedido #{selectedPedido.numero_pedido || 'S/N'}</h1>
                                    <p className="text-sm text-gray-500">{(selectedPedido.cliente as any)?.nome} · {formatDate(selectedPedido.data_saida)}</p>
                                </div>
                                <div className="text-sm text-gray-400">Nova Aliança ERP</div>
                            </div>

                            {/* Informações + Transporte */}
                            <div className="grid grid-cols-2 gap-6">
                                <section>
                                    <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 pb-1 border-b border-zinc-100 flex items-center justify-between">
                                        Informações do Pedido
                                        {selectedPedido.status === 'pendente' && !isEditing && (
                                            <button onClick={() => setIsEditing(true)} className="text-brand-600 hover:text-brand-700 flex items-center gap-1 normal-case tracking-normal text-xs print:hidden">
                                                <Edit2 className="w-3 h-3" /> Editar
                                            </button>
                                        )}
                                        {isEditing && (
                                            <div className="flex items-center gap-2 print:hidden">
                                                <button onClick={() => setIsEditing(false)} className="text-muted text-xs normal-case">Cancelar</button>
                                                <button onClick={handleSaveEdit} disabled={savingEdit} className="text-brand-600 text-xs flex items-center gap-1 normal-case">
                                                    <Save className="w-3 h-3" /> {savingEdit ? 'Salvando...' : 'Salvar'}
                                                </button>
                                            </div>
                                        )}
                                    </h3>
                                    <p className="text-base font-bold text-foreground">{(selectedPedido.cliente as any)?.nome}</p>
                                    <p className="text-sm text-muted">Data de Saída: {formatDate(selectedPedido.data_saida)}</p>
                                    {isEditing ? (
                                        <div className="mt-3">
                                            <label className="block text-xs text-muted mb-1">Vendedor</label>
                                            <select value={editData.vendedor_nome} onChange={e => setEditData(p => ({ ...p, vendedor_nome: e.target.value }))} className="input h-9 w-full">
                                                <option value="">Sem Vendedor</option>
                                                {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                                            </select>
                                        </div>
                                    ) : (
                                        <p className="text-sm mt-1"><span className="text-muted">Vendedor:</span> <span className="font-bold">{selectedPedido.vendedor_nome || '—'}</span></p>
                                    )}
                                </section>
                                <section>
                                    <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 pb-1 border-b border-zinc-100">Transporte</h3>
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-muted uppercase tracking-wide mb-1">Motorista</label>
                                                <select value={editData.motorista_nome} onChange={e => { const m = motoristas.find(x => x.nome === e.target.value); setEditData(p => ({ ...p, motorista_nome: m?.nome || '', motorista_cpf: m?.cpf || '' })) }} className="input h-9 w-full">
                                                    <option value="">Sem Motorista</option>
                                                    {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-muted uppercase tracking-wide mb-1">CPF Motorista</label>
                                                <input type="text" placeholder="000.000.000-00" value={editData.motorista_cpf} onChange={e => setEditData(p => ({ ...p, motorista_cpf: e.target.value }))} className="input h-9 w-full" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-muted uppercase tracking-wide mb-1">Placa</label>
                                                <input type="text" placeholder="Ex: ABC-1234" value={editData.placa_veiculo} onChange={e => setEditData(p => ({ ...p, placa_veiculo: e.target.value }))} className="input h-9 w-full uppercase" />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm"><span className="text-muted">Motorista:</span> <span className="font-bold">{selectedPedido.motorista_nome || '—'}</span></p>
                                            <p className="text-sm"><span className="text-muted">CPF:</span> {selectedPedido.motorista_cpf || '—'}</p>
                                            <p className="text-sm"><span className="text-muted">Placa:</span> <span className="font-mono font-bold">{selectedPedido.placa_veiculo || '—'}</span></p>
                                        </>
                                    )}
                                </section>
                            </div>

                            {/* Progresso por item - escondido na impressão */}
                            {(selectedPedido.pedido_itens ?? []).length > 0 && (
                                <div className="print:hidden">
                                    <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-3 pb-1 border-b border-zinc-100 flex items-center gap-2">
                                        <TrendingUp className="w-3.5 h-3.5" /> Progresso de Atendimento
                                    </h3>
                                    <div className="space-y-2">
                                        {selectedPedido.pedido_itens!.map(item => {
                                            const exp = item.caixas_expedidas ?? 0
                                            const sol = item.caixas_solicitadas
                                            const pct = sol > 0 ? Math.min(100, Math.round((exp / sol) * 100)) : 0
                                            const StatusIcon = pct >= 100 ? CheckCircle2 : pct > 0 ? TrendingUp : AlertCircle
                                            const iconColor = pct >= 100 ? 'text-green-500' : pct > 0 ? 'text-amber-500' : 'text-red-400'
                                            return (
                                                <div key={item.id} className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl px-4 py-3">
                                                    <StatusIcon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-semibold text-foreground truncate">
                                                                {(item.variedade as any)?.nome ?? '—'}
                                                                <span className="ml-2 text-xs font-bold text-muted">{item.classificacao}</span>
                                                            </span>
                                                            <span className="text-xs font-bold text-muted ml-3 whitespace-nowrap">{exp}/{sol} cx</span>
                                                        </div>
                                                        <ProgressBar done={exp} total={sol} />
                                                    </div>
                                                    {item.preco_caixa && isDono && (
                                                        <span className="text-xs text-muted whitespace-nowrap hidden md:block">{formatCurrency(item.preco_caixa)}/cx</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Paletes expedidos */}
                            {(selectedPedido.itens ?? []).length > 0 && (() => {
                                const itens = selectedPedido.itens as any[]
                                const totalCaixas = itens.reduce((s, i) => s + (i.palete?.caixas || 0), 0)
                                const totalKg = itens.reduce((s, i) => s + (i.palete?.peso_total_kg || 0), 0)
                                return (
                                    <div>
                                        <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-3 pb-1 border-b border-zinc-100">Paletes Expedidos</h3>
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                                                    <th className="px-3 py-2 text-left text-[10px] font-black text-muted uppercase">Nº Palete</th>
                                                    <th className="px-3 py-2 text-left text-[10px] font-black text-muted uppercase">Produtor / Variedade</th>
                                                    <th className="px-3 py-2 text-center text-[10px] font-black text-muted uppercase">Class.</th>
                                                    <th className="px-3 py-2 text-right text-[10px] font-black text-muted uppercase">Caixas</th>
                                                    <th className="px-3 py-2 text-right text-[10px] font-black text-muted uppercase">Peso KG</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {itens.map((item: any) => (
                                                    <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800">
                                                        <td className="px-3 py-2 font-mono font-bold text-brand-600">{item.palete?.numero_palete}</td>
                                                        <td className="px-3 py-2">
                                                            <div className="font-bold">{item.palete?.produtor?.nome}</div>
                                                            <div className="text-xs text-muted">{item.palete?.variedade?.nome}</div>
                                                        </td>
                                                        <td className="px-3 py-2 text-center"><span className="text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">{item.palete?.classificacao}</span></td>
                                                        <td className="px-3 py-2 text-right font-black">{item.palete?.caixas}</td>
                                                        <td className="px-3 py-2 text-right text-muted">{item.palete?.peso_total_kg?.toLocaleString('pt-BR')} kg</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t-2 border-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 font-black">
                                                    <td className="px-3 py-2 text-[10px] uppercase tracking-widest" colSpan={3}>
                                                        Total — {itens.length} palete{itens.length !== 1 ? 's' : ''}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">{totalCaixas} cx</td>
                                                    <td className="px-3 py-2 text-right">{totalKg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )
                            })()}

                            {/* Assinaturas — apenas na impressão */}
                            <div className="hidden print:block print:mt-10">
                                <div className="grid grid-cols-3 gap-8">
                                    <div className="text-center">
                                        <div className="border-t-2 border-gray-400 pt-2 mt-10">
                                            <p className="text-xs font-bold uppercase tracking-wide">Motorista</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{selectedPedido.motorista_nome || ''}</p>
                                            {selectedPedido.motorista_cpf && (
                                                <p className="text-xs text-gray-400">CPF: {selectedPedido.motorista_cpf}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="border-t-2 border-gray-400 pt-2 mt-10">
                                            <p className="text-xs font-bold uppercase tracking-wide">Responsável pela Emissão</p>
                                            <p className="text-xs text-gray-400 mt-0.5">Nova Aliança</p>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="border-t-2 border-gray-400 pt-2 mt-10">
                                            <p className="text-xs font-bold uppercase tracking-wide">Recebido por</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{(selectedPedido.cliente as any)?.nome || ''}</p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-[10px] text-gray-400 mt-6">Documento emitido em {new Date().toLocaleDateString('pt-BR')} · Nova Aliança ERP</p>
                            </div>
                        </div>

                        {/* Footer — escondido na impressão */}
                        <div className="p-5 bg-zinc-50 dark:bg-zinc-800/30 border-t border-border flex justify-between items-center print:hidden">
                            <div className="flex gap-2">
                                {selectedPedido.status !== 'despachado' && selectedPedido.status !== 'cancelado' && (
                                    <button onClick={async () => {
                                        if (!confirm('Marcar como DESPACHADO?')) return
                                        try {
                                            // Atualiza o pedido
                                            await supabase.from('pedidos').update({ status: 'despachado' }).eq('id', selectedPedido.id)
                                            // Puxa os paletes envolvidos
                                            const { data: itens } = await supabase.from('expedicao').select('palete_id').eq('pedido_id', selectedPedido.id)
                                            if (itens?.length) {
                                                const pIds = itens.map(i => i.palete_id).filter(Boolean) as string[]
                                                if (pIds.length) {
                                                    // Atualiza o histórico de expedição e o estoque para expedido
                                                    await supabase.from('expedicao').update({ status: 'expedido' }).eq('pedido_id', selectedPedido.id)
                                                    await supabase.from('estoque').update({ status: 'expedido' }).in('id', pIds)
                                                }
                                            }
                                            toast.success('Pedido despachado! Paletes atualizados para EXPEDIDO.')
                                            fetchPedidos()
                                            setSelectedPedido(null)
                                        } catch (err: any) {
                                            toast.error('Erro ao despachar: ' + err.message)
                                        }
                                    }} className="btn-success py-2 px-5 flex items-center gap-2">
                                        <PackageCheck className="w-4 h-4" /> Confirmar Despacho
                                    </button>
                                )}
                                {selectedPedido.status === 'pendente' && (
                                    <button onClick={async () => {
                                        if (!confirm('Cancelar este pedido?')) return
                                        await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', selectedPedido.id)
                                        const { data: itens } = await supabase.from('expedicao').select('id, palete_id').eq('pedido_id', selectedPedido.id)
                                        if (itens?.length) {
                                            await supabase.from('estoque').update({ status: 'disponivel' }).in('id', itens.map(i => i.palete_id).filter(Boolean) as string[])
                                            await supabase.from('expedicao').update({ status: 'cancelado' }).eq('pedido_id', selectedPedido.id)
                                        }
                                        toast.success('Pedido cancelado!')
                                        fetchPedidos()
                                        setSelectedPedido(null)
                                    }} className="btn-secondary py-2 px-5 text-red-600 hover:bg-red-50 border-red-100">
                                        Cancelar Pedido
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedPedido.status === 'pendente' && (
                                    <button onClick={() => handleOpenEdit(selectedPedido)} className="btn-primary py-2 px-5 flex items-center gap-2">
                                        <Edit2 className="w-4 h-4" /> Editar Pedido
                                    </button>
                                )}
                                <button onClick={async () => {
                                    if (!confirm('Isto vai procurar pedidos despachados e consertar o status das expedições antigas para "EXPEDIDO". Continuar?')) return
                                    try {
                                        const { data: peds } = await supabase.from('pedidos').select('id, numero_pedido').eq('status', 'despachado')
                                        if (!peds || peds.length === 0) return toast.success('Nenhum pedido despachado encontrado.')

                                        const pIds = peds.map((p: any) => p.id)
                                        const { data: exp } = await supabase.from('expedicao').select('id, palete_id').eq('status', 'pendente').in('pedido_id', pIds)
                                        if (exp && exp.length > 0) {
                                            const expIds = exp.map((e: any) => e.id)
                                            const palIds = exp.map((e: any) => e.palete_id).filter(Boolean)
                                            await supabase.from('expedicao').update({ status: 'expedido' }).in('id', expIds)
                                            if (palIds.length) await supabase.from('estoque').update({ status: 'expedido' }).in('id', palIds)
                                            toast.success(`${expIds.length} paletes antigos corrigidos para EXPEDIDO!`)
                                        } else {
                                            // Tentar por numero_pedido para casos mais antigos
                                            const nums = peds.map((p: any) => p.numero_pedido).filter(Boolean)
                                            const { data: expNum } = await supabase.from('expedicao').select('id, palete_id').eq('status', 'pendente').in('numero_pedido', nums)
                                            if (expNum && expNum.length > 0) {
                                                const eIds = expNum.map((e: any) => e.id)
                                                const pIds2 = expNum.map((e: any) => e.palete_id).filter(Boolean)
                                                await supabase.from('expedicao').update({ status: 'expedido' }).in('id', eIds)
                                                if (pIds2.length) await supabase.from('estoque').update({ status: 'expedido' }).in('id', pIds2)
                                                toast.success(`${eIds.length} paletes órfãos corrigidos para EXPEDIDO!`)
                                            } else {
                                                toast.success('Todos os paletes parecem já estar sincronizados!')
                                            }
                                        }
                                    } catch (e: any) {
                                        toast.error('Erro: ' + e.message)
                                    }
                                }} className="btn-secondary text-sm py-2 px-4 whitespace-nowrap hidden lg:flex">
                                    Corrigir Status Antigos
                                </button>
                                <button onClick={() => setSelectedPedido(null)} className="btn-secondary py-2 px-5">Fechar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Editar Pedido Completo ── */}
            {showEditModal && selectedPedido && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="card bg-[var(--card)] w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg"><Edit2 className="w-5 h-5 text-brand-600" /></div>
                                <div>
                                    <h2 className="text-lg font-black text-foreground">Editar Pedido #{selectedPedido.numero_pedido}</h2>
                                    <p className="text-xs text-muted">Altere os dados e itens do pedido abaixo.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 space-y-6">
                            {/* Dados do Pedido */}
                            <div>
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Dados do Pedido</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Cliente *</label>
                                        <select value={editForm.cliente_id} onChange={e => setEditForm(f => ({ ...f, cliente_id: e.target.value }))} className="input" required>
                                            <option value="">Selecione o cliente</option>
                                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Data de Saída</label>
                                        <input type="date" value={editForm.data_saida} onChange={e => setEditForm(f => ({ ...f, data_saida: e.target.value }))} className="input" required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Vendedor</label>
                                        <select value={editForm.vendedor_nome} onChange={e => setEditForm(f => ({ ...f, vendedor_nome: e.target.value }))} className="input">
                                            <option value="">Nenhum</option>
                                            {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Motorista</label>
                                        <select value={editForm.motorista_nome} onChange={e => {
                                            const m = motoristas.find(x => x.nome === e.target.value)
                                            setEditForm(f => ({ ...f, motorista_nome: m?.nome || '', motorista_cpf: m?.cpf || '' }))
                                        }} className="input">
                                            <option value="">Nenhum</option>
                                            {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">CPF Motorista</label>
                                        <input type="text" value={editForm.motorista_cpf} onChange={e => setEditForm(f => ({ ...f, motorista_cpf: e.target.value }))} placeholder="000.000.000-00" className="input" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Placa do Veículo</label>
                                    <input type="text" value={editForm.placa_veiculo} onChange={e => setEditForm(f => ({ ...f, placa_veiculo: e.target.value }))} placeholder="Ex: ABC-1234" className="input w-48 uppercase" />
                                </div>
                            </div>

                            {/* Itens do pedido */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Itens Solicitados</p>
                                    <button type="button" onClick={() => setEditItems(prev => [...prev, { ...EMPTY_ITEM }])} className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5">
                                        <Plus className="w-3 h-3" /> Adicionar Item
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2 px-1">
                                        <span className="col-span-4 text-[10px] font-bold text-muted uppercase">Variedade</span>
                                        <span className="col-span-2 text-[10px] font-bold text-muted uppercase">CAT.</span>
                                        <span className="col-span-3 text-[10px] font-bold text-muted uppercase">Caixas</span>
                                        <span className="col-span-2 text-[10px] font-bold text-muted uppercase">Preço/Cx</span>
                                        <span className="col-span-1" />
                                    </div>
                                    {editItems.map((item, i) => (
                                        <div key={i} className="grid grid-cols-12 gap-2 items-center bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-2">
                                            <div className="col-span-4">
                                                <select value={item.variedade_id} onChange={e => setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, variedade_id: e.target.value } : it))} className="input py-1.5 text-sm">
                                                    <option value="">Selecione...</option>
                                                    {variedades.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <select value={item.classificacao} onChange={e => setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, classificacao: e.target.value as Classificacao } : it))} className="input py-1.5 text-sm">
                                                    {(['CAT1', 'CAT2', 'CAT3'] as Classificacao[]).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-3">
                                                <input type="number" min="1" placeholder="0" value={item.caixas_solicitadas} onChange={e => setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, caixas_solicitadas: e.target.value } : it))} className="input py-1.5 text-sm" />
                                            </div>
                                            <div className="col-span-2">
                                                <input type="number" step="0.01" min="0" placeholder="R$ 0" value={item.preco_caixa} onChange={e => setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, preco_caixa: e.target.value } : it))} className="input py-1.5 text-sm" />
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                {editItems.length > 1 && (
                                                    <button type="button" onClick={() => setEditItems(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {editItems.some(i => i.caixas_solicitadas && i.preco_caixa) && (
                                    <div className="mt-3 flex justify-end">
                                        <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl px-4 py-2 text-sm">
                                            <span className="text-muted">Total estimado: </span>
                                            <span className="font-black text-brand-700">
                                                {formatCurrency(editItems.reduce((s, i) => s + (Number(i.caixas_solicitadas || 0) * Number(i.preco_caixa || 0)), 0))}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-border flex justify-end gap-3 flex-shrink-0 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl">
                            <button onClick={() => setShowEditModal(false)} className="btn-secondary">Cancelar</button>
                            <button onClick={handleSaveFullEdit} disabled={savingFullEdit} className="btn-primary flex items-center gap-2">
                                <Save className="w-4 h-4" />
                                {savingFullEdit ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
