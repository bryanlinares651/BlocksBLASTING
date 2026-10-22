// Arranque/cableado reales; DOM y render son fronteras dummy, sin GPU ni servidor.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as engine from '../src/engine/game.js';
import * as board from '../src/engine/board.js';
import * as persistence from '../src/persistence.js';
import { Sonido } from '../src/audio/sfx.js';
import * as themes from '../src/render/temas.js';
import * as palette from '../src/render/theme.js';
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  delete globalThis.localStorage;
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
});
function elemento() {
  return { dataset: {}, style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {} }, hidden: true, textContent: '',
    addEventListener() {}, replaceChildren() {}, appendChild() {}, setAttribute() {},
    querySelector() { return elemento(); } };
}
async function arrancar() {
  const elementos = new Map();
  const sw = new Map();
  let recargas = 0;
  const document = {
    getElementById(id) { if (!elementos.has(id)) elementos.set(id, elemento()); return elementos.get(id); },
    createElement: elemento, querySelectorAll: () => [], addEventListener() {},
    body: elemento(), documentElement: elemento(),
  };
  class Escenario {
    async iniciar() { this.app = { canvas: elemento() }; return this; }
    pintarTablero() {} marcarJefe() {}
  }
  const window = { matchMedia: () => ({ matches: true }), addEventListener() {} };
  const ctx = vm.createContext({ ...engine, ...board, ...persistence, ...themes, ...palette,
    aplicarCss() {}, Sonido, Escenario, PiezaFlotante: class {}, Celebracion: class {},
    document, window, navigator: { serviceWorker: { addEventListener: (k, fn) => sw.set(k, fn) } },
    location: { reload() { recargas++; } }, setTimeout, clearTimeout,
  });
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/\niniciar\(\);\s*$/, '\nglobalThis.arranque = iniciar();');
  vm.runInContext(source, ctx);
  await ctx.arranque;
  return { estado: window.__nova.estado, elementos, sw, recargas: () => recargas };
}

test('NB002: main restaura compra/progreso y SW checkpoint esta conectado', async () => {
  const datos = new Map();
  globalThis.localStorage = { getItem: k => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v) };
  const e = engine.comprar(engine.jugar(engine.nuevaPartida({ azar: () => 0 }), 0, 0).estado, 'rayo').estado;
  persistence.guardarPartida(e);
  const app = await arrancar();
  assert.equal(app.estado.puntaje, 10);
  assert.equal(app.estado.poderes.rayo, 1);
  assert.equal(app.estado.tablero[0], 'rosa');
  app.sw.get('controllerchange')();
  app.sw.get('controllerchange')();
  assert.equal(app.recargas(), 1);
});

test('NB004/NB002: main arranca con storage bloqueado y SW no descarta la partida', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  const app = await arrancar();
  assert.equal(app.estado.monedas, 120);
  app.sw.get('controllerchange')();
  assert.equal(app.recargas(), 0);
});

test('NB002: main muestra el fin al restaurar una partida terminada', async () => {
  const datos = new Map();
  globalThis.localStorage = { getItem: k => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v) };
  persistence.guardarPartida({ ...engine.nuevaPartida({ azar: () => 0 }), tablero: Array(64).fill('rosa'), terminada: true });
  const app = await arrancar();
  assert.equal(app.estado.terminada, true);
  assert.equal(app.elementos.get('capa-fin').hidden, false);
});
