import { describe, it, expect } from 'vitest';
import {
  JEFES, EL_BLOQUEADOR, EL_BASURERO, EL_TACANO, EL_GIGANTE, EL_ENCOGEDOR, LA_CUOTA,
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
  // Version corregida: la primera daba 2 piezas en vez de 3, y eso BENEFICIABA
  // al jugador (menos piezas obligatorias = mas libertad). Ahora quita la
  // eleccion, que es el recurso real.
  it('el Tacaño solo deja usar la primera pieza libre', () => {
    const conJefe = activar(partidaCon(), EL_TACANO, azarFijo).estado;
    const rechazo = jugar(conJefe, 2, indice(4, 4));
    expect(rechazo.sucesos[0]).toMatchObject({ tipo: 'rechazado', razon: 'jefe-la-bloquea' });
    expect(rechazo.estado.tablero.filter(Boolean)).toHaveLength(0);
  });

  it('el Tacaño SI deja usar la primera', () => {
    const conJefe = activar(partidaCon(), EL_TACANO, azarFijo).estado;
    const { estado, sucesos } = jugar(conJefe, 0, indice(4, 4));
    expect(sucesos.some((s) => s.tipo === 'colocada')).toBe(true);
    expect(estado.tablero.filter(Boolean).length).toBeGreaterThan(0);
  });

  it('gastada la primera, la segunda pasa a ser la permitida', () => {
    const conJefe = activar(partidaCon(), EL_TACANO, azarFijo).estado;
    const usadaLaPrimera = { ...conJefe,
      piezas: conJefe.piezas.map((p, i) => ({ ...p, usada: i === 0 })) };
    const { sucesos } = jugar(usadaLaPrimera, 1, indice(4, 4));
    expect(sucesos.some((s) => s.tipo === 'colocada')).toBe(true);
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

  it('al irse el Tacaño vuelve la libertad de elegir', () => {
    let estado = activar(partidaCon(), EL_TACANO, azarFijo).estado;
    for (let i = 0; i < EL_TACANO.turnos; i++) estado = avanzar(estado, azarFijo).estado;
    expect(estado.jefe).toBe(null);
    const { sucesos } = jugar(estado, 2, indice(4, 4));
    expect(sucesos.some((s) => s.tipo === 'colocada')).toBe(true);
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

describe('El Encogedor', () => {
  it('sella el borde y deja un 7x7 jugable', () => {
    const { estado } = activar(partidaCon(), EL_ENCOGEDOR, azarFijo);
    // ultima fila (8) + ultima columna (8) - la esquina compartida = 15
    expect(estado.tablero.filter((c) => c === BLOQUEADA)).toHaveLength(15);
    for (let f = 0; f < 8; f++) expect(estado.tablero[indice(f, 7)]).toBe(BLOQUEADA);
    for (let c = 0; c < 8; c++) expect(estado.tablero[indice(7, c)]).toBe(BLOQUEADA);
    // el 7x7 de adentro queda libre
    expect(estado.tablero[indice(6, 6)]).toBe(null);
  });

  it('NO pisa bloques que ya estaban en el borde', () => {
    const t = crearTablero();
    t[indice(7, 0)] = 'rosa';
    const { estado } = activar(partidaCon({ tablero: t }), EL_ENCOGEDOR, azarFijo);
    expect(estado.tablero[indice(7, 0)]).toBe('rosa');
  });

  it('devuelve el tablero completo al irse', () => {
    let estado = activar(partidaCon(), EL_ENCOGEDOR, azarFijo).estado;
    for (let i = 0; i < EL_ENCOGEDOR.turnos; i++) estado = avanzar(estado, azarFijo).estado;
    expect(estado.tablero.some((c) => c === BLOQUEADA)).toBe(false);
    expect(estado.jefe).toBe(null);
  });
});

describe('La Cuota', () => {
  it('fija el objetivo sobre el puntaje del momento', () => {
    const { estado } = activar(partidaCon({ puntaje: 3000 }), LA_CUOTA, azarFijo);
    expect(estado.jefe.objetivo).toBe(3000 + LA_CUOTA.meta);
    expect(estado.jefe.cumplida).toBe(false);
  });

  it('se marca cumplida apenas se alcanza el objetivo', () => {
    let estado = activar(partidaCon({ puntaje: 0 }), LA_CUOTA, azarFijo).estado;
    estado = { ...estado, puntaje: LA_CUOTA.meta + 10 };
    const r = avanzar(estado, azarFijo);
    expect(r.sucesos.some((s) => s.tipo === 'cuota-cumplida')).toBe(true);
    expect(r.estado.jefe.cumplida).toBe(true);
  });

  it('cumplirla y despues bajar de puntaje NO la desmarca', () => {
    // El puntaje nunca baja jugando, pero la regla tiene que ser a prueba de
    // eso: una meta alcanzada esta alcanzada.
    let estado = activar(partidaCon({ puntaje: 0 }), LA_CUOTA, azarFijo).estado;
    estado = avanzar({ ...estado, puntaje: LA_CUOTA.meta + 10 }, azarFijo).estado;
    expect(estado.jefe.cumplida).toBe(true);
    estado = avanzar({ ...estado, puntaje: 0 }, azarFijo).estado;
    expect(estado.jefe.cumplida).toBe(true);
  });

  it('si no llegas, tira basura al irse pero NO te mata', () => {
    let estado = activar(partidaCon({ puntaje: 0 }), LA_CUOTA, azarFijo).estado;
    let sucesos = [];
    for (let i = 0; i < LA_CUOTA.turnos; i++) {
      const r = avanzar(estado, azarMedio);
      estado = r.estado;
      sucesos.push(...r.sucesos);
    }
    const fallo = sucesos.find((s) => s.tipo === 'cuota-fallada');
    expect(fallo).toBeTruthy();
    expect(fallo.bloques).toBeGreaterThan(0);
    expect(estado.terminada).toBeFalsy();   // molesta, no mata
    expect(estado.tablero.filter(Boolean).length).toBe(fallo.bloques);
  });

  it('si llegas, se va sin castigo', () => {
    let estado = activar(partidaCon({ puntaje: 0 }), LA_CUOTA, azarFijo).estado;
    estado = { ...estado, puntaje: LA_CUOTA.meta + 500 };
    let sucesos = [];
    for (let i = 0; i < LA_CUOTA.turnos; i++) {
      const r = avanzar(estado, azarMedio);
      estado = r.estado;
      sucesos.push(...r.sucesos);
    }
    expect(sucesos.some((s) => s.tipo === 'cuota-premio')).toBe(true);
    expect(sucesos.some((s) => s.tipo === 'cuota-fallada')).toBe(false);
    expect(estado.tablero.filter(Boolean)).toHaveLength(0);
  });
});
