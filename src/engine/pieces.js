// Las formas que salen y como se reparten los tres turnos.
// Cada forma es una lista de [x, y] con el origen en la esquina de arriba a la izquierda.

// El motor guarda el NOMBRE del color, no su valor. Traducir nombre -> pixel es
// tarea del render, y solo de el. Cuando el motor guardaba strings tipo
// '#ff6fba' y PixiJS esperaba numeros, las piezas salian grises sin ningun
// error en consola: un choque de tipos silencioso.
export const COLORES = ['rosa', 'cyan', 'ambar', 'violeta', 'verde', 'naranja'];

export const FORMAS = {
  punto: [[0, 0]],
  dos_h: [[0, 0], [1, 0]],
  dos_v: [[0, 0], [0, 1]],
  tres_h: [[0, 0], [1, 0], [2, 0]],
  tres_v: [[0, 0], [0, 1], [0, 2]],
  cuadro: [[0, 0], [1, 0], [0, 1], [1, 1]],
  ele: [[0, 0], [0, 1], [1, 1]],
  te: [[0, 0], [1, 0], [2, 0], [1, 1]],
  ele_larga: [[0, 0], [0, 1], [0, 2], [1, 2]],
  zeta: [[0, 0], [1, 0], [1, 1], [2, 1]],
  cuatro_h: [[0, 0], [1, 0], [2, 0], [3, 0]],
  cuatro_v: [[0, 0], [0, 1], [0, 2], [0, 3]],
  esquina: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]],
  cruz: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],

  // Las cuatro rotaciones de la ele y la ese: sin ellas, media pieza del
  // catalogo era simetrica y el tablero se sentia siempre igual.
  ele_der: [[1, 0], [1, 1], [0, 1]],
  ele_inv: [[0, 0], [1, 0], [1, 1]],
  ese: [[1, 0], [2, 0], [0, 1], [1, 1]],
  te_abajo: [[1, 0], [0, 1], [1, 1], [2, 1]],
  esquina_der: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
  esquina_baja: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],

  // Las grandes de verdad: aparecen poco pero cambian toda la partida.
  cinco_h: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  cinco_v: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  bloque_seis: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  cuadro_grande: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
};

export const NOMBRES = Object.keys(FORMAS);

/** Formas de 4 celdas o mas — las que usa el jefe Gigante. */
export const GRANDES = NOMBRES.filter((n) => FORMAS[n].length >= 4);

export function tamano(nombre) {
  return FORMAS[nombre].length;
}

/**
 * Genera una pieza. `azar` se inyecta para poder fijarlo en los tests;
 * por defecto usa Math.random.
 */
export function crearPieza(azar = Math.random, desde = NOMBRES) {
  const nombre = desde[Math.floor(azar() * desde.length)];
  return {
    nombre,
    forma: FORMAS[nombre].map(([x, y]) => [x, y]),
    color: COLORES[Math.floor(azar() * COLORES.length)],
    usada: false,
  };
}

export function repartir(cantidad = 3, azar = Math.random, desde = NOMBRES) {
  return Array.from({ length: cantidad }, () => crearPieza(azar, desde));
}

/**
 * Reparte piezas garantizando que AL MENOS UNA entre en el tablero.
 *
 * Sin esto, el juego podia matarte por mala suerte: colocabas tus tres piezas,
 * te repartia tres nuevas al azar y si ninguna entraba, se acabo — sin que
 * hubieras jugado mal. Bryan lo sufrio y tiene razon: la gracia del juego es
 * que te den piezas que caben y vos pienses donde ponerlas, no que el azar
 * decida cuando perdes.
 *
 * Se prueban varios repartos; si ninguno sirve, se busca a mano una forma que
 * entre y se mete en el set. Solo si NINGUNA forma del catalogo entra se
 * devuelve un reparto cualquiera — ahi el tablero esta ahogado de verdad y
 * perder es legitimo.
 */
export function repartirJugable(tablero, cabe, cantidad = 3, azar = Math.random, desde = NOMBRES, intentos = 24) {
  for (let i = 0; i < intentos; i++) {
    const piezas = repartir(cantidad, azar, desde);
    if (piezas.some((p) => cabe(tablero, p.forma))) return piezas;
  }

  // Ningun reparto al azar sirvio: buscar explicitamente una forma que entre.
  const rescate = desde.find((nombre) => cabe(tablero, FORMAS[nombre]));
  if (!rescate) return repartir(cantidad, azar, desde);   // tablero ahogado de verdad

  const piezas = repartir(cantidad, azar, desde);
  piezas[0] = crearPieza(azar, [rescate]);
  return piezas;
}

export function formasDisponibles(piezas) {
  return piezas.filter((p) => !p.usada).map((p) => p.forma);
}
