// Classes de estilo compartilhadas (fora dos .tsx para o react-refresh).

export const classeEntrada =
  'w-full rounded-md border border-concreto bg-white px-2.5 py-1.5 text-sm text-marinho shadow-sm focus:border-aco-claro dark:border-aco dark:bg-marinho dark:text-concreto'

/** Variante sem largura total, para selects e campos em linha. */
export const classeEntradaCompacta = classeEntrada.replace('w-full ', '')
