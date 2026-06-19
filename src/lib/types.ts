export type UserRole = 'dono' | 'operador' | 'vendedor'

export interface Permissoes {
    telas: {
        dashboard: boolean
        pedidos: boolean
        entrada: boolean
        estoque: boolean
        expedicao: boolean
        cadastros: boolean
        usuarios: boolean
    }
    acoes: {
        importar: boolean
        exportar: boolean
        excluir: boolean
        romaneio: boolean
    }
}

export const DEFAULT_PERMISSIONS: Record<string, Permissoes> = {
    dono: {
        telas: { dashboard: true, pedidos: true, entrada: true, estoque: true, expedicao: true, cadastros: true, usuarios: true },
        acoes: { importar: true, exportar: true, excluir: true, romaneio: true },
    },
    operador: {
        telas: { dashboard: true, pedidos: true, entrada: true, estoque: true, expedicao: true, cadastros: true, usuarios: false },
        acoes: { importar: true, exportar: true, excluir: true, romaneio: true },
    },
    vendedor: {
        telas: { dashboard: true, pedidos: true, entrada: false, estoque: false, expedicao: true, cadastros: false, usuarios: false },
        acoes: { importar: false, exportar: true, excluir: false, romaneio: true },
    },
}

export interface Profile {
    id: string
    nome: string | null
    email: string | null
    role: UserRole
    status: 'ativo' | 'inativo'
    permissions: Permissoes | null
    avatar_url: string | null
    created_at: string
}

export interface Comprador {
    id: string
    nome: string
    status: 'ativo' | 'inativo'
    created_at: string
}

export interface Vendedor {
    id: string
    nome: string
    status: 'ativo' | 'inativo'
    created_at: string
}

export interface Local {
    id: string
    nome: string
    status: 'ativo' | 'inativo'
    created_at: string
}

export interface Motorista {
    id: string
    nome: string
    cpf?: string
    status: 'ativo' | 'inativo'
    created_at: string
}

export interface Produtor {
    id: string
    nome: string
    cpf_cnpj: string | null
    telefone: string | null
    cidade: string | null
    estado: string | null
    status: 'ativo' | 'inativo'
    created_at: string
}

export interface Variedade {
    id: string
    nome: string
    tipo: string | null
    cor: string | null
    categoria: string | null
    status: 'ativo' | 'inativo'
    created_at: string
}

export interface Armazem {
    id: string
    nome: string
    cidade: string | null
    capacidade_tons: number | null
    tipo: string | null
    status: 'ativo' | 'inativo'
    custo_dia_frio: number | null
    limite_dias_frio: number | null
    custo_dia_excedente: number | null
    created_at: string
}

export interface Cliente {
    id: string
    nome: string
    cpf_cnpj: string | null
    telefone: string | null
    cidade: string | null
    limite_credito: number
    status: 'ativo' | 'inativo'
    created_at: string
}


export type Classificacao = 'CAT1' | 'CAT2' | 'CAT3'

export interface Entrada {
    id: string
    data_entrada: string
    produtor_id: string
    variedade_id: string
    comprador_id: string | null
    local_id: string | null
    motorista_id: string | null
    placa_caminhao: string | null
    peso_caixa: number | null
    classificacao: Classificacao
    caixas: number
    preco_compra: number
    total: number
    status: 'concluido' | 'pendente'
    created_at: string
    produtor?: Produtor
    variedade?: Variedade
    comprador?: Comprador
    local?: Local
    motorista?: Motorista
}

export interface EstoquePalete {
    id: string
    data_estoque: string
    data_entrada: string
    numero_palete: string
    descricao: string | null
    caixas: number | null
    peso_caixa: number | null
    peso_total_kg: number | null
    mascaro: string | null
    variedade_id: string | null
    produtor_id: string | null
    classificacao: Classificacao | null
    embalagem: string | null
    marca: string | null
    armazem_id: string | null
    dias_frio: number | null
    mercado: string | null
    status: 'disponivel' | 'reservado' | 'expedido'
    created_at: string
    variedade?: Variedade
    produtor?: Produtor
    armazem?: Armazem
}

export interface Romaneio {
    id: string
    cliente_id: string
    data_saida: string
    valor_venda: number | null
    status: 'pendente' | 'confirmado' | 'cancelado'
    created_at: string
    cliente?: Cliente
}

export interface RomaneioItem {
    id: string
    romaneio_id: string
    palete_id: string
    created_at: string
}

export interface PedidoItem {
    id: string
    pedido_id: string
    variedade_id: string | null
    classificacao: Classificacao | null
    caixas_solicitadas: number
    preco_caixa: number | null
    created_at: string
    variedade?: Variedade
    // calculado via join com expedicao
    caixas_expedidas?: number
}

export interface Pedido {
    id: string
    cliente_id: string
    vendedor_nome: string | null
    motorista_nome: string | null
    motorista_cpf: string | null
    placa_veiculo: string | null
    numero_pedido: string | null
    data_saida: string
    valor_total_bruto: number
    valor_desconto: number
    valor_total_liquido: number
    status: 'pendente' | 'aprovado' | 'despachado' | 'cancelado'
    created_at: string
    cliente?: Cliente
    pedido_itens?: PedidoItem[]
    itens?: Expedicao[]
}

export interface Expedicao {
    id: string
    romaneio_id: string | null
    palete_id: string | null
    pedido_id: string | null
    cliente_id: string | null
    comprador_id: string | null
    data_saida: string | null
    preco_compra: number | null
    valor_venda: number | null
    valor_total: number | null
    status: string
    created_at: string
    vendedor_nome?: string
    motorista_nome?: string
    motorista_cpf?: string
    placa_veiculo?: string
    numero_pedido?: string
    valor_venda_caixa?: number
    valor_venda_total_bruto?: number
    valor_desconto?: number
    valor_venda_total_liquido?: number
    transportador_nome?: string | null
    local_frete?: string | null
    valor_frete?: number | null
    palete?: EstoquePalete
    comprador?: Comprador
    cliente?: { nome: string }
    pedido?: Pedido
}

export type CategoriaInsumo = 'embalagem' | 'paletizacao' | 'colheita' | 'manutencao' | 'descartavel' | 'outros'
export type TipoMovimento = 'entrada' | 'saida' | 'descarte' | 'ajuste'
export type StatusPTV = 'pendente' | 'solicitado' | 'emitido' | 'concluido'

export interface Insumo {
    id: string
    nome: string
    categoria: CategoriaInsumo
    unidade: string
    estoque_atual: number
    estoque_minimo: number
    observacoes: string | null
    status: 'ativo' | 'inativo'
    created_at: string
}

export interface MovimentoInsumo {
    id: string
    insumo_id: string
    tipo: TipoMovimento
    quantidade: number
    referencia: string | null
    data: string
    observacoes: string | null
    created_at: string
    insumo?: Insumo
}

export interface PTV {
    id: string
    pedido_id: string | null
    cfo_id: string | null
    numero_ptv: string | null
    cfop: string
    destino_uf: string | null
    destino_municipio: string | null
    valor_total_nf: number | null
    quantidade_utilizada: number | null
    data_solicitacao: string | null
    data_emissao: string | null
    status: StatusPTV
    observacoes: string | null
    created_at: string
    pedido?: Pedido
}
