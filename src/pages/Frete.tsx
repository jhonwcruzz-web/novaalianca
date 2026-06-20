import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/utils'
import toast from 'react-hot-toast'
import { Plus, X, Truck, MapPin, ArrowRight } from 'lucide-react'

type TipoFrete = 'coleta_uva' | 'entrega_material'
type StatusFrete = 'agendado' | 'em_transito' | 'concluido' | 'cancelado'

interface Frete {
    id: string
    tipo: TipoFrete
    data: string
    freteiro_nome: string
    freteiro_cpf: string | null
    veiculo_placa: string | null
    veiculo_tipo: string | null
    origem: string
    destino: string
    fazenda: string | null
    valor: number
    carga_descricao: string | null
    peso_kg: number | null
    status: StatusFrete
    observacoes: string | null
    created_at: string
}

const TIPO_LABEL: Record<TipoFrete, string> = {
    coleta_uva:       'Coleta de Uva',
    entrega_material: 'Entrega de Material',
}
const TIPO_COLOR: Record<TipoFrete, string> = {
    coleta_uva:       'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 badge',
    entrega_material: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 badge',
}
const STATUS_COLOR: Record<StatusFrete, string> = {
    agendado:    'badge-warning',
    em_transito: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 badge',
    concluido:   'badge-success',
    cancelado:   'badge-danger',
}

