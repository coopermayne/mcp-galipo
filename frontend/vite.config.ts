import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5173'),
    proxy: {
      '/api': `http://localhost:${process.env.BACKEND_PORT || '8000'}`,
    },
  },
})
