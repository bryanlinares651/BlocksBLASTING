// Junta tablero, piezas, puntaje y jefes en una partida.
// Devuelve siempre estados nuevos y una lista de "sucesos" para que la pantalla
// sepa que animar. El motor no anima: avisa que paso.

import {
  crearTablero, puedeColocar, colocar, lineasCompletas, limpiar,
  hayMovimiento, simular, BLOQUEADA,
} from './board.js';
import { repartir, formasDisponibles, NOMBRES, GRANDES } from './pieces.js';
import {
  puntosPorColocar, puntosPorLineas, monedasPorLineas, aplicarXp, xpNecesaria,
  multiplicadorCombo, BONUS_TABLERO_LIMPIO,
} from './scoring.js';
import { tocaJefe, elegirJefe, activar, avanzar, PRIMER_UMBRAL } from '../bosses/index.js';

export function nuevaPartida({ azar = Math.random, monedas = 120, mejor = 0 } = {}) {
  return {
    tablero: crearTablero(),
    piezas: repartir(3, azar),
    seleccionada: null,
    puntaje: 0,
    monedas,
    mejor,
    nivel: 1,
    xp: 0,
    poderes: { bomba: 0, rayo: 0, lampara: 0 },
    jefe: null,          // { id, nombre, turnosRestantes, ... }
    jefesVencidos: [],
    proximoJefeEn: PRIMER_UMBRAL,
    combo: 0,            // jugadas seguidas que limpiaron algo
    mejorCombo: 0,
    tablerosLimpiados: 0,
    turno: 0,
    terminada: false,
    azar,
  };
}

/** Cuantas piezas reparte este turno — el jefe Tacaño baja el numero. */
function cuantasPiezas(estado) {
  return estado.jefe?.piezasPorTurno ?? 3;
}

/** De que catalogo salen — el jefe Gigante restringe a las formas grandes. */
function catalogo(estado) {
  return estado.jefe?.soloGrandes ? GRANDES : NOMBRES;
}

function rellenarSiHaceFalta(estado, sucesos) {
  if (!estado.piezas.every((p) => p.usada)) return estado;
  sucesos.push({ tipo: 'piezas-nuevas' });
  return { ...estado, piezas: repartir(cuantasPiezas(estado), estado.azar, catalogo(estado)) };
}

/** Vista previa para pintar antes de soltar. No cambia nada. */
export function previsualizar(estado, indicePieza, celda) {
  const pieza = estado.piezas[indicePieza];
  if (!pieza || pieza.usada) return { valido: false, celdas: [], lineas: null };
  return simular(estado.tablero, pieza.forma, celda);
}

/**
 * La jugada principal. Devuelve { estado, sucesos }.
 * `sucesos` es lo que la pantalla convierte en animacion y sonido.
 */
