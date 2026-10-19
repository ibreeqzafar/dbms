import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwind()],build:{sourcemap:false,chunkSizeWarningLimit:900,rollupOptions:{output:{onlyExplicitManualChunks:true,manualChunks(id){if(id.includes('node_modules')){if(id.includes('/three/'))return 'three-engine';if(id.includes('@react-three')||id.includes('three-stdlib'))return 'walkthrough-kit';}}}}}});
