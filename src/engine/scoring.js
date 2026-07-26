// Puntos, monedas y nivel. Numeros puros, sin efectos.

/** Puntos por colocar una pieza: 10 por celda. Siempre suma algo. */
export function puntosPorColocar(celdas) {
  return celdas * 10;
}

/**
 * Puntos por limpiar. Crece al cuadrado a proposito: limpiar 4 lineas de una
 * vez (1120) tiene que valer mucho mas que 4 lineas de a una (280). Es lo que
 * empuja a guardar la jugada grande en vez de limpiar apenas se puede.
 */
export function puntosPorLineas(lineas) {
  return lineas <= 0 ? 0 : lineas * lineas * 70;
}

export function monedasPorLineas(lineas) {
  return lineas <= 0 ? 1 : lineas * 8;
}

/**
 * Cuantas jugadas sin limpiar aguanta una racha antes de cortarse.
 *
 * Con 0 (cortar a la primera) el combo era cuestion de suerte: acomodar una
 * pieza para preparar la jugada grande — que es exactamente lo que el juego
 * pide — te mataba la racha. Con 2 podes armar la jugada sin perderla.
 */
export const GRACIA_COMBO = 2;

/**
 * Combo: jugadas que limpiaron algo, encadenadas con hasta GRACIA_COMBO jugadas
 * de descanso entre medio.
 *
 * El multiplicador crece de a poco (x1, x1.5, x2, x2.5...) y se topa en x5. Sin
 * tope, una racha larga vuelve irrelevante todo lo demas del juego; sin
 * crecimiento, encadenar no se siente distinto a limpiar suelto.
 */
export function multiplicadorCombo(combo) {
  if (combo <= 1) return 1;
  return Math.min(5, 1 + (combo - 1) * 0.5);
}

/**
 * Bonus por dejar el tablero completamente vacio. Es la jugada mas dificil del
 * juego y tiene que pagar como tal: vale mas que cuatro lineas de una vez
 * (1120) para que valga la pena buscarla.
 */
export const BONUS_TABLERO_LIMPIO = 2000;

export function xpNecesaria(nivel) {
  return nivel * 500;
}

/**
 * Aplica la experiencia ganada y devuelve el nivel resultante. Usa un bucle
 * porque una jugada enorme puede subir mas de un nivel de golpe.
 */
export function aplicarXp({ nivel, xp }, ganada) {
  let n = nivel;
  let acumulada = xp + ganada;
  let subidas = 0;
  while (acumulada >= xpNecesaria(n)) {
    acumulada -= xpNecesaria(n);
    n += 1;
    subidas += 1;
  }
  return { nivel: n, xp: acumulada, subidas, monedasExtra: subidas * 50 };
}
