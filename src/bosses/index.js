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

/**
 * EL TACAÑO — version corregida.
 *
 * La primera version daba 2 piezas en vez de 3, y Bryan detecto que eso lo
 * BENEFICIABA: con 3 piezas estas obligado a colocar las tres, con 2 tenes mas
 * libertad. Menos piezas = menos restriccion = mas facil.
 *
 * Lo que si duele es quitarte la ELECCION, que es el recurso de verdad del
 * jugador: ahora ves las tres pero solo podes usar la de la izquierda.
 */
export const EL_TACANO = {
  id: 'tacano',
  nombre: 'EL TACAÑO',
  descripcion: 'Solo podés usar la primera pieza.',
  color: '#ffd166',
  turnos: 10,
  soloLaPrimera: true,
};

export const EL_GIGANTE = {
  id: 'gigante',
  nombre: 'EL GIGANTE',
  descripcion: 'Solo te salen piezas grandes.',
  color: '#8f86ff',
  turnos: 10,
  soloGrandes: true,
};

/** Encoge el area jugable: sella el borde y te deja un 7x7. */
export const EL_ENCOGEDOR = {
  id: 'encogedor',
  nombre: 'EL ENCOGEDOR',
  descripcion: 'Te achica el tablero a 7×7.',
  color: '#39d0d8',
  turnos: 8,

  alEmpezar(estado) {
    // Solo se sellan las celdas VACIAS del borde: sellar una ocupada borraria
    // un bloque del jugador sin avisar, y eso se siente tramposo.
    const tablero = estado.tablero.slice();
    const borde = [];
    for (let i = 0; i < LADO; i++) {
      borde.push(i * LADO + (LADO - 1));        // ultima columna
      borde.push((LADO - 1) * LADO + i);        // ultima fila
    }
    for (const c of new Set(borde)) {
      if (tablero[c] === null) tablero[c] = BLOQUEADA;
    }
    return { tablero };
  },

  alTerminar(estado) {
    return { tablero: estado.tablero.map((c) => (c === BLOQUEADA ? null : c)) };
  },
};

/**
 * LA CUOTA — el unico jefe con una meta que se puede fallar.
 *
 * Te pide una cantidad de puntos antes de que se le acaben los turnos. Si
 * llegas, se va y te paga. Si no, te deja el tablero sembrado de basura. No
 * mata la partida: hacerte perder por un reloj seria frustrante en un juego que
 * se juega en ratos cortos.
 */
export const LA_CUOTA = {
  id: 'cuota',
  nombre: 'LA CUOTA',
  descripcion: 'Hacé 1200 puntos antes de que se acaben sus turnos.',
  color: '#ff8c42',
  turnos: 9,
  meta: 1200,

  alEmpezar(estado) {
    return { extra: { objetivo: estado.puntaje + LA_CUOTA.meta, cumplida: false } };
  },

  enCadaTurno(estado) {
    if (estado.jefe.cumplida) return {};
    if (estado.puntaje >= estado.jefe.objetivo) {
      return { aviso: { tipo: 'cuota-cumplida' }, marcarCumplida: true };
    }
    return {};
  },

  alTerminar(estado, azar) {
    if (estado.jefe.cumplida) return { aviso: { tipo: 'cuota-premio' } };
    // No llegaste: cae basura. Molesta, no mata.
    const libres = celdasVacias(estado.tablero);
    const tablero = estado.tablero.slice();
    const cuantos = Math.min(6, libres.length);
    const restantes = libres.slice();
    for (let i = 0; i < cuantos; i++) {
      const idx = Math.floor(azar() * restantes.length);
      tablero[restantes[idx]] = COLOR_BASURA;
      restantes.splice(idx, 1);
    }
    return { tablero, aviso: { tipo: 'cuota-fallada', bloques: cuantos } };
  },
};

/**
 * Lo que pagan los jefes. Antes: nada. Aguantar al mas duro del juego valia
 * lo mismo que colocar una pieza suelta, y encima te dejaba el tablero peor.
 */
export const PREMIO_JEFE = { entra: 40, vencido: 40, cuota: 80 };

export const JEFES = [
  EL_BLOQUEADOR, EL_BASURERO, EL_TACANO, EL_GIGANTE, EL_ENCOGEDOR, LA_CUOTA,
];

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
  // Se copian TODAS las opciones del jefe, no una lista escrita a mano: cuando
  // esa lista existia, agregar una regla nueva a un jefe compilaba sin error y
  // la regla simplemente no hacia nada, porque nadie la copiaba al estado.
  // Las funciones se dejan afuera: el estado tiene que poder serializarse.
  const { alEmpezar, enCadaTurno, alTerminar, ...config } = jefe;

  return {
    estado: {
      ...estado,
      tablero,
      jefe: { ...config, turnosRestantes: jefe.turnos, ...extra },
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
    // La Cuota se marca cumplida en el momento en que se alcanza, no al final:
    // si no, cumplirla y volver a bajar del objetivo la daria por fallada.
    if (r.marcarCumplida) siguiente.jefe = { ...siguiente.jefe, cumplida: true };
  }

  const restantes = siguiente.jefe.turnosRestantes - 1;
  if (restantes > 0) {
    siguiente.jefe = { ...siguiente.jefe, turnosRestantes: restantes };
    return { estado: siguiente, sucesos };
  }

  // Se acabo: revertir lo que haya dejado puesto
  if (definicion?.alTerminar) {
    const r = definicion.alTerminar(siguiente, azar);
    if (r.tablero) siguiente.tablero = r.tablero;
    if (r.aviso) sucesos.push(r.aviso);
  }
  const vencidos = [...siguiente.jefesVencidos, siguiente.jefe.id];
  sucesos.push({ tipo: 'jefe-vencido', id: siguiente.jefe.id, nombre: siguiente.jefe.nombre });
  siguiente.jefe = null;
  siguiente.jefesVencidos = vencidos;
  siguiente.proximoJefeEn = proximoUmbral(siguiente.puntaje, vencidos.length);
  return { estado: siguiente, sucesos };
}
