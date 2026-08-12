import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// App interno, deploy isolado na Vercel (base '/').
export default defineConfig({
  plugins: [react()],
})
