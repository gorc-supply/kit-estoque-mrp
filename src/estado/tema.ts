import { createContext, useContext } from 'react'
import type { Tema } from '../components/useTema'

export const ContextoTema = createContext<{ tema: Tema; alternar: () => void }>({
  tema: 'claro',
  alternar: () => {},
})

export const useTemaAtual = () => useContext(ContextoTema)
