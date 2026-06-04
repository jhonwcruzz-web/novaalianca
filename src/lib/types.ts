export type UserRole = 'dono' | 'operador' | 'vendedor'

export interface Profile {
    id: string
    nome: string | null
    role: UserRole
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
    palete?: EstoquePalete
    comprador?: Comprador
    cliente?: { nome: string }
    pedido?: Pedido
}
