import { describe, it, expect } from 'vitest';
import {
  JEFES, EL_BLOQUEADOR, EL_BASURERO, EL_TACANO, EL_GIGANTE,
  elegirJefe, tocaJefe, activar, avanzar, proximoUmbral, PRIMER_UMBRAL,
} from './index.js';
import { crearTablero, BLOQUEADA, indice, celdasDeFila, lineasCompletas } from '../engine/board.js';
import { FORMAS, GRANDES } from '../engine/pieces.js';
import { nuevaPartida, jugar } from '../engine/game.js';

const azarFijo = () => 0;
const azarMedio = () => 0.5;

function partidaCon(extra = {}) {
  return { ...nuevaPartida({ azar: azarFijo }), ...extra };
}

describe('todos los jefes cumplen el contrato', () => {
  it.each(JEFES)('$id tiene lo minimo para funcionar', (jefe) => {
    expect(typeof jefe.id).toBe('string');
    expect(typeof jefe.nombre).toBe('string');
    expect(typeof jefe.descripcion).toBe('string');
    expect(jefe.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(jefe.turnos).toBeGreaterThan(0);
  });

  it('no hay dos jefes con el mismo id', () => {
    const ids = JEFES.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('cuando aparece un jefe', () => {
  it('no toca antes del umbral', () => {
    expect(tocaJefe(partidaCon({ puntaje: PRIMER_UMBRAL - 1 }))).toBe(false);
  });

  it('toca al llegar al umbral', () => {
    expect(tocaJefe(partidaCon({ puntaje: PRIMER_UMBRAL }))).toBe(true);
  });

  it('no toca si ya hay uno peleando', () => {
    const con = partidaCon({ puntaje: 99999, jefe: { id: 'tacano', turnosRestantes: 3 } });
    expect(tocaJefe(con)).toBe(false);
  });

  it('cada jefe vencido empuja el siguiente mas lejos', () => {
    expect(proximoUmbral(5000, 0)).toBe(7500);
    expect(proximoUmbral(5000, 3)).toBe(9000);
    expect(proximoUmbral(5000, 3)).toBeGreaterThan(proximoUmbral(5000, 0));
  });

  it('no repite el mismo jefe dos veces seguidas', () => {
    for (const jefe of JEFES) {
      const siguiente = elegirJefe([jefe.id], azarFijo);
      expect(siguiente.id).not.toBe(jefe.id);
    }
  });
});

describe('El Bloqueador', () => {
  it('sella 3 celdas al entrar', () => {
    const { estado } = activar(partidaCon(), EL_BLOQUEADOR, azarMedio);
    expect(estado.tablero.filter((c) => c === BLOQUEADA)).toHaveLength(3);
    expect(estado.jefe.selladas).toHaveLength(3);
  });

  it('una celda sellada impide completar esa fila', () => {
    const tablero = crearTablero();
    for (const c of celdasDeFila(3)) tablero[c] = '#f00';
    tablero[indice(3, 2)] = BLOQUEADA;
    expect(lineasCompletas(tablero).cantidad).toBe(0);
  });

  it('libera todo al irse, sin dejar rastro', () => {
    let estado = activar(partidaCon(), EL_BLOQUEADOR, azarMedio).estado;
    expect(estado.tablero.some((c) => c === BLOQUEADA)).toBe(true);
    for (let i = 0; i < EL_BLOQUEADOR.turnos; i++) {
      estado = avanzar(estado, azarFijo).estado;
    }
    expect(estado.jefe).toBe(null);
    expect(estado.tablero.some((c) => c === BLOQUEADA)).toBe(false);
    expect(estado.jefesVencidos).toContain('bloqueador');
  });

  it('no sella mas celdas de las que hay libres', () => {
    const casiLleno = Array(64).fill('#f00');
    casiLleno[0] = null;
    const { estado } = activar(partidaCon({ tablero: casiLleno }), EL_BLOQUEADOR, azarFijo);
    expect(estado.tablero.filter((c) => c === BLOQUEADA)).toHaveLength(1);
  });
});

describe('El Basurero', () => {
  it('no tira nada en su primer turno', () => {
    const estado = activar(partidaCon(), EL_BASURERO, azarFijo).estado;
    const r = avanzar(estado, azarMedio);
    expect(r.sucesos.some((s) => s.tipo === 'basura-cae')).toBe(false);
  });

  it('tira un bloque cada 2 turnos', () => {
    let estado = activar(partidaCon(), EL_BASURERO, azarFijo).estado;
    let caidas = 0;
    for (let i = 0; i < EL_BASURERO.turnos; i++) {
      const r = avanzar(estado, azarMedio);
      estado = r.estado;
      caidas += r.sucesos.filter((s) => s.tipo === 'basura-cae').length;
    }
    expect(caidas).toBeGreaterThan(0);
    expect(caidas).toBeLessThanOrEqual(Math.ceil(EL_BASURERO.turnos / 2));
  });

  it('la basura se queda cuando el jefe se va', () => {
    let estado = activar(partidaCon(), EL_BASURERO, azarFijo).estado;
    for (let i = 0; i < EL_BASURERO.turnos; i++) estado = avanzar(estado, azarMedio).estado;
    expect(estado.jefe).toBe(null);
    expect(estado.tablero.filter(Boolean).length).toBeGreaterThan(0);
  });

  it('no se rompe con el tablero lleno', () => {
    let estado = activar(partidaCon({ tablero: Array(64).fill('#f00') }), EL_BASURERO, azarFijo).estado;
    expect(() => avanzar(avanzar(estado, azarMedio).estado, azarMedio)).not.toThrow();
  });
});

describe('El Tacaño y El Gigante', () => {
  it('el Tacaño reparte 2 piezas en vez de 3', () => {
    const conJefe = activar(partidaCon(), EL_TACANO, azarFijo).estado;
    // gastar las 3 piezas actuales fuerza el reparto nuevo
    const gastadas = { ...conJefe, piezas: conJefe.piezas.map((p, i) => ({ ...p, usada: i > 0 })) };
    const { estado } = jugar(gastadas, 0, 0);
    expect(estado.piezas).toHaveLength(2);
  });

  it('el Gigante solo reparte piezas de 4 celdas o mas', () => {
    const conJefe = activar(partidaCon(), EL_GIGANTE, azarFijo).estado;
    const gastadas = { ...conJefe, piezas: conJefe.piezas.map((p, i) => ({ ...p, usada: i > 0 })) };
    const { estado } = jugar(gastadas, 0, 0);
    for (const pieza of estado.piezas) {
      expect(GRANDES).toContain(pieza.nombre);
      expect(pieza.forma.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('al irse el Tacaño vuelven las 3 piezas', () => {
    let estado = activar(partidaCon(), EL_TACANO, azarFijo).estado;
    for (let i = 0; i < EL_TACANO.turnos; i++) estado = avanzar(estado, azarFijo).estado;
    expect(estado.jefe).toBe(null);
    const gastadas = { ...estado, piezas: estado.piezas.map((p, i) => ({ ...p, usada: i > 0 })) };
    expect(jugar(gastadas, 0, 0).estado.piezas).toHaveLength(3);
  });
});

describe('el jefe dentro de la partida', () => {
  it('entra solo al cruzar el umbral jugando', () => {
    const casi = partidaCon({ puntaje: PRIMER_UMBRAL - 5 });
    const { estado, sucesos } = jugar(casi, 0, 0);
    expect(sucesos.some((s) => s.tipo === 'jefe-entra')).toBe(true);
    expect(estado.jefe).not.toBe(null);
  });

  it('avisa con nombre y descripcion para poder mostrarlo', () => {
    const casi = partidaCon({ puntaje: PRIMER_UMBRAL - 5 });
    const entrada = jugar(casi, 0, 0).sucesos.find((s) => s.tipo === 'jefe-entra');
    expect(entrada.nombre).toBeTruthy();
    expect(entrada.descripcion).toBeTruthy();
    expect(entrada.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('descuenta un turno por jugada y termina vencido', () => {
    let estado = activar(partidaCon(), EL_TACANO, azarFijo).estado;
    const turnosIniciales = estado.jefe.turnosRestantes;
    const r = jugar(estado, 0, 0);
    expect(r.estado.jefe.turnosRestantes).toBe(turnosIniciales - 1);
  });

  it('tras vencerlo, el siguiente umbral queda mas arriba', () => {
    let estado = activar(partidaCon({ puntaje: 3000 }), EL_TACANO, azarFijo).estado;
    for (let i = 0; i < EL_TACANO.turnos; i++) estado = avanzar(estado, azarFijo).estado;
    expect(estado.proximoJefeEn).toBeGreaterThan(3000);
    expect(tocaJefe(estado)).toBe(false);
  });
});
