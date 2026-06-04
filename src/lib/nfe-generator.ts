import jsPDF from 'jspdf'
import type { Entrada } from './types'
import { EMITENTE } from './emitente'

// NCM padrão para frutas frescas – ajuste por variedade se necessário
const NCM_DEFAULT = '0809.10.00'

function gerarNumeroNF(): string {
    return String(Date.now()).slice(-9).padStart(9, '0')
}

function gerarChaveAcesso(nf: string): string {
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase()
    return `3526 0308 0000 0000 0001 55 001 ${nf.slice(0, 6)} 1 ${rand} 0`
}

function line(doc: jsPDF, y: number): void {
    doc.setDrawColor(200, 200, 200)
    doc.line(14, y, 196, y)
}

function box(doc: jsPDF, x: number, y: number, w: number, h: number): void {
    doc.setDrawColor(180, 180, 180)
    doc.rect(x, y, w, h)
}

export function gerarNFePDF(entrada: Entrada): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const produtor = (entrada.produtor as any)
    const variedade = (entrada.variedade as any)
    const motorista = (entrada.motorista as any)
    const nfNumero = gerarNumeroNF()
    const chave = gerarChaveAcesso(nfNumero)
    const dataEmissao = new Date().toLocaleDateString('pt-BR')
    const dataEntrada = new Date(entrada.data_entrada + 'T12:00:00').toLocaleDateString('pt-BR')
    const pesoTotal = (Number(entrada.caixas) * Number(entrada.peso_caixa || 0))
    const valorTotal = Number(entrada.preco_compra) * Number(entrada.caixas)

    const W = 182 // usable width
    const X = 14  // left margin

    // ─── CABEÇALHO ────────────────────────────────────────────────────────────
    doc.setFillColor(20, 80, 40)
    doc.rect(X, 10, W, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('NF-e  –  NOTA FISCAL DE ENTRADA (SIMULADA)', X + 4, 19)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Nº ${nfNumero}   |   Emissão: ${dataEmissao}`, X + 4, 23)

    // chave de acesso
    doc.setFillColor(240, 245, 240)
    doc.rect(X, 25, W, 7, 'F')
    doc.setTextColor(60, 60, 60)
    doc.setFontSize(7)
    doc.text('CHAVE DE ACESSO (SIMULADA):', X + 2, 29)
    doc.setFont('courier', 'normal')
    doc.text(chave, X + 50, 29)
    doc.setFont('helvetica', 'normal')

    let y = 36

    // ─── EMITENTE ─────────────────────────────────────────────────────────────
    doc.setTextColor(20, 80, 40)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('EMITENTE (COMPRADOR)', X, y)
    y += 2
    line(doc, y); y += 3

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(8.5)
    doc.text(`Razão Social: ${EMITENTE.razao_social}`, X, y); y += 5
    doc.text(`CNPJ: ${EMITENTE.cnpj}   IE: ${EMITENTE.ie}`, X, y); y += 5
    doc.text(`Endereço: ${EMITENTE.endereco} – ${EMITENTE.cidade}/${EMITENTE.estado}   CEP: ${EMITENTE.cep}`, X, y); y += 5
    doc.text(`Tel: ${EMITENTE.telefone}`, X, y); y += 6

    // ─── DESTINATÁRIO / PRODUTOR ──────────────────────────────────────────────
    doc.setTextColor(20, 80, 40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('DESTINATÁRIO / PRODUTOR (REMETENTE DA MERCADORIA)', X, y)
    y += 2
    line(doc, y); y += 3

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(8.5)
    doc.text(`Nome/Razão Social: ${produtor?.nome ?? '—'}`, X, y); y += 5
    doc.text(`CPF/CNPJ: ${produtor?.cpf_cnpj ?? '—'}   Cidade: ${produtor?.cidade ?? '—'}/${produtor?.estado ?? '—'}`, X, y); y += 5
    doc.text(`Tel: ${produtor?.telefone ?? '—'}`, X, y); y += 6

    // ─── TRANSPORTE ───────────────────────────────────────────────────────────
    doc.setTextColor(20, 80, 40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('TRANSPORTE', X, y)
    y += 2
    line(doc, y); y += 3

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(8.5)
    doc.text(`Motorista: ${motorista?.nome ?? '—'}   Placa: ${entrada.placa_caminhao ?? '—'}`, X, y); y += 5
    doc.text(`Data da Entrada: ${dataEntrada}`, X, y); y += 6

    // ─── TABELA DE ITENS ──────────────────────────────────────────────────────
    doc.setTextColor(20, 80, 40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('ITENS DA NOTA FISCAL', X, y)
    y += 2
    line(doc, y); y += 2

    // Header da tabela
    doc.setFillColor(20, 80, 40)
    doc.rect(X, y, W, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    const cols = [X + 2, X + 60, X + 88, X + 104, X + 118, X + 133, X + 152, X + 168]
    const headers = ['DESCRIÇÃO / PRODUTO', 'NCM', 'CAT.', 'UN', 'QTDE', 'PESO/CX (Kg)', 'V.UNIT (R$)', 'TOTAL (R$)']
    headers.forEach((h, i) => doc.text(h, cols[i], y + 4.5))
    y += 7

    // Linha de dados
    doc.setFillColor(245, 252, 245)
    doc.rect(X, y, W, 8, 'F')
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const itemValues = [
        variedade?.nome ?? 'Fruta',
        NCM_DEFAULT,
        entrada.classificacao,
        'CX',
        entrada.caixas.toLocaleString('pt-BR'),
        entrada.peso_caixa ? `${Number(entrada.peso_caixa).toFixed(2)}` : '—',
        `${Number(entrada.preco_compra).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ]
    itemValues.forEach((v, i) => doc.text(v, cols[i], y + 5.5))
    box(doc, X, y, W, 8)
    y += 10

    // ─── TOTAIS ───────────────────────────────────────────────────────────────
    y += 4
    doc.setTextColor(20, 80, 40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('TOTAIS', X, y)
    y += 2
    line(doc, y); y += 4

    const totaisX = X + 90
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(8.5)

    const totais: [string, string][] = [
        ['Total de Caixas:', `${entrada.caixas.toLocaleString('pt-BR')} un`],
        ['Peso Total:', pesoTotal > 0 ? `${pesoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg` : '—'],
        ['Preço por Caixa:', `R$ ${Number(entrada.preco_compra).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
    ]
    totais.forEach(([label, val]) => {
        doc.setFont('helvetica', 'normal')
        doc.text(label, totaisX, y)
        doc.setFont('helvetica', 'bold')
        doc.text(val, totaisX + 50, y)
        y += 5
    })

    // Total geral destacado
    doc.setFillColor(20, 80, 40)
    doc.rect(totaisX - 2, y, 100, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('VALOR TOTAL DA NF-e:', totaisX, y + 5.5)
    doc.text(`R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, totaisX + 60, y + 5.5)
    y += 14

    // ─── INFORMAÇÕES ADICIONAIS ───────────────────────────────────────────────
    doc.setFillColor(255, 248, 220)
    doc.rect(X, y, W, 14, 'F')
    doc.setTextColor(120, 80, 0)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text('⚠  INFORMAÇÕES ADICIONAIS', X + 3, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(
        `Classificação: ${entrada.classificacao} | Variedade: ${variedade?.nome ?? '—'} | Entrada em: ${dataEntrada}`,
        X + 3, y + 8
    )
    doc.text(
        'Este documento é de uso interno e não possui validade fiscal perante a SEFAZ.',
        X + 3, y + 12
    )
    y += 18

    // ─── RODAPÉ ───────────────────────────────────────────────────────────────
    doc.setFillColor(20, 80, 40)
    doc.rect(X, y, W, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.text(
        'DOCUMENTO DE CONTROLE INTERNO – NÃO TEM VALIDADE FISCAL – GrapeDist ERP',
        X + 4, y + 4
    )

    // ─── DOWNLOAD ─────────────────────────────────────────────────────────────
    const idCurto = entrada.id.slice(0, 8).toUpperCase()
    const dataArq = entrada.data_entrada.replace(/-/g, '')
    doc.save(`NF-e_${idCurto}_${dataArq}.pdf`)
}
