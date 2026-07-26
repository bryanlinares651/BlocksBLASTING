// Genera los iconos de la app con Chrome headless.
//
// Se dibujan en HTML y se capturan, en vez de guardar PNGs a mano: asi el icono
// usa los mismos colores OKLCH que el juego y no se desincroniza cuando cambie
// la paleta.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, renameSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const publico = join(raiz, 'public');
const temporal = join(raiz, '.iconos-tmp');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TAMANOS = [180, 192, 512];

function plantilla(lado) {
  // El rombo se dibuja con un SVG inline para que escale sin pixelarse, y el
  // fondo lleva el mismo resplandor que el fondo del juego.
  const r = Math.round(lado * 0.22);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${lado}px;height:${lado}px;overflow:hidden}
  .fondo{
    width:${lado}px;height:${lado}px;border-radius:${r}px;
    background:
      radial-gradient(120% 90% at 22% 8%, oklch(0.34 0.085 268) 0%, transparent 58%),
      oklch(0.13 0.032 265);
    display:grid;place-items:center;
  }
  svg{width:${Math.round(lado * 0.52)}px;height:${Math.round(lado * 0.52)}px;
      filter:drop-shadow(0 ${Math.round(lado * 0.03)}px ${Math.round(lado * 0.07)}px oklch(0.55 0.14 250 / 0.45))}
  </style></head><body>
  <div class="fondo">
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="oklch(0.78 0.130 200)"/>
          <stop offset="100%" stop-color="oklch(0.68 0.170 292)"/>
        </linearGradient>
      </defs>
      <rect x="14" y="14" width="72" height="72" rx="18" transform="rotate(45 50 50)" fill="url(#g)"/>
      <rect x="34" y="34" width="32" height="32" rx="9" transform="rotate(45 50 50)"
            fill="oklch(0.13 0.032 265)" opacity="0.92"/>
    </svg>
  </div></body></html>`;
}

if (!existsSync(CHROME)) {
  console.error('No encontre Chrome en', CHROME);
  process.exit(1);
}

mkdirSync(publico, { recursive: true });
rmSync(temporal, { recursive: true, force: true });
mkdirSync(temporal, { recursive: true });

for (const lado of TAMANOS) {
  const html = join(temporal, `icono-${lado}.html`);
  writeFileSync(html, plantilla(lado), 'utf8');
  execFileSync(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--default-background-color=00000000',
    `--screenshot=${join(temporal, `icono-${lado}.png`)}`,
    `--window-size=${lado},${lado}`,
    `--force-device-scale-factor=1`,
    `file://${html}`,
  ], { stdio: 'pipe' });
  renameSync(join(temporal, `icono-${lado}.png`), join(publico, `icono-${lado}.png`));
  console.log(`icono-${lado}.png`);
}

rmSync(temporal, { recursive: true, force: true });
console.log('Iconos listos en public/');
