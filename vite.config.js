import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
    const rawBase = process.env.BASE_PATH || '/';
    const base = rawBase.endsWith('/') ? rawBase : rawBase + '/';
    return {
        base,
        plugins: [react(), tailwindcss()],
        server: {
            proxy: {
                [`${base}api`]: {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    rewrite: path => path.slice(base.length - 1),
                },
            },
        },
    };
});