export default function Frete() {
    const { role } = useAuth()
    const canOperate = role === 'dono' || role === 'operador'

    const [fretes, setFretes] = useState<Frete[]>([])
    const [loading, setLoading] = useState(true)
    const [filtTipo, setFiltTipo] = useState<string>('')
    const [filtStatus, setFiltStatus] = useState<string>('')
    const [filtMes, setFiltMes] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editando, setEditando] = useState<Frete | null>(null)

    async function fetchFretes() {
        setLoading(true)
        const { data } = await supabase.from('fretes').select('*').order('data', { ascending: false })
        setFretes((data ?? []) as Frete[])
        setLoading(false)
    }

    useEffect(() => { fetchFretes() }, [])

    // Filtros
    const filtered = fretes.filter(f => {
        if (filtTipo && f.tipo !== filtTipo) return false
        if (filtStatus && f.status !== filtStatus) return false
        if (filtMes && !f.data.startsWith(filtMes)) return false
        return true
    })

    // KPIs globais
    const concluidos = fretes.filter(f => f.status === 'concluido')
    const totalGasto = concluidos.reduce((s, f) => s + f.valor, 0)
    const totalViagens = fretes.length
    const agendados = fretes.filter(f => f.status === 'agendado').length

    // Analytics: top freteiros
    const porFreteiro = Object.values(
        concluidos.reduce<Record<string, { nome: string; total: number; viagens: number }>>((acc, f) => {
            if (!acc[f.freteiro_nome]) acc[f.freteiro_nome] = { nome: f.freteiro_nome, total: 0, viagens: 0 }
            acc[f.freteiro_nome].total += f.valor
            acc[f.freteiro_nome].viagens++
            return acc
        }, {})
    ).sort((a, b) => b.total - a.total).slice(0, 5)

    // Analytics: top rotas
    const porRota = Object.values(
        concluidos.reduce<Record<string, { rota: string; total: number; viagens: number }>>((acc, f) => {
            const rota = `${f.origem} → ${f.destino}`
            if (!acc[rota]) acc[rota] = { rota, total: 0, viagens: 0 }
            acc[rota].total += f.valor
            acc[rota].viagens++
            return acc
        }, {})
    ).sort((a, b) => b.total - a.total).slice(0, 5)

    async function excluir(id: string) {
        if (!confirm('Excluir este frete?')) return
        const { error } = await supabase.from('fretes').delete().eq('id', id)
        if (error) toast.error('Erro ao excluir')
        else { toast.success('Frete excluído'); fetchFretes() }
    }

    // Meses disponíveis para filtro
    const meses = [...new Set(fretes.map(f => f.data.slice(0, 7)))].sort().reverse()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestão de Fretes</h1>
                    <p className="text-sm text-muted mt-0.5">Controle de coletas de uva e entregas de materiais para fazendas.</p>
                </div>
                {canOperate && (
                    <button onClick={() => { setEditando(null); setShowModal(true) }} className="btn-gold text-sm py-2">
                        <Plus className="w-4 h-4" /> Registrar Frete
                    </button>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total Gasto (Concluídos)</p>
                    <h3 className="text-xl font-black text-foreground">{formatCurrency(totalGasto)}</h3>
                </div>
                <div className="card">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total de Viagens</p>
                    <h3 className="text-2xl font-black text-foreground">{totalViagens}</h3>
                </div>
                <div className="card">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Coletas de Uva</p>
                    <h3 className="text-2xl font-black text-purple-600">{fretes.filter(f => f.tipo === 'coleta_uva').length}</h3>
                </div>
                <div className={`card cursor-pointer transition-all hover:border-brand-400 ${filtStatus === 'agendado' ? 'ring-2 ring-[var(--accent)]' : ''}`}
                    onClick={() => setFiltStatus(filtStatus === 'agendado' ? '' : 'agendado')}>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Agendados</p>
                    <h3 className={`text-2xl font-black ${agendados > 0 ? 'text-warning' : 'text-foreground'}`}>{agendados}</h3>
                </div>
            </div>

            {/* Analytics */}
            {concluidos.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top Freteiros */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-4">
                            <Truck className="w-4 h-4 text-muted" />
                            <h3 className="text-xs font-black text-muted uppercase tracking-widest">Freteiros por Custo Total</h3>
                        </div>
                        <div className="space-y-2">
                            {porFreteiro.map((f, i) => (
                                <div key={f.nome} className="flex items-center gap-3">
                                    <span className="text-xs font-black text-muted w-4">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-sm font-semibold text-foreground truncate">{f.nome}</span>
                                            <span className="text-sm font-black text-foreground ml-2 flex-shrink-0">{formatCurrency(f.total)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                                                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(f.total / porFreteiro[0].total) * 100}%` }} />
                                            </div>
                                            <span className="text-[10px] text-muted flex-shrink-0">{f.viagens}x</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Rotas */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-4">
                            <MapPin className="w-4 h-4 text-muted" />
                            <h3 className="text-xs font-black text-muted uppercase tracking-widest">Rotas por Custo Total</h3>
                        </div>
                        <div className="space-y-2">
                            {porRota.map((r, i) => (
                                <div key={r.rota} className="flex items-center gap-3">
                                    <span className="text-xs font-black text-muted w-4">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-xs font-semibold text-foreground truncate">{r.rota}</span>
                                            <span className="text-sm font-black text-foreground ml-2 flex-shrink-0">{formatCurrency(r.total)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                                                <div className="h-full rounded-full bg-purple-500" style={{ width: `${(r.total / porRota[0].total) * 100}%` }} />
                                            </div>
                                            <span className="text-[10px] text-muted flex-shrink-0">{r.viagens}x</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filtros */}
            <div className="card py-3">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-muted uppercase tracking-widest">Filtros:</span>
                    <select value={filtTipo} onChange={e => setFiltTipo(e.target.value)} className="input w-48 text-sm">
                        <option value="">Todos os tipos</option>
                        <option value="coleta_uva">Coleta de Uva</option>
                        <option value="entrega_material">Entrega de Material</option>
                    </select>
                    <select value={filtStatus} onChange={e => setFiltStatus(e.target.value)} className="input w-40 text-sm">
                        <option value="">Todos os status</option>
                        <option value="agendado">Agendado</option>
                        <option value="em_transito">Em Trânsito</option>
                        <option value="concluido">Concluído</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                    <select value={filtMes} onChange={e => setFiltMes(e.target.value)} className="input w-40 text-sm">
                        <option value="">Todos os meses</option>
                        {meses.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {(filtTipo || filtStatus || filtMes) && (
                        <button onClick={() => { setFiltTipo(''); setFiltStatus(''); setFiltMes('') }} className="text-sm text-muted hover:text-danger flex items-center gap-1">
                            <X className="w-4 h-4" /> Limpar
                        </button>
                    )}
                    <span className="ml-auto text-xs text-muted">{filtered.length} registro(s)</span>
                </div>
            </div>

            {/* Tabela */}
            <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-6 space-y-2">{[1,2,3,4].map(i => <div key={i} className="skeleton h-12 w-full" />)}</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-16 text-center">
                            <Truck className="w-12 h-12 text-muted mx-auto mb-3 opacity-30" />
                            <p className="text-muted font-semibold">Nenhum frete registrado</p>
                            <p className="text-xs text-muted mt-1">Clique em "Registrar Frete" para começar.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr>
                                    <th className="table-header rounded-l-lg">Data</th>
                                    <th className="table-header">Tipo</th>
                                    <th className="table-header">Freteiro</th>
                                    <th className="table-header">Veículo</th>
                                    <th className="table-header">Fazenda</th>
                                    <th className="table-header">Rota</th>
                                    <th className="table-header">Carga</th>
                                    <th className="table-header text-right">Valor</th>
                                    <th className="table-header text-center">Status</th>
                                    {canOperate && <th className="table-header rounded-r-lg text-center">Ações</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(f => (
                                    <tr key={f.id} className="hover:bg-brand-50/30 transition-colors">
                                        <td className="table-cell whitespace-nowrap text-muted">{new Date(f.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td className="table-cell"><span className={TIPO_COLOR[f.tipo]}>{TIPO_LABEL[f.tipo]}</span></td>
                                        <td className="table-cell">
                                            <p className="font-semibold text-foreground">{f.freteiro_nome}</p>
                                            {f.freteiro_cpf && <p className="text-xs text-muted">{f.freteiro_cpf}</p>}
                                        </td>
                                        <td className="table-cell">
                                            <p className="font-mono text-sm text-foreground">{f.veiculo_placa ?? '—'}</p>
                                            {f.veiculo_tipo && <p className="text-xs text-muted">{f.veiculo_tipo}</p>}
                                        </td>
                                        <td className="table-cell text-foreground">{f.fazenda ?? '—'}</td>
                                        <td className="table-cell">
                                            <div className="flex items-center gap-1 text-sm">
                                                <span className="text-muted truncate max-w-[80px]">{f.origem}</span>
                                                <ArrowRight className="w-3 h-3 text-muted flex-shrink-0" />
                                                <span className="text-foreground font-medium truncate max-w-[80px]">{f.destino}</span>
                                            </div>
                                        </td>
                                        <td className="table-cell text-muted max-w-[120px] truncate">{f.carga_descricao ?? '—'}</td>
                                        <td className="table-cell text-right font-black text-foreground">{formatCurrency(f.valor)}</td>
                                        <td className="table-cell text-center">
                                            <span className={STATUS_COLOR[f.status]}>{f.status.replace('_', ' ')}</span>
                                        </td>
                                        {canOperate && (
                                            <td className="table-cell">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => { setEditando(f); setShowModal(true) }}
                                                        className="text-[10px] font-bold px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground transition">
                                                        Edit.
                                                    </button>
                                                    <button onClick={() => excluir(f.id)} className="p-1 text-muted hover:text-danger transition">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                            {filtered.length > 0 && (
                                <tfoot>
                                    <tr className="border-t-2 border-border">
                                        <td colSpan={7} className="table-cell text-xs font-black text-muted uppercase tracking-widest">
                                            Total filtrado ({filtered.filter(f => f.status === 'concluido').length} concluídos)
                                        </td>
                                        <td className="table-cell text-right font-black text-foreground">
                                            {formatCurrency(filtered.filter(f => f.status === 'concluido').reduce((s, f) => s + f.valor, 0))}
                                        </td>
                                        <td colSpan={canOperate ? 2 : 1} />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    )}
                </div>
            </div>

            {showModal && (
                <FreteModal
                    frete={editando}
                    onClose={() => { setShowModal(false); setEditando(null) }}
                    onSuccess={() => { setShowModal(false); setEditando(null); fetchFretes() }}
                />
            )}
        </div>
    )
}

// ── Modal: Registrar / Editar Frete ───────────────────────────────────────────
function FreteModal({ frete, onClose, onSuccess }: {
    frete: Frete | null
    onClose: () => void
    onSuccess: () => void
}) {
    const [tipo, setTipo] = useState<TipoFrete>(frete?.tipo ?? 'coleta_uva')
    const [data, setData] = useState(frete?.data ?? new Date().toISOString().slice(0, 10))
    const [freteiro, setFreteiro] = useState(frete?.freteiro_nome ?? '')
    const [cpf, setCpf] = useState(frete?.freteiro_cpf ?? '')
    const [placa, setPlaca] = useState(frete?.veiculo_placa ?? '')
    const [veicTipo, setVeicTipo] = useState(frete?.veiculo_tipo ?? '')
    const [origem, setOrigem] = useState(frete?.origem ?? '')
    const [destino, setDestino] = useState(frete?.destino ?? '')
    const [fazenda, setFazenda] = useState(frete?.fazenda ?? '')
    const [valor, setValor] = useState(String(frete?.valor ?? ''))
    const [carga, setCarga] = useState(frete?.carga_descricao ?? '')
    const [peso, setPeso] = useState(String(frete?.peso_kg ?? ''))
    const [status, setStatus] = useState<StatusFrete>(frete?.status ?? 'concluido')
    const [obs, setObs] = useState(frete?.observacoes ?? '')
    const [saving, setSaving] = useState(false)

    // Sugestões de fazendas/destinos frequentes
    const [fazendas, setFazendas] = useState<string[]>([])
    const [locaisFretes, setLocaisFretes] = useState<string[]>([])

    useEffect(() => {
        supabase.from('fretes').select('fazenda, origem, destino').then(({ data }) => {
            if (!data) return
            const fs = [...new Set(data.map((d: any) => d.fazenda).filter(Boolean))].sort() as string[]
            const ls = [...new Set([...data.map((d: any) => d.origem), ...data.map((d: any) => d.destino)].filter(Boolean))].sort() as string[]
            setFazendas(fs)
            setLocaisFretes(ls)
        })
    }, [])

    async function save() {
        if (!freteiro.trim()) { toast.error('Informe o nome do freteiro'); return }
        if (!origem.trim() || !destino.trim()) { toast.error('Informe origem e destino'); return }
        if (!valor || Number(valor) < 0) { toast.error('Informe o valor do frete'); return }
        setSaving(true)
        const payload = {
            tipo, data,
            freteiro_nome: freteiro.trim(),
            freteiro_cpf: cpf || null,
            veiculo_placa: placa || null,
            veiculo_tipo: veicTipo || null,
            origem: origem.trim(),
            destino: destino.trim(),
            fazenda: fazenda || null,
            valor: Number(valor),
            carga_descricao: carga || null,
            peso_kg: peso ? Number(peso) : null,
            status,
            observacoes: obs || null,
        }
        const { error } = frete
            ? await supabase.from('fretes').update(payload).eq('id', frete.id)
            : await supabase.from('fretes').insert(payload)
        setSaving(false)
        if (error) toast.error('Erro: ' + error.message)
        else { toast.success(frete ? 'Frete atualizado!' : 'Frete registrado!'); onSuccess() }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-xl border border-border">
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="font-bold text-foreground">{frete ? 'Editar Frete' : 'Registrar Frete'}</h2>
                    <button onClick={onClose} className="text-muted hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4 max-h-[74vh] overflow-y-auto custom-scrollbar">
                    {/* Tipo */}
                    <div>
                        <label className="form-label">Tipo de Frete</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['coleta_uva', 'entrega_material'] as TipoFrete[]).map(t => (
                                <button key={t} onClick={() => setTipo(t)}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${tipo === t ? 'bg-[var(--accent)] text-[#1A0A2E] border-[var(--accent)]' : 'border-border text-muted hover:border-brand-400'}`}>
                                    {t === 'coleta_uva' ? '🍇 Coleta de Uva' : '📦 Entrega de Material'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">Data</label>
                            <input type="date" value={data} onChange={e => setData(e.target.value)} className="input w-full" />
                        </div>
                        <div>
                            <label className="form-label">Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value as StatusFrete)} className="input w-full">
                                <option value="agendado">Agendado</option>
                                <option value="em_transito">Em Trânsito</option>
                                <option value="concluido">Concluído</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>
                    </div>

                    {/* Freteiro */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="form-label">Nome do Freteiro / Transportadora *</label>
                            <input value={freteiro} onChange={e => setFreteiro(e.target.value)} className="input w-full" placeholder="Nome completo" />
                        </div>
                        <div>
                            <label className="form-label">CPF do Freteiro</label>
                            <input value={cpf} onChange={e => setCpf(e.target.value)} className="input w-full" placeholder="000.000.000-00" />
                        </div>
                        <div>
                            <label className="form-label">Tipo de Veículo</label>
                            <select value={veicTipo} onChange={e => setVeicTipo(e.target.value)} className="input w-full">
                                <option value="">Selecionar</option>
                                {['Caminhão', 'Caminhonete', 'Carreta', 'Truck', 'Bitruck', 'Van'].map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Placa do Veículo</label>
                            <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} className="input w-full font-mono" placeholder="ABC-1234" />
                        </div>
                    </div>

                    {/* Fazenda */}
                    <div>
                        <label className="form-label">Fazenda {tipo === 'coleta_uva' ? '(origem da uva)' : '(destino do material)'}</label>
                        <input
                            value={fazenda}
                            onChange={e => setFazenda(e.target.value)}
                            className="input w-full"
                            placeholder="Ex: SANTA FELICIDADE"
                            list="fazendas-list"
                        />
                        <datalist id="fazendas-list">
                            {fazendas.map(f => <option key={f} value={f} />)}
                        </datalist>
                    </div>

                    {/* Origem → Destino */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">Origem *</label>
                            <input value={origem} onChange={e => setOrigem(e.target.value)} className="input w-full"
                                placeholder={tipo === 'coleta_uva' ? 'Ex: SANTA FELICIDADE' : 'Ex: GVS'} list="locais-list" />
                        </div>
                        <div>
                            <label className="form-label">Destino *</label>
                            <input value={destino} onChange={e => setDestino(e.target.value)} className="input w-full"
                                placeholder={tipo === 'coleta_uva' ? 'Ex: GVS' : 'Ex: SANTA FELICIDADE'} list="locais-list" />
                        </div>
                        <datalist id="locais-list">
                            {locaisFretes.map(l => <option key={l} value={l} />)}
                        </datalist>
                    </div>

                    {/* Carga e Peso */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">Descrição da Carga</label>
                            <input value={carga} onChange={e => setCarga(e.target.value)} className="input w-full"
                                placeholder={tipo === 'coleta_uva' ? 'Ex: UVA VITÓRIA CAT1' : 'Ex: Caixas plásticas'} />
                        </div>
                        <div>
                            <label className="form-label">Peso (kg)</label>
                            <input type="number" min="0" step="0.1" value={peso} onChange={e => setPeso(e.target.value)} className="input w-full" placeholder="0" />
                        </div>
                    </div>

                    {/* Valor */}
                    <div>
                        <label className="form-label">Valor do Frete (R$) *</label>
                        <input type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)}
                            className="input w-full text-lg font-bold" placeholder="0,00" />
                    </div>

                    <div>
                        <label className="form-label">Observações</label>
                        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className="input w-full resize-none" />
                    </div>
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button onClick={save} disabled={saving} className="btn-gold">{saving ? 'Salvando...' : 'Salvar Frete'}</button>
                </div>
            </div>
        </div>
    )
}
