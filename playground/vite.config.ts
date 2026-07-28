import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        tailwindcss(),
        react({
            babel: {
                plugins: [['babel-plugin-react-compiler']],
            },
        }),
    ],
    server: {
        proxy: {
            '/trpc': { target: 'http://localhost:4000' },
            '/live': { target: 'ws://localhost:4000', ws: true },
        },
    },
})
