import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // REEMPLAZA ESTO CON EL NOMBRE EXACTO QUE LE DARÁS AL REPOSITORIO EN GITHUB
  base: '/Jack-&-Jill-Scoring-System/', 
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios']
  }
})
