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
