import { defineConfig } from 'vite';
export default defineConfig({optimizeDeps:{esbuildOptions:{tsconfigRaw:{}}},server:{port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3001'}}});
