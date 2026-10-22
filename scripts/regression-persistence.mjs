import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaPartida, jugar, comprar, usarPoder } from '../src/engine/game.js';
import { activar, JEFES } from '../src/bosses/index.js';
import { cargarGuardado, guardarPartida, restaurarGuardado, recargarTrasGuardar, GUARDADO } from '../src/persistence.js';
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  delete globalThis.localStorage;
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
});
function memoria() {
  const datos = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v),
  } });
  return datos;
}
const azar = () => 0;
function partida() {
  let e = jugar(nuevaPartida({ azar }), 0, 0).estado;
  e = comprar(e, 'rayo').estado;
  return { ...e, seleccionada: 1, combo: 2, mejorCombo: 3, graciaUsada: 1, tablerosLimpiados: 2 };
}

test('NB002: compra + tablero + progreso + tema sobreviven una recarga completa', () => {
  const datos = memoria();
  const e = partida();
  assert.equal(guardarPartida(e, 'aurora'), true);
  assert.equal(JSON.parse(datos.get(GUARDADO)).version, 2);
  assert.equal(datos.get(GUARDADO).includes('azar'), false);
  const otroAzar = () => 0.1;
  const r = cargarGuardado(otroAzar);
  assert.deepEqual(r.estado, { ...e, azar: otroAzar });
  assert.equal(r.tema, 'aurora');
  assert.equal(r.estado.poderes.rayo, 1);
  assert.equal(r.estado.monedas, 103);
  const siguiente = jugar(r.estado, 1, 1).estado;
  assert.equal(siguiente.turno, 2);
  const usado = usarPoder(siguiente, 'rayo', 0).estado;
  assert.equal(usado.poderes.rayo, 0);
  assert.equal(guardarPartida(usado), true);
  assert.equal(cargarGuardado().estado.poderes.rayo, 0);
  assert.equal(cargarGuardado().estado.mejor, usado.puntaje);
});

for (const jefe of JEFES) test(`NB002: restaura ${jefe.id} con estado y configuracion vigentes`, () => {
  memoria();
  const e = activar(partida(), jefe, azar).estado;
  e.jefe.turnosRestantes--;
  assert.equal(guardarPartida(e), true);
  const r = cargarGuardado(azar).estado;
  assert.deepEqual(r, e);
  // Un JSON no puede inyectar reglas ni reemplazar las funciones del motor.
  const datos = JSON.parse(localStorage.getItem(GUARDADO));
  datos.partida.jefe.soloLaPrimera = 'invalida';
  datos.partida.jefe.alTerminar = 'invalida';
  localStorage.setItem(GUARDADO, JSON.stringify(datos));
  assert.deepEqual(cargarGuardado(azar).estado.jefe, e.jefe);
});

test('NB002: migra el formato antiguo sin borrar record ni monedas', () => {
  const datos = memoria();
  datos.set(GUARDADO, JSON.stringify({ mejor: 12345, monedas: 57 }));
  const e = cargarGuardado(azar).estado;
  assert.equal(e.mejor, 12345);
  assert.equal(e.monedas, 57);
  assert.equal(e.poderes.bomba, 1);
  assert.equal(guardarPartida(e), true);
  assert.equal(JSON.parse(datos.get(GUARDADO)).version, 2);
});

test('NB002: valida tablero, forma, numeros, nivel, jefe, inventario y seleccion', () => {
  const datos = memoria();
  const e = partida();
  guardarPartida(e);
  const raw = datos.get(GUARDADO);
  const corrupciones = [
    (p) => p.tablero.pop(), (p) => p.tablero[0] = { mal: true },
    (p) => p.piezas[0].forma = [[999, 0]], (p) => p.piezas[0].nombre = '__proto__',
    (p) => p.nivel = 0, (p) => p.xp = 999999, (p) => p.turno = -1,
    (p) => p.seleccionada = 99, (p) => p.jefe = { id: 'inexistente' },
    (p) => p.poderes.rayo = '1', (p) => p.jefesVencidos = ['inexistente'],
  ];
  for (const corromper of corrupciones) {
    const d = JSON.parse(raw);
    corromper(d.partida);
    datos.set(GUARDADO, JSON.stringify(d));
    const r = cargarGuardado(azar).estado;
    assert.equal(r.turno, 0);
    assert.equal(r.monedas, e.monedas);
    assert.equal(r.mejor, e.mejor);
    assert.deepEqual(r.poderes, e.poderes); // recuperacion no pierde el poder pagado
  }
});

test('NB002: termina estados sin jugada legal y restaura fin', () => {
  memoria();
  const e = { ...partida(), tablero: Array(64).fill('rosa'), terminada: true };
  assert.equal(guardarPartida(e), true);
  assert.equal(cargarGuardado().estado.terminada, true);
});

test('NB002: corrupto, null, version futura y storage denegado permiten comenzar', () => {
  const datos = memoria();
  for (const crudo of ['{', 'null', '[]', JSON.stringify({ version: 99, mejor: 8, monedas: 20 })]) {
    datos.set(GUARDADO, crudo);
    assert.equal(cargarGuardado().estado.nivel, 1);
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denegado'); } });
  assert.equal(cargarGuardado().estado.monedas, 120);
  assert.equal(guardarPartida(partida()), false);
  assert.equal(restaurarGuardado({ mejor: -1, monedas: null }).estado.mejor, 0);
});

test('NB002: SW guarda antes de recargar, una vez, y solo si hay checkpoint durable', () => {
  memoria();
  const e = partida();
  const orden = [];
  const controlador = recargarTrasGuardar(() => e, () => {
    orden.push('guardar'); return guardarPartida(e);
  }, () => { orden.push('recargar'); assert.equal(cargarGuardado().estado.poderes.rayo, 1); });
  assert.equal(controlador(), true);
  assert.equal(controlador(), false);
  assert.deepEqual(orden, ['guardar', 'recargar']);
  const fallo = recargarTrasGuardar(() => e, () => false, () => assert.fail('recarga sin guardado'));
  assert.equal(fallo(), false);
  const sinEstado = recargarTrasGuardar(() => undefined, () => assert.fail('sin estado'), () => assert.fail('recarga'));
  assert.equal(sinEstado(), false);
});
