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
  // Raiz por padrão (Cloudflare Pages/Netlify em domínio próprio). O deploy do
  // GitHub Pages passa VITE_BASE=/septem_v2_web/ por servir sob subpath.
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss(), spaFallback()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // O form-js e o @bpmn-io/properties-panel usam preact internamente. Sem isto,
    // o Vite pode pré-empacotar mais de uma cópia de preact → os hooks das entries
    // do painel quebram ("can't access property context"). Deduplicar resolve.
    dedupe: ['preact', 'preact/hooks', 'preact/jsx-runtime'],
  },
  optimizeDeps: {
    include: ['preact', 'preact/hooks', 'preact/jsx-runtime'],
  },
  server: {
    port: 5173,
    host: true,
    // Em dev, `/api` aponta para o backend local (Septem.Api em :5000). O header
    // `X-Tenant` injetado no cliente HTTP escolhe o tenant — não precisa mexer em
    // /etc/hosts pra simular subdomínios.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ['**/*.bpmn'],
});
