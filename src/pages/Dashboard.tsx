import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/utils'
import {
    Package, Box, TrendingUp, DollarSign, Clock,
    ShoppingCart, Users, Calendar, Lock
} from 'lucide-react'
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
    BarChart, Bar
} from 'recharts'

interface KpiData {
    totalPaletes: number
    totalCaixas: number
    totalComprado: number
    totalVendido: number
    lucro: number
    alertaFrios: number
    ticketMedio: number
    pedidosPendentesCount: number
    pedidosPendentesValor: number
    margemLucro: number
}

interface CatData { name: string; value: number; color: string; caixas?: number; oldest?: string | null }
interface SalesHistory { data: string; faturamento: number; lucro: number }
interface RankCliente { nome: string; totalGasto: number; caixas: number }
interface RankVendedor { nome: string; totalVendido: number; pedidos: number }
interface EstoqueVarData { nome: string; CAT1: number; CAT2: number; CAT3: number }

const CAT_COLORS = { CAT1: '#5C2E99', CAT2: '#C9A236', CAT3: '#8A9080' }

function SkeletonCard() {
    return <div className="card"><div className="skeleton h-4 w-24 mb-3" /><div className="skeleton h-8 w-32" /></div>
}

export default function Dashboard() {
    const { role, isBeta } = useAuth()
    const isDono = role === 'dono'

    const [kpi, setKpi] = useState<KpiData | null>(null)
    const [catData, setCatData] = useState<CatData[]>([])
    const [salesHistory, setSalesHistory] = useState<SalesHistory[]>([])
    const [topClientes, setTopClientes] = useState<RankCliente[]>([])
    const [topVendedores, setTopVendedores] = useState<RankVendedor[]>([])
    const [estoqueVar, setEstoqueVar] = useState<EstoqueVarData[]>([])
    const [loading, setLoading] = useState(true)

    const [timeFilter, setTimeFilter] = useState<'hoje' | '7dias' | 'mes' | 'tudo'>('mes')

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                // 1. Determinar Filtro de Data
                const now = new Date()
                let startDate = ''
                if (timeFilter === 'hoje') {
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
                } else if (timeFilter === '7dias') {
                    const d = new Date()
                    d.setDate(d.getDate() - 7)
                    startDate = d.toISOString()
                } else if (timeFilter === 'mes') {
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
                }

                // 2. Query Estoque Atual (snapshot independe do tempo, exceto entradas antigas)
                const { data: estoqueData } = await supabase
                    .from('estoque')
                    .select('caixas, classificacao, variedade_id, data_entrada')
                    .eq('status', 'disponivel')

                const paletes = estoqueData ?? []
                const totalPaletes = paletes.length
                const totalCaixas = paletes.reduce((s, p) => s + (p.caixas ?? 0), 0)

                // Alerta frios (> 30 dias em estoque)
                const alertaFrios = paletes.filter(p => {
                    const d = new Date(p.data_entrada)
                    return (now.getTime() - d.getTime()) / 86400000 > 30
                }).length

                // KPI Distribuição CAT e Estoque por Variedade
                const catCount: Record<string, number> = { CAT1: 0, CAT2: 0, CAT3: 0 }
                const catCaixas: Record<string, number> = { CAT1: 0, CAT2: 0, CAT3: 0 }
                const catOldest: Record<string, string | null> = { CAT1: null, CAT2: null, CAT3: null }

                paletes.forEach(p => {
                    if (p.classificacao) {
                        const cat = p.classificacao
                        catCount[cat] = (catCount[cat] ?? 0) + 1
                        catCaixas[cat] = (catCaixas[cat] ?? 0) + (p.caixas ?? 0)

                        // Check for older date
                        if (p.data_entrada) {
                            if (!catOldest[cat] || new Date(p.data_entrada) < new Date(catOldest[cat]!)) {
                                catOldest[cat] = p.data_entrada
                            }
                        }
                    }
                })

                setCatData([
                    { name: 'CAT1', value: catCount.CAT1, color: CAT_COLORS.CAT1, caixas: catCaixas.CAT1, oldest: catOldest.CAT1 },
                    { name: 'CAT2', value: catCount.CAT2, color: CAT_COLORS.CAT2, caixas: catCaixas.CAT2, oldest: catOldest.CAT2 },
                    { name: 'CAT3', value: catCount.CAT3, color: CAT_COLORS.CAT3, caixas: catCaixas.CAT3, oldest: catOldest.CAT3 },
                ])

                const { data: variedades } = await supabase.from('variedades').select('id, nome')
                const varMap: Record<string, string> = {}
                variedades?.forEach(v => { varMap[v.id] = v.nome })

                const varEsqMap: Record<string, Record<string, number>> = {}
                paletes.forEach(p => {
                    if (p.variedade_id && p.classificacao) {
                        if (!varEsqMap[p.variedade_id]) varEsqMap[p.variedade_id] = { CAT1: 0, CAT2: 0, CAT3: 0 }
                        varEsqMap[p.variedade_id][p.classificacao] += (p.caixas ?? 0)
                    }
                })

                const varArr = Object.entries(varEsqMap)
                    .map(([id, cats]) => ({
                        nome: varMap[id] ?? id,
                        CAT1: cats.CAT1,
                        CAT2: cats.CAT2,
                        CAT3: cats.CAT3,
                        total: cats.CAT1 + cats.CAT2 + cats.CAT3
                    }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5)
                setEstoqueVar(varArr)

                // 3. Queries Dependentes do Tempo (Expedição, Pedidos)
                let expQuery = supabase.from('expedicao').select('data_saida, valor_venda_total_liquido, total_compra:valor_total, cliente:cliente_id(nome), vendedor_nome, palete:palete_id(caixas)').not('status', 'eq', 'cancelado')
                let pedQuery = supabase.from('pedidos').select('valor_total_liquido').in('status', ['pendente', 'aprovado'])

                if (startDate) {
                    expQuery = expQuery.gte('data_saida', startDate)
                    pedQuery = pedQuery.gte('created_at', startDate)
                }

                const [{ data: expedicoes }, { data: pedidos }] = await Promise.all([expQuery, pedQuery])

                // Processamento de Expedições -> Vendas
                let totalVendido = 0
                let totalCustoExpedidos = 0
                let caixasVendidas = 0

                const salesByDay: Record<string, { faturamento: number, lucro: number }> = {}
                const clientesMap: Record<string, { total: number, cx: number }> = {}
                const vendsMap: Record<string, { total: number, ped: number }> = {}

                    ; (expedicoes ?? []).forEach(e => {
                        const venda = e.valor_venda_total_liquido ?? 0
                        const custo = e.total_compra ?? 0
                        const cx = (e.palete as any)?.caixas ?? 0
                        const dataObj = new Date(e.data_saida || '')
                        const diaStr = `${dataObj.getDate()}/${dataObj.getMonth() + 1}`

                        totalVendido += venda
                        totalCustoExpedidos += custo
                        caixasVendidas += cx

                        // Histórico de Dias
                        if (!salesByDay[diaStr]) salesByDay[diaStr] = { faturamento: 0, lucro: 0 }
                        salesByDay[diaStr].faturamento += venda
                        salesByDay[diaStr].lucro += (venda - custo)

                        // Top Clientes
                        if (e.cliente) {
                            const cnome = (e.cliente as any).nome
                            if (!clientesMap[cnome]) clientesMap[cnome] = { total: 0, cx: 0 }
                            clientesMap[cnome].total += venda
                            clientesMap[cnome].cx += cx
                        }

                        // Status Vendedores
                        if (e.vendedor_nome) {
                            if (!vendsMap[e.vendedor_nome]) vendsMap[e.vendedor_nome] = { total: 0, ped: 0 }
                            vendsMap[e.vendedor_nome].total += venda
                            vendsMap[e.vendedor_nome].ped += 1 // Considera cada expedição como 1 "item/movimento" do vendedor
                        }
                    })

                // Calcula totais
                const lucro = totalVendido - totalCustoExpedidos
                const ticketMedio = caixasVendidas > 0 ? totalVendido / caixasVendidas : 0
                const margemLucro = totalVendido > 0 ? (lucro / totalVendido) * 100 : 0

                // Pedidos Pendentes
                const pedidosPendentesCount = pedidos?.length ?? 0
                let pedidosPendentesValor = 0
                pedidos?.forEach(p => { pedidosPendentesValor += (p.valor_total_liquido ?? 0) })

                setKpi({
                    totalPaletes, totalCaixas, totalComprado: totalCustoExpedidos,
                    totalVendido, lucro, alertaFrios,
                    ticketMedio, pedidosPendentesCount, pedidosPendentesValor, margemLucro
                })

                // Montar Arrays para Gráficos
                const historicoArr = Object.entries(salesByDay).map(([data, v]) => ({ data, ...v }))
                // Se tiver poucos dias, os gráficos de linha ficam vazios, ideal ordenar por data.
                // Como as chaves são dd/mm, simplificamos mantendo a ordem de inserção caso seja os últimos 7 dias.
                setSalesHistory(historicoArr)

                setTopClientes(
                    Object.entries(clientesMap)
                        .map(([nome, val]) => ({ nome, totalGasto: val.total, caixas: val.cx }))
                        .sort((a, b) => b.totalGasto - a.totalGasto)
                        .slice(0, 5)
                )

                setTopVendedores(
                    Object.entries(vendsMap)
                        .map(([nome, val]) => ({ nome, totalVendido: val.total, pedidos: val.ped }))
                        .sort((a, b) => b.totalVendido - a.totalVendido)
                        .slice(0, 5)
                )

            } finally {
                setLoading(false)
            }
        }
        load()
    }, [isDono, timeFilter])

    const dominantCat = catData.length > 0
        ? catData.reduce((a, b) => a.value > b.value ? a : b).name
        : 'CAT1'

    const catTotal = catData.reduce((s, c) => s + c.value, 0)

    if (loading && !kpi) return (
        <div>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Header com Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-border">
                <div>
                    <h1 className="text-xl font-black text-foreground">Visão Geral do Negócio</h1>
                    <p className="text-sm text-muted">Acompanhe seus principais indicadores financeiros e de operação.</p>
                </div>
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                    <button onClick={() => setTimeFilter('hoje')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeFilter === 'hoje' ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-muted hover:text-foreground'}`}>Hoje</button>
                    <button onClick={() => setTimeFilter('7dias')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeFilter === '7dias' ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-muted hover:text-foreground'}`}>7 Dias</button>
                    <button onClick={() => setTimeFilter('mes')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeFilter === 'mes' ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-muted hover:text-foreground'}`}>Mês Atual</button>
                    <button onClick={() => setTimeFilter('tudo')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeFilter === 'tudo' ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-muted hover:text-foreground'}`}>Sempre</button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {isBeta ? (
                    <div className="col-span-2 md:col-span-3 card flex items-center justify-center gap-3 text-muted text-sm py-6">
                        <Lock className="w-4 h-4 flex-shrink-0" />
                        <span>Dados financeiros <strong>restritos</strong> no Modo Beta</span>
                    </div>
                ) : (
                    <>
                        <KpiCard
                            label="Faturamento Liquido"
                            value={formatCurrency(kpi?.totalVendido ?? 0)}
                            icon={<TrendingUp className="w-5 h-5 text-brand-500" />}
                            sublabel={timeFilter.toUpperCase()}
                        />
                        <KpiCard
                            label="Lucro Bruto"
                            value={formatCurrency(kpi?.lucro ?? 0)}
                            icon={<DollarSign className="w-5 h-5 text-success" />}
                            sublabel={`Margem: ${kpi?.margemLucro.toFixed(1)}%`}
                            trendUp={kpi ? kpi.lucro > 0 : undefined}
                        />
                        <KpiCard
                            label="Ticket Médio / Caixa"
                            value={formatCurrency(kpi?.ticketMedio ?? 0)}
                            icon={<ShoppingCart className="w-5 h-5 text-brand-500" />}
                            sublabel={`${(kpi?.totalVendido ?? 0) > 0 ? 'Bom desempenho' : '-'}`}
                        />
                    </>
                )}
                <KpiCard
                    label="Pedidos Pendentes"
                    value={String(kpi?.pedidosPendentesCount ?? 0)}
                    icon={<Clock className="w-5 h-5 text-warning" />}
                    sublabel={isBeta ? '••••' : formatCurrency(kpi?.pedidosPendentesValor ?? 0)}
                    alert={kpi ? kpi.pedidosPendentesCount > 5 : undefined}
                />
                <KpiCard
                    label="Estoque Principal"
                    value={`${kpi?.totalPaletes ?? 0} Plts`}
                    icon={<Package className="w-5 h-5 text-brand-500" />}
                    sublabel={`${(kpi?.totalCaixas ?? 0).toLocaleString('pt-BR')} Caixas`}
                />
            </div>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Evolução de Vendas e Lucro */}
                {isBeta ? (
                    <div className="card lg:col-span-2 flex flex-col items-center justify-center gap-3 text-muted min-h-[200px]">
                        <Lock className="w-8 h-8 opacity-30" />
                        <p className="text-sm font-semibold">Evolução de Faturamento e Lucro</p>
                        <p className="text-xs">Restrito no Modo Beta</p>
                    </div>
                ) : (
                    <div className="card lg:col-span-2">
                        <h2 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-brand-500" />
                            Evolução de Faturamento e Lucro
                        </h2>
                        {salesHistory.length === 0 ? (
                            <div className="h-64 flex items-center justify-center text-muted text-sm bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-dashed border-border">
                                Nenhuma venda concluída ou expedida neste período.
                            </div>
                        ) : (
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={salesHistory} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="data" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value / 1000}k`} />
                                        <Tooltip
                                            formatter={(value: any) => formatCurrency(Number(value))}
                                            contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
                                        />
                                        <Legend iconType="circle" />
                                        <Line type="monotone" name="Faturamento" dataKey="faturamento" stroke="#C9A236" strokeWidth={3} dot={{ r: 4, fill: '#C9A236' }} activeDot={{ r: 6 }} />
                                        <Line type="monotone" name="Lucro Bruto" dataKey="lucro" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                )}

                {/* Donut Chart - Qualidade */}
                <div className="card bg-gradient-to-br from-[var(--card)] to-zinc-50 dark:to-zinc-900/10 border-none shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-foreground flex items-center gap-2"><Box className="w-4 h-4 text-brand-500" /> Qualidade em Estoque</h2>
                    </div>
                    {catTotal === 0 ? (
                        <div className="h-48 flex items-center justify-center text-muted text-sm">Estoque vazio</div>
                    ) : (
                        <>
                            <div className="relative h-48 mb-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={catData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                                            {catData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: any) => [`${v} paletes`, 'Quantidade']} contentStyle={{ borderRadius: '8px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-xl font-black text-foreground">{dominantCat}</span>
                                    <span className="text-[10px] uppercase font-bold text-muted tracking-tighter">líder</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {catData.map((c) => (
                                    <div key={c.name} className="flex items-center justify-between text-sm bg-white dark:bg-zinc-800/50 p-2 rounded-lg border border-border">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                                            <span className="font-semibold">{c.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right flex flex-col items-end">
                                                <div className="text-muted text-xs font-medium">{c.value} plt <span className="text-[10px] opacity-50">/</span> {c.caixas ?? 0} cx</div>
                                                {c.oldest && <div className="text-[10px] font-medium text-brand-600 dark:text-brand-400 tracking-tighter uppercase">Desde {new Date(c.oldest).toLocaleDateString('pt-BR')}</div>}
                                            </div>
                                            <span className="font-black w-10 text-right">{catTotal > 0 ? Math.round((c.value / catTotal) * 100) : 0}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Bottom Row - Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Ranking de Clientes */}
                <div className="card h-full">
                    <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-brand-500" />
                        Top 5 Clientes (Faturamento)
                    </h2>
                    {topClientes.length === 0 ? (
                        <p className="text-sm text-muted text-center py-8">Nenhum dado encontrado</p>
                    ) : (
                        <div className="space-y-3">
                            {topClientes.map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-border group hover:border-brand-500/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black
                                            ${i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                                                i === 1 ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300' :
                                                    i === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                                                        'bg-brand-50 text-brand-600 dark:bg-brand-900/20'}
                                        `}>
                                            #{i + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-foreground line-clamp-1">{c.nome}</p>
                                            <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">{c.caixas.toLocaleString('pt-BR')} caixas compradas</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-brand-600">{isBeta ? '••••' : formatCurrency(c.totalGasto)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Desempenho de Vendedores */}
                <div className="card h-full">
                    <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-brand-500" />
                        Desempenho da Equipe (Vendas)
                    </h2>
                    {topVendedores.length === 0 ? (
                        <p className="text-sm text-muted text-center py-8">Nenhum dado encontrado</p>
                    ) : (
                        <div className="space-y-3">
                            {topVendedores.map((v, i) => {
                                const maxSales = topVendedores[0]?.totalVendido || 1
                                const pct = (v.totalVendido / maxSales) * 100
                                return (
                                    <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-border">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold text-foreground">{v.nome}</span>
                                            <span className="text-sm font-black text-brand-600">{isBeta ? '••••' : formatCurrency(v.totalVendido)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted w-20 text-right">{v.pedidos} ações</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* Gráfico Barras Variedades/CAT */}
            <div className="card">
                <h2 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                    <Package className="w-4 h-4 text-brand-500" />
                    Estoque Disponível: Variedade x Qualidade (Top 5)
                </h2>
                {estoqueVar.length === 0 ? (
                    <p className="text-sm text-muted text-center py-8">Estoque vazio</p>
                ) : (
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={estoqueVar} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="nome" stroke="var(--muted)" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                                <YAxis stroke="var(--muted)" fontSize={11} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }} cursor={{ fill: 'var(--muted)', opacity: 0.1 }} />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="CAT1" name="Categoria 1" stackId="a" fill={CAT_COLORS.CAT1} radius={[0, 0, 4, 4]} maxBarSize={50} />
                                <Bar dataKey="CAT2" name="Categoria 2" stackId="a" fill={CAT_COLORS.CAT2} maxBarSize={50} />
                                <Bar dataKey="CAT3" name="Categoria 3" stackId="a" fill={CAT_COLORS.CAT3} radius={[4, 4, 0, 0]} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

        </div>
    )
}

function KpiCard({ label, value, icon, sublabel, trendUp, alert }: {
    label: string; value: string; icon: React.ReactNode; sublabel?: string; trendUp?: boolean; alert?: boolean
}) {
    return (
        <div className={`card group relative overflow-hidden transition-all duration-300 hover:shadow-lg ${alert ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10' : 'hover:border-brand-500/30'}`}>
            {alert && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-500/10 to-transparent -mr-8 -mt-8 rotate-45" />
            )}
            <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</span>
                <div className={`p-2 rounded-xl transition-colors ${alert ? 'bg-amber-500/20 text-amber-500' : 'bg-brand-500/10 text-brand-600 group-hover:bg-brand-500 group-hover:text-white'}`}>
                    {icon}
                </div>
            </div>
            <div className="flex flex-col relative z-10">
                <span className={`text-2xl font-black tracking-tight ${alert ? 'text-amber-600 dark:text-amber-500' : 'text-foreground'}`}>{value}</span>
                {sublabel && (
                    <span className={`text-xs font-semibold mt-1 flex items-center gap-1 ${trendUp === true ? 'text-success' : trendUp === false ? 'text-danger' : 'text-muted'}`}>
                        {sublabel}
                    </span>
                )}
            </div>
        </div>
    )
}
