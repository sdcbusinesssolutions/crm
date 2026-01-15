import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// https://vitejs.dev/config/
export default defineConfig({
  envPrefix: ['VITE_', 'BRIDGE_DOMAIN'],
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      }
    },
    host: '0.0.0.0', // Allow network access
    allowedHosts: true, // Allow ngrok/tunnel domains
    hmr: {
      // clientPort: 443, // Disabled for local dev (Enable only for Ngrok/HTTPS tunneling)
    },
    watch: {
      usePolling: true, // Docker/Windows sometimes needs this for file changes
    },
  },
  build: {
    chunkSizeWarningLimit: 1000
  }
})