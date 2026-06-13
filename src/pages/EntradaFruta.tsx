import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/utils'
import {
    TrendingUp, Package, Box, DollarSign,
    Users, Award, BarChart3, Carrot
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

interface ProdutorMetrics {
    id: string
    nome: string
    caixas: number
    kg: number
    custoTotal: number
    vendaTotal: number
    lucro: number
    margem: number
}

interface KpiData {
    totalKilos: number
    totalCaixas: number
    custoTotal: number
    lucroTotal: number
    margemMedia: number
}

function SkeletonCard() {
    return <div className="card"><div className="skeleton h-4 w-24 mb-3" /><div className="skeleton h-8 w-32" /></div>
}

export default function CaptaçãoDashboard() {
    const { isBeta } = useAuth()
    const [kpi, setKpi] = useState<KpiData | null>(null)
    const [produtores, setProdutores] = useState<ProdutorMetrics[]>([])
    const [loading, setLoading] = useState(true)
    const [timeFilter, setTimeFilter] = useState<'mes' | 'tudo'>('mes')

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                // Determine Date Filter
                let startDate = ''
                if (timeFilter === 'mes') {
                    const now = new Date()
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
                }

                // Fetch expedited pallets, as costs and sales are matched here
                let query = supabase
                    .from('expedicao')
                    .select('valor_venda_total_liquido, total_compra:valor_total, data_saida, palete:palete_id(caixas, peso_total_kg, produtor:produtor_id(id, nome))')
                    .not('status', 'eq', 'cancelado')

                if (startDate) {
                    query = query.gte('data_saida', startDate)
                }

                const { data: expedicoes } = await query

                const prodMap: Record<string, ProdutorMetrics> = {}
                let tKg = 0, tCaixas = 0, tCusto = 0, tVenda = 0;

                (expedicoes ?? []).forEach(e => {
                    const venda = e.valor_venda_total_liquido ?? 0
                    const custo = e.total_compra ?? 0
                    const palete = e.palete as any
                    if (!palete) return

                    const cx = palete.caixas ?? 0
                    const kg = palete.peso_total_kg ?? 0
                    const prod = palete.produtor

                    tKg += kg
                    tCaixas += cx
                    tCusto += custo
                    tVenda += venda

                    if (prod && prod.id) {
                        if (!prodMap[prod.id]) {
                            prodMap[prod.id] = { id: prod.id, nome: prod.nome, caixas: 0, kg: 0, custoTotal: 0, vendaTotal: 0, lucro: 0, margem: 0 }
                        }
                        prodMap[prod.id].caixas += cx
                        prodMap[prod.id].kg += kg
                        prodMap[prod.id].custoTotal += custo
                        prodMap[prod.id].vendaTotal += venda
                    }
                })

                // Calculate Margins
                const prodArray = Object.values(prodMap).map(p => {
                    p.lucro = p.vendaTotal - p.custoTotal
                    p.margem = p.vendaTotal > 0 ? (p.lucro / p.vendaTotal) * 100 : 0
                    return p
                })

                const lucroTotal = tVenda - tCusto
                const margemMedia = tVenda > 0 ? (lucroTotal / tVenda) * 100 : 0

                setKpi({
                    totalKilos: tKg,
                    totalCaixas: tCaixas,
                    custoTotal: tCusto,
                    lucroTotal,
                    margemMedia
                })

                setProdutores(prodArray)

            } finally {
                setLoading(false)
            }
        }
        load()
    }, [timeFilter])

    if (loading && !kpi) return (
        <div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
        </div>
    )

    const topVolume = [...produtores].sort((a, b) => b.kg - a.kg).slice(0, 5)
    const topMargem = [...produtores].filter(p => p.kg > 0).sort((a, b) => b.margem - a.margem).slice(0, 5)

    return (
        <div className="space-y-6">
            {/* Header / Filtro */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-border">
                <div>
                    <h1 className="text-xl font-black text-foreground">Painel de Captação</h1>
                    <p className="text-sm text-muted">Métricas de produtores, volumes captados e margem de lucro por fornecedor.</p>
                </div>
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                    <button onClick={() => setTimeFilter('mes')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeFilter === 'mes' ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-muted hover:text-foreground'}`}>Mês Atual</button>
                    <button onClick={() => setTimeFilter('tudo')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeFilter === 'tudo' ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-muted hover:text-foreground'}`}>Sempre</button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KpiCard
                    label="Volume Captado (KG)"
                    value={`${kpi?.totalKilos.toLocaleString('pt-BR')} kg`}
                    icon={<Carrot className="w-5 h-5 text-brand-500" />}
                />
                <KpiCard
                    label="Volume (Caixas)"
                    value={`${kpi?.totalCaixas.toLocaleString('pt-BR')} cx`}
                    icon={<Box className="w-5 h-5 text-brand-500" />}
                />
                {!isBeta && (
                    <KpiCard
                        label="Pagamento a Produtores"
                        value={formatCurrency(kpi?.custoTotal ?? 0)}
                        icon={<DollarSign className="w-5 h-5 text-amber-500" />}
                    />
                )}
                {!isBeta && (
                    <KpiCard
                        label="Lucro Gerado"
                        value={formatCurrency(kpi?.lucroTotal ?? 0)}
                        icon={<TrendingUp className="w-5 h-5 text-success" />}
                    />
                )}
                {!isBeta && (
                    <KpiCard
                        label="Geração de Margem"
                        value={`${kpi?.margemMedia.toFixed(1)}%`}
                        icon={<BarChart3 className="w-5 h-5 text-brand-500" />}
                        highlight
                    />
                )}
            </div>

            {/* Rankings e Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Top Produtores Volume */}
                <div className="card">
                    <h2 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                        <Users className="w-4 h-4 text-brand-500" />
                        Top 5 Produtores (Volume em KG)
                    </h2>
                    {topVolume.length === 0 ? (
                        <p className="text-sm text-muted text-center py-8">Sem dados no período</p>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topVolume} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                                    <XAxis type="number" stroke="var(--muted)" fontSize={11} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="nome" type="category" width={100} stroke="var(--muted)" fontSize={11} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                        contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                        formatter={(val: any) => [`${(Number(val) || 0).toLocaleString('pt-BR')} kg`, 'Volume']}
                                    />
                                    <Bar dataKey="kg" fill="#5C2E99" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Top Produtores Rentabilidade */}
                <div className="card">
                    <h2 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        Produtores Mais Rentáveis (Margem %)
                    </h2>
                    {topMargem.length === 0 ? (
                        <p className="text-sm text-muted text-center py-8">Sem dados no período</p>
                    ) : (
                        <div className="space-y-4">
                            {topMargem.map((p, i) => (
                                <div key={p.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-border flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-brand-50 text-brand-600 dark:bg-brand-900/20'}`}>
                                            #{i + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-foreground">{p.nome}</p>
                                            <p className="text-[10px] uppercase font-bold text-muted">Forneceu {p.kg.toLocaleString('pt-BR')} kg</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-success">{p.margem.toFixed(1)}%</p>
                                        {!isBeta && <p className="text-[10px] uppercase font-bold text-muted">Lucro Mín: {formatCurrency(p.lucro)}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Participação de Custo x Volume */}
                <div className="card lg:col-span-2">
                    <h2 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                        <Package className="w-4 h-4 text-brand-500" />
                        Visão Geral de Captação por Produtor
                    </h2>
                    {produtores.length === 0 ? (
                        <p className="text-sm text-muted text-center py-8">Sem dados no período</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr>
                                        <th className="table-header rounded-l-lg">Produtor</th>
                                        <th className="table-header text-right">Caixas</th>
                                        <th className="table-header text-right">Volume (KG)</th>
                                        {!isBeta && <th className="table-header text-right">Custo Total</th>}
                                        {!isBeta && <th className="table-header text-right">Venda Total</th>}
                                        {!isBeta && <th className="table-header text-right">Lucro</th>}
                                        <th className="table-header rounded-r-lg text-center">Margem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {produtores.sort((a, b) => b.kg - a.kg).map(p => (
                                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-brand-50/10 transition-colors">
                                            <td className="table-cell font-bold text-foreground">{p.nome}</td>
                                            <td className="table-cell text-right">{p.caixas.toLocaleString('pt-BR')}</td>
                                            <td className="table-cell text-right font-semibold">{p.kg.toLocaleString('pt-BR')} kg</td>
                                            {!isBeta && <td className="table-cell text-right text-muted">{formatCurrency(p.custoTotal)}</td>}
                                            {!isBeta && <td className="table-cell text-right">{formatCurrency(p.vendaTotal)}</td>}
                                            {!isBeta && <td className="table-cell text-right font-bold text-success">{formatCurrency(p.lucro)}</td>}
                                            <td className="table-cell text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.margem >= 20 ? 'bg-success/10 text-success' : p.margem > 0 ? 'bg-brand-500/10 text-brand-600' : 'bg-red-500/10 text-red-600'}`}>
                                                    {p.margem.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}

function KpiCard({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
    return (
        <div className={`card group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${highlight ? 'bg-brand-50 dark:bg-brand-900/10 border-brand-500/20' : ''}`}>
            <div className="flex items-center justify-between mb-3 relative z-10">
                <span className={`text-[10px] font-black uppercase tracking-widest ${highlight ? 'text-brand-600/80 dark:text-brand-400' : 'text-muted'}`}>{label}</span>
                <div className={`p-2 rounded-xl transition-colors ${highlight ? 'bg-brand-500 text-white shadow-md' : 'bg-brand-500/10 text-brand-600 group-hover:bg-brand-500 group-hover:text-white'}`}>
                    {icon}
                </div>
            </div>
            <div className="flex flex-col relative z-10">
                <span className={`text-2xl font-black tracking-tight ${highlight ? 'text-brand-700 dark:text-brand-300' : 'text-foreground'}`}>{value}</span>
            </div>
        </div>
    )
}
