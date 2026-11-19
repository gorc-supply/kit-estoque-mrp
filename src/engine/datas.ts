// Datas e períodos. Todas as datas do engine são meia-noite UTC; internamente
// trabalhamos com "dia serial" (dias desde 01/01/1970) para evitar fuso horário.

import type { Periodicidade } from './tipos'

export const DIA_MS = 86_400_000

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function diaSerial(d: Date): number {
  return Math.floor(d.getTime() / DIA_MS)
}

export function dataDeSerial(dia: number): Date {
  return new Date(dia * DIA_MS)
}

export function dataUTC(ano: number, mes1a12: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes1a12 - 1, dia))
}

export function adicionarDias(d: Date, dias: number): Date {
  return dataDeSerial(diaSerial(d) + Math.round(dias))
}

/** Índice absoluto do período que contém o dia. Mensal: ano×12 + mês; semanal: semanas (seg–dom) desde 05/01/1970. */
export function indicePeriodo(dia: number, periodicidade: Periodicidade): number {
  if (periodicidade === 'semanal') return Math.floor((dia - 4) / 7)
  const d = dataDeSerial(dia)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

/** Dia serial do primeiro dia do período. */
export function inicioPeriodo(indice: number, periodicidade: Periodicidade): number {
  if (periodicidade === 'semanal') return indice * 7 + 4
  const ano = Math.floor(indice / 12)
  const mes = indice - ano * 12
  return diaSerial(new Date(Date.UTC(ano, mes, 1)))
}

/** Dia serial do último dia do período. */
export function fimPeriodo(indice: number, periodicidade: Periodicidade): number {
  return inicioPeriodo(indice + 1, periodicidade) - 1
}

/** Semana ISO (número e ano) da semana que começa na segunda-feira `diaSegunda`. */
export function semanaISO(diaSegunda: number): { semana: number; ano: number } {
  const quinta = dataDeSerial(diaSegunda + 3)
  const ano = quinta.getUTCFullYear()
  const primeiroDia = diaSerial(new Date(Date.UTC(ano, 0, 1)))
  return { semana: Math.floor((diaSerial(quinta) - primeiroDia) / 7) + 1, ano }
}

export function rotuloPeriodo(indice: number, periodicidade: Periodicidade): string {
  if (periodicidade === 'semanal') {
    const { semana, ano } = semanaISO(inicioPeriodo(indice, 'semanal'))
    return `S${String(semana).padStart(2, '0')}/${String(ano % 100).padStart(2, '0')}`
  }
  const ano = Math.floor(indice / 12)
  const mes = indice - ano * 12
  return `${MESES[mes]}/${String(ano % 100).padStart(2, '0')}`
}

/** dd/mm/aaaa (UTC). */
export function formatarData(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, '0')
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${d.getUTCFullYear()}`
}
