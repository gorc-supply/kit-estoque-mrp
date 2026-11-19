import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Caminho do GitHub Pages (https://<usuario>.github.io/kit-estoque-mrp/).
  // Ajustar se o nome do repositório mudar.
  base: '/kit-estoque-mrp/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
