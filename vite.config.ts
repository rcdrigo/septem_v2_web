import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * GitHub Pages não faz fallback de SPA: rotas como `/modelador` viram 404 porque
 * não há arquivo físico. Copiar `index.html` → `404.html` faz o Pages servir o
 * mesmo app shell em qualquer rota desconhecida, e o React Router resolve a rota
 * client-side a partir daí.
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      try {
        copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
      } catch (err) {
        this.warn(`Não foi possível gerar 404.html: ${(err as Error).message}`);
      }
    },
  };
}

export default defineConfig({
  base: '/septem_v2_web/',
  plugins: [react(), tailwindcss(), spaFallback()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  assetsInclude: ['**/*.bpmn'],
});