export function jugar(estado, indicePieza, celda) {
  const sucesos = [];
  if (estado.terminada) return { estado, sucesos: [{ tipo: 'partida-terminada' }] };

  const pieza = estado.piezas[indicePieza];
  if (!pieza) return { estado, sucesos: [{ tipo: 'rechazado', razon: 'no-existe' }] };
  if (pieza.usada) return { estado, sucesos: [{ tipo: 'rechazado', razon: 'ya-usada' }] };

  // El Tacaño te deja ver las tres pero usar solo la primera sin gastar. Lo que
  // duele no es tener menos piezas, es no poder elegir cual.
  if (estado.jefe?.soloLaPrimera) {
    const primeraLibre = estado.piezas.findIndex((p) => !p.usada);
    if (indicePieza !== primeraLibre) {
      return { estado, sucesos: [{ tipo: 'rechazado', razon: 'jefe-la-bloquea' }] };
    }
  }

  if (!puedeColocar(estado.tablero, pieza.forma, celda)) {
    return { estado, sucesos: [{ tipo: 'rechazado', razon: 'no-cabe' }] };
  }

  let siguiente = { ...estado };
  siguiente.tablero = colocar(estado.tablero, pieza.forma, celda, pieza.color);
  siguiente.piezas = estado.piezas.map((p, i) => (i === indicePieza ? { ...p, usada: true } : p));
  siguiente.seleccionada = null;
  siguiente.turno = estado.turno + 1;
  sucesos.push({ tipo: 'colocada', celdas: pieza.forma.length, color: pieza.color, en: celda });

  // Limpiar lo que se haya completado
  const lineas = lineasCompletas(siguiente.tablero);
  let ganados = puntosPorColocar(pieza.forma.length);

  if (lineas.cantidad > 0) {
    siguiente.tablero = limpiar(siguiente.tablero, lineas.celdas);
    siguiente.combo = estado.combo + 1;
    siguiente.mejorCombo = Math.max(estado.mejorCombo, siguiente.combo);
    const multiplicador = multiplicadorCombo(siguiente.combo);
    const base = puntosPorLineas(lineas.cantidad);
    ganados += Math.round(base * multiplicador);
    siguiente.monedas += monedasPorLineas(lineas.cantidad);
    sucesos.push({
      tipo: 'lineas-limpiadas',
      cantidad: lineas.cantidad,
      filas: lineas.filas,
      columnas: lineas.columnas,
      celdas: lineas.celdas,
      combo: siguiente.combo,
      multiplicador,
      puntos: Math.round(base * multiplicador),
    });
  } else {
    // Una jugada que no limpia corta la racha. Eso es lo que hace que encadenar
    // sea una decision y no algo que pasa solo.
    if (estado.combo > 0) sucesos.push({ tipo: 'combo-cortado', era: estado.combo });
    siguiente.combo = 0;
    siguiente.monedas += monedasPorLineas(0);
  }

  // Dejar el tablero completamente vacio: la jugada mas dificil del juego.
  if (lineas.cantidad > 0 && siguiente.tablero.every((c) => c === null)) {
    ganados += BONUS_TABLERO_LIMPIO;
    siguiente.monedas += 100;
    siguiente.tablerosLimpiados = estado.tablerosLimpiados + 1;
    sucesos.push({
      tipo: 'tablero-limpio',
      bonus: BONUS_TABLERO_LIMPIO,
      vez: siguiente.tablerosLimpiados,
    });
  }

  siguiente.puntaje = estado.puntaje + ganados;
  const nivelado = aplicarXp({ nivel: estado.nivel, xp: estado.xp }, ganados);
  siguiente.nivel = nivelado.nivel;
  siguiente.xp = nivelado.xp;
  if (nivelado.subidas > 0) {
    siguiente.monedas += nivelado.monedasExtra;
    sucesos.push({ tipo: 'subio-nivel', nivel: nivelado.nivel, monedas: nivelado.monedasExtra });
  }
  if (siguiente.puntaje > siguiente.mejor) siguiente.mejor = siguiente.puntaje;

  // El jefe activo gasta su turno y aplica lo suyo; si se le acaba, se va y
  // revierte lo que dejo puesto.
  if (siguiente.jefe) {
    const r = avanzar(siguiente, siguiente.azar);
    siguiente = r.estado;
    sucesos.push(...r.sucesos);
  }

  // ¿Entra uno nuevo? Se revisa despues de puntuar, para que la jugada que
  // cruza el umbral sea la que lo invoca.
  if (tocaJefe(siguiente)) {
    const r = activar(siguiente, elegirJefe(siguiente.jefesVencidos, siguiente.azar), siguiente.azar);
    siguiente = r.estado;
    sucesos.push(...r.sucesos);
  }

  // El reparto va al final a proposito: el Tacaño cambia cuantas piezas tocan
  // y el Gigante de que catalogo salen, asi que primero tiene que estar
  // resuelto quien manda este turno.
  siguiente = rellenarSiHaceFalta(siguiente, sucesos);
  siguiente.terminada = !hayMovimiento(siguiente.tablero, formasDisponibles(siguiente.piezas));
  if (siguiente.terminada) sucesos.push({ tipo: 'fin-del-juego', puntaje: siguiente.puntaje });

  return { estado: siguiente, sucesos };
}

/**
 * Usa un poder en la celda elegida. Corrige el bug del prototipo, donde la
 * bomba siempre explotaba en el primer bloque que encontraba.
 */
