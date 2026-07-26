import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// base: '/nova-blocks/' porque en GitHub Pages el sitio cuelga del nombre del
// repositorio, no de la raiz del dominio. Sin esto, todos los recursos dan 404
// una vez publicado aunque en local funcione perfecto.
const base = process.env.NOVA_BASE ?? '/nova-blocks/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono-180.png', 'icono-192.png', 'icono-512.png'],
      manifest: {
        name: 'Nova Blocks',
        short_name: 'Nova',
        description: 'Juego de bloques con jefes que cambian las reglas.',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0d1c',
        theme_color: '#0a0d1c',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El juego entero cabe de sobra en el cache: se guarda todo y abre sin
        // internet. El limite por defecto (2 MB) deja afuera el bundle de Pixi.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
      devOptions: { enabled: false },
    }),
  ],
});
