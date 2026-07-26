// Los jefes: cada uno impone una regla molesta durante unos turnos.
//
// Todos tienen la misma forma, y el motor no sabe cuales existen: solo les
// pregunta si quieren cambiar algo. Agregar un jefe nuevo es escribir un objeto
// aca abajo y sumarlo a la lista JEFES. No se toca nada mas.
//
//   {
//     id, nombre, descripcion, color,
//     turnos,                       cuantos turnos dura
//     alEmpezar(estado, azar)  ->   { tablero?, extra? }
//     enCadaTurno(estado, azar)->   { tablero?, aviso? }
//     alTerminar(estado)       ->   { tablero? }
//   }

import { BLOQUEADA, celdasVacias, LADO } from '../engine/board.js';

const COLOR_BASURA = 'basura';

function alAzar(lista, azar) {
  return lista[Math.floor(azar() * lista.length)];
}

export const EL_BLOQUEADOR = {
  id: 'bloqueador',
  nombre: 'EL BLOQUEADOR',
  descripcion: 'Sella 3 celdas. No se pueden usar ni limpiar.',
  color: '#ff4d6d',
  turnos: 8,

  alEmpezar(estado, azar) {
    const libres = celdasVacias(estado.tablero);
    const elegidas = [];
    const disponibles = libres.slice();
    for (let i = 0; i < 3 && disponibles.length > 0; i++) {
      const idx = Math.floor(azar() * disponibles.length);
      elegidas.push(disponibles[idx]);
      disponibles.splice(idx, 1);
    }
    const tablero = estado.tablero.slice();
    for (const c of elegidas) tablero[c] = BLOQUEADA;
    return { tablero, extra: { selladas: elegidas } };
  },

  alTerminar(estado) {
    // Libera solo lo que sigue sellado; si el tablero cambio, no rompe nada.
    const tablero = estado.tablero.map((c) => (c === BLOQUEADA ? null : c));
    return { tablero };
  },
};

export const EL_BASURERO = {
  id: 'basurero',
  nombre: 'EL BASURERO',
  descripcion: 'Cada 2 turnos te tira un bloque encima.',
  color: '#8b7355',
  turnos: 10,

  enCadaTurno(estado, azar) {
    // Tira uno cada 2 turnos, contando desde que entro.
    const transcurridos = estado.jefe.turnos - estado.jefe.turnosRestantes;
    if (transcurridos === 0 || transcurridos % 2 !== 0) return {};
    const libres = celdasVacias(estado.tablero);
    if (libres.length === 0) return {};
    const celda = alAzar(libres, azar);
    const tablero = estado.tablero.slice();
    tablero[celda] = COLOR_BASURA;
    return { tablero, aviso: { tipo: 'basura-cae', celda } };
  },
};

export const EL_TACANO = {
  id: 'tacano',
  nombre: 'EL TACAÑO',
  descripcion: 'Te da 2 piezas por turno en vez de 3.',
  color: '#ffd166',
  turnos: 12,
  piezasPorTurno: 2,
};

export const EL_GIGANTE = {
  id: 'gigante',
  nombre: 'EL GIGANTE',
  descripcion: 'Solo te salen piezas grandes.',
  color: '#8f86ff',
  turnos: 10,
  soloGrandes: true,
};

export const JEFES = [EL_BLOQUEADOR, EL_BASURERO, EL_TACANO, EL_GIGANTE];

/** Primer jefe a los 2000 puntos. */
export const PRIMER_UMBRAL = 2000;

/** Cada jefe vencido empuja el siguiente mas lejos: la dificultad sube sola. */
export function proximoUmbral(puntaje, vencidos) {
  return puntaje + 2500 + vencidos * 500;
}

/**
 * Elige un jefe evitando repetir el ultimo. Si ya salieron todos, vuelve a
 * empezar — que se repitan esta bien, que salga dos veces seguido el mismo no.
 */
export function elegirJefe(vencidos, azar) {
  const ultimo = vencidos[vencidos.length - 1];
  const candidatos = JEFES.filter((j) => j.id !== ultimo);
  return alAzar(candidatos, azar);
}

/** ¿Toca jefe? Solo si no hay uno activo y se paso el umbral. */
export function tocaJefe(estado) {
  return !estado.jefe && estado.puntaje >= (estado.proximoJefeEn ?? PRIMER_UMBRAL);
}

export function activar(estado, jefe, azar) {
  const sucesos = [{ tipo: 'jefe-entra', id: jefe.id, nombre: jefe.nombre,
                     descripcion: jefe.descripcion, color: jefe.color }];
  let tablero = estado.tablero;
  let extra = {};
  if (jefe.alEmpezar) {
    const r = jefe.alEmpezar(estado, azar);
    if (r.tablero) tablero = r.tablero;
    if (r.extra) extra = r.extra;
  }
  return {
    estado: {
      ...estado,
      tablero,
      jefe: {
        id: jefe.id,
        nombre: jefe.nombre,
        descripcion: jefe.descripcion,
        color: jefe.color,
        turnos: jefe.turnos,
        turnosRestantes: jefe.turnos,
        piezasPorTurno: jefe.piezasPorTurno,
        soloGrandes: jefe.soloGrandes,
        ...extra,
      },
    },
    sucesos,
  };
}

/** Un turno del jefe: aplica su efecto y descuenta. Si llega a 0, se va. */
export function avanzar(estado, azar) {
  if (!estado.jefe) return { estado, sucesos: [] };
  const definicion = JEFES.find((j) => j.id === estado.jefe.id);
  const sucesos = [];
  let siguiente = { ...estado };

  if (definicion?.enCadaTurno) {
    const r = definicion.enCadaTurno(siguiente, azar);
    if (r.tablero) siguiente.tablero = r.tablero;
    if (r.aviso) sucesos.push(r.aviso);
  }

  const restantes = siguiente.jefe.turnosRestantes - 1;
  if (restantes > 0) {
    siguiente.jefe = { ...siguiente.jefe, turnosRestantes: restantes };
    return { estado: siguiente, sucesos };
  }

  // Se acabo: revertir lo que haya dejado puesto
  if (definicion?.alTerminar) {
    const r = definicion.alTerminar(siguiente);
    if (r.tablero) siguiente.tablero = r.tablero;
  }
  const vencidos = [...siguiente.jefesVencidos, siguiente.jefe.id];
  sucesos.push({ tipo: 'jefe-vencido', id: siguiente.jefe.id, nombre: siguiente.jefe.nombre });
  siguiente.jefe = null;
  siguiente.jefesVencidos = vencidos;
  siguiente.proximoJefeEn = proximoUmbral(siguiente.puntaje, vencidos.length);
  return { estado: siguiente, sucesos };
}
