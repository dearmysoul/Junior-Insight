import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    base: '/Junior-Insight/',
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        proxy: {
            '/api/gnews': {
                target: 'https://news.google.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/gnews/, ''),
            },
        },
    },
})
