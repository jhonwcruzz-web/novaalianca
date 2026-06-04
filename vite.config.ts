import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    watch: {
      // Polling para compatibilidade com OneDrive / pastas sincronizadas
      usePolling: true,
      interval: 1000,
    },
  },
  optimizeDeps: {
    // Evita reoptimizações causadas pelo OneDrive
    force: false,
  },
})