export function usarPoder(estado, tipo, celda) {
  if (!estado.poderes[tipo]) {
    return { estado, sucesos: [{ tipo: 'rechazado', razon: 'sin-poder' }] };
  }
  const objetivo = [];
  if (tipo === 'bomba') {
    const fila = Math.floor(celda / 8);
    const col = celda % 8;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const f = fila + dy;
        const c = col + dx;
        if (f >= 0 && f < 8 && c >= 0 && c < 8) objetivo.push(f * 8 + c);
      }
    }
  } else {
    const fila = Math.floor(celda / 8);
    for (let c = 0; c < 8; c++) objetivo.push(fila * 8 + c);
  }

  // Un poder nunca borra las celdas del jefe: para eso hay que aguantarlo.
  const borrables = objetivo.filter((c) => estado.tablero[c] !== BLOQUEADA);
  const siguiente = {
    ...estado,
    tablero: limpiar(estado.tablero, borrables),
    poderes: { ...estado.poderes, [tipo]: estado.poderes[tipo] - 1 },
    puntaje: estado.puntaje + 80,
  };
  siguiente.terminada = !hayMovimiento(siguiente.tablero, formasDisponibles(siguiente.piezas));
  return {
    estado: siguiente,
    sucesos: [{ tipo: 'poder-usado', poder: tipo, celdas: borrables, en: celda }],
  };
}

/**
 * La lampara: busca la mejor jugada posible y te la señala.
 *
 * Prueba todas las combinaciones de pieza y posicion, y se queda con la que mas
 * lineas limpia; a igualdad de lineas, con la que deja menos huecos sueltos
 * (una celda vacia rodeada de ocupadas es la que despues no sirve para nada).
 *
 * No consume el poder si no encuentra nada util: pagar por "no hay jugada
 * buena" seria una estafa.
 */
export function buscarConsejo(estado) {
  let mejor = null;
  estado.piezas.forEach((pieza, indicePieza) => {
    if (pieza.usada) return;
    if (estado.jefe?.soloLaPrimera) {
      const primera = estado.piezas.findIndex((p) => !p.usada);
      if (indicePieza !== primera) return;
    }
    for (let celda = 0; celda < estado.tablero.length; celda++) {
      if (!puedeColocar(estado.tablero, pieza.forma, celda)) continue;
      const tras = colocar(estado.tablero, pieza.forma, celda, pieza.color);
      const lineas = lineasCompletas(tras);
      const huecos = contarHuecosSueltos(limpiar(tras, lineas.celdas));
      const puntaje = lineas.cantidad * 1000 - huecos;
      if (!mejor || puntaje > mejor.puntaje) {
        mejor = { indicePieza, celda, lineas: lineas.cantidad, huecos, puntaje };
      }
    }
  });
  return mejor;
}

/** Celdas vacias sin ninguna vecina vacia: son las que despues no sirven. */
function contarHuecosSueltos(tablero) {
  let sueltos = 0;
  for (let i = 0; i < tablero.length; i++) {
    if (tablero[i] !== null) continue;
    const fila = Math.floor(i / 8);
    const col = i % 8;
    const vecinas = [
      fila > 0 ? i - 8 : null,
      fila < 7 ? i + 8 : null,
      col > 0 ? i - 1 : null,
      col < 7 ? i + 1 : null,
    ].filter((v) => v !== null);
    if (vecinas.every((v) => tablero[v] !== null)) sueltos++;
  }
  return sueltos;
}

export function usarLampara(estado) {
  if (!estado.poderes.lampara) {
    return { estado, sucesos: [{ tipo: 'rechazado', razon: 'sin-poder' }] };
  }
  const consejo = buscarConsejo(estado);
  if (!consejo) {
    // No se cobra: no hay nada que aconsejar.
    return { estado, sucesos: [{ tipo: 'rechazado', razon: 'sin-consejo' }] };
  }
  return {
    estado: { ...estado, poderes: { ...estado.poderes, lampara: estado.poderes.lampara - 1 } },
    sucesos: [{ tipo: 'consejo', ...consejo }],
  };
}

export function comprar(estado, articulo) {
  const precios = { bomba: 40, rayo: 60, revolver: 80, lampara: 50 };
  const precio = precios[articulo];
  if (precio === undefined) return { estado, sucesos: [{ tipo: 'rechazado', razon: 'no-existe' }] };
  if (estado.monedas < precio) {
    return { estado, sucesos: [{ tipo: 'rechazado', razon: 'sin-monedas' }] };
  }
  const siguiente = { ...estado, monedas: estado.monedas - precio };
  if (articulo === 'revolver') {
    siguiente.piezas = repartir(cuantasPiezas(estado), estado.azar, catalogo(estado));
    siguiente.terminada = !hayMovimiento(siguiente.tablero, formasDisponibles(siguiente.piezas));
  } else {
    siguiente.poderes = { ...estado.poderes, [articulo]: estado.poderes[articulo] + 1 };
  }
  return { estado: siguiente, sucesos: [{ tipo: 'comprado', articulo }] };
}

export { xpNecesaria };
