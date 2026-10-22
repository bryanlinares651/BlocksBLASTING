import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaPartida, jugar, previsualizar, buscarConsejo, comprar, usarPoder } from '../src/engine/game.js';
import { FORMAS, repartirJugable } from '../src/engine/pieces.js';
import { puedeColocar } from '../src/engine/board.js';
import { activar, EL_TACANO } from '../src/bosses/index.js';
import { Sonido } from '../src/audio/sfx.js';
const mk = (nombre) => ({ nombre, forma: FORMAS[nombre], color: 'rosa', usada: false });
const tablero = () => Array.from({ length: 64 }, (_, i) =>
  (Math.floor(i / 8) + i % 8) % 2 === 0 ? null : 'rosa');
const tacaño = () => activar({ ...nuevaPartida({ azar: () => 0, monedas: 0 }), tablero: tablero(),
  piezas: [mk('punto'), mk('cuadro'), mk('punto')] }, EL_TACANO, () => 0).estado;

test('NB001: Tacaño termina al agotarse la primera legal aunque otra pieza quepa', () => {
  const r = jugar(tacaño(), 0, 0);
  assert.equal(buscarConsejo(r.estado), null);
  assert.equal(r.estado.terminada, true);
  assert.ok(r.sucesos.some((s) => s.tipo === 'fin-del-juego'));
  for (let p = 0; p < 3; p++) for (let c = 0; c < 64; c++) {
    assert.equal(jugar(r.estado, p, c).sucesos.some((s) => s.tipo === 'colocada'), false);
    assert.equal(previsualizar(r.estado, p, c).valido, false);
  }
});

test('NB001: preview y consejo respetan la primera pieza del Tacaño', () => {
  const e = tacaño();
  assert.equal(previsualizar(e, 2, 0).valido, false);
  assert.equal(previsualizar(e, 0, 0).valido, true);
  assert.equal(buscarConsejo(e).indicePieza, 0);
  assert.equal(jugar(e, 2, 0).sucesos[0].razon, 'jefe-la-bloquea');
});

test('NB001: reparto justo comprueba la primera y usa rescate acotado', () => {
  let llamadas = 0;
  const azar = () => [0.22, 0, 0, 0, 0, 0][llamadas++ % 6]; // cuadro, punto, punto
  const cabe = (t, f) => t.some((_, c) => puedeColocar(t, f, c));
  const piezas = repartirJugable(tablero(), cabe, 3, azar, undefined, 24, true);
  assert.equal(cabe(tablero(), piezas[0].forma), true);
  assert.ok(llamadas <= 24 * 6 + 8);
});

test('NB001: Revolver rescata la primera pieza y los poderes revisan la misma regla', () => {
  let llamadas = 0;
  const e = { ...tacaño(), monedas: 10, azar: () => [0.22, 0, 0, 0, 0, 0][llamadas++ % 6] };
  const r = comprar(e, 'revolver');
  assert.equal(r.estado.terminada, false);
  assert.equal(buscarConsejo(r.estado).indicePieza, 0);
  const bloqueada = { ...e, piezas: [mk('cuadro'), mk('punto')], poderes: { bomba: 0, rayo: 1, lampara: 0 } };
  const poder = usarPoder(bloqueada, 'rayo', 1);
  assert.equal(poder.estado.terminada, true); // una fila libre no admite un cuadro
});

for (const tipo of ['bomba', 'rayo']) test(`NB003: ${tipo} conserva el record al reiniciar sin otra jugada`, () => {
  const e = jugar(nuevaPartida({ azar: () => 0 }), 0, 0).estado;
  const r = usarPoder({ ...e, poderes: { ...e.poderes, [tipo]: 1 } }, tipo, 0).estado;
  assert.equal(r.puntaje, 90);
  assert.equal(r.mejor, 90);
  assert.equal(nuevaPartida({ monedas: r.monedas, mejor: r.mejor }).mejor, 90);
});

for (const modo of ['ausente', 'getter', 'lectura', 'escritura']) test(`NB004: sonido arranca y alterna con storage ${modo}`, () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    const falla = () => { throw new Error('SecurityError'); };
    if (modo === 'ausente') delete globalThis.localStorage;
    else if (modo === 'getter') Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: falla });
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: modo === 'lectura' ? falla : () => null, setItem: falla,
    } });
    const sonido = new Sonido();
    assert.equal(sonido.silenciado, false);
    assert.equal(sonido.vibrar, true);
    assert.equal(sonido.alternarSilencio(), true);
    assert.equal(sonido.alternarSilencio(), false);
  } finally {
    delete globalThis.localStorage;
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
  }
});
