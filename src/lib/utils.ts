import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatCurrency(value: number | null | undefined): string {
    if (value == null) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—'
    try {
        return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR })
    } catch {
        return dateStr
    }
}

export function calcDaysFromDate(dateStr: string): number {
    const entryDate = parseISO(dateStr)
    const today = new Date()
    const diffMs = today.getTime() - entryDate.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function getInitials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map(n => n[0])
        .join('')
        .toUpperCase()
}
