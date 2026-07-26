// El tablero: la cuadricula y las reglas de colocar y limpiar.
// No sabe nada de pantalla, de colores bonitos ni de sonido. Solo reglas.

export const LADO = 8;
export const TOTAL = LADO * LADO;

// Marcador de celda inutilizable por un jefe. Ocupa lugar pero NO cuenta
// para completar una linea, que es justo lo que la vuelve molesta.
export const BLOQUEADA = '__bloqueada__';

export function crearTablero() {
  return Array(TOTAL).fill(null);
}

export function indice(fila, columna) {
  return fila * LADO + columna;
}

export function coordenadas(i) {
  return { fila: Math.floor(i / LADO), columna: i % LADO };
}

/** Celdas que ocuparia una forma si se coloca con su origen en `i`. */
export function celdasDe(forma, i) {
  const { fila, columna } = coordenadas(i);
  return forma.map(([x, y]) => {
    const f = fila + y;
    const c = columna + x;
    return f >= 0 && f < LADO && c >= 0 && c < LADO ? indice(f, c) : -1;
  });
}

export function puedeColocar(tablero, forma, i) {
  const celdas = celdasDe(forma, i);
  return celdas.every((celda) => celda !== -1 && tablero[celda] === null);
}

/** Devuelve un tablero NUEVO. Nunca modifica el que recibe. */
export function colocar(tablero, forma, i, color) {
  if (!puedeColocar(tablero, forma, i)) {
    throw new Error('Jugada invalida: la pieza no cabe ahi');
  }
  const siguiente = tablero.slice();
  for (const celda of celdasDe(forma, i)) siguiente[celda] = color;
  return siguiente;
}

/** Una linea se completa solo con bloques de verdad; las bloqueadas no valen. */
function lineaCompleta(tablero, celdas) {
  return celdas.every((c) => tablero[c] !== null && tablero[c] !== BLOQUEADA);
}

export function celdasDeFila(f) {
  return Array.from({ length: LADO }, (_, c) => indice(f, c));
}

export function celdasDeColumna(c) {
  return Array.from({ length: LADO }, (_, f) => indice(f, c));
}

/**
 * Filas y columnas completas. Una celda en el cruce de ambas aparece una sola
 * vez en `celdas`, pero la cuenta de lineas sí suma 2 — asi el puntaje premia
 * el cruce, que es la jugada dificil.
 */
export function lineasCompletas(tablero) {
  const filas = [];
  const columnas = [];
  for (let f = 0; f < LADO; f++) {
    if (lineaCompleta(tablero, celdasDeFila(f))) filas.push(f);
  }
  for (let c = 0; c < LADO; c++) {
    if (lineaCompleta(tablero, celdasDeColumna(c))) columnas.push(c);
  }
  const celdas = new Set();
  for (const f of filas) for (const c of celdasDeFila(f)) celdas.add(c);
  for (const c of columnas) for (const celda of celdasDeColumna(c)) celdas.add(celda);
  return { filas, columnas, celdas: [...celdas], cantidad: filas.length + columnas.length };
}

export function limpiar(tablero, celdas) {
  const siguiente = tablero.slice();
  for (const c of celdas) siguiente[c] = null;
  return siguiente;
}

/**
 * Que pasaria si colocaras esta forma aqui — para pintar el preview antes de
 * soltar. No modifica nada.
 */
export function simular(tablero, forma, i) {
  if (!puedeColocar(tablero, forma, i)) {
    return { valido: false, celdas: [], lineas: null };
  }
  const tras = colocar(tablero, forma, i, '#preview');
  return { valido: true, celdas: celdasDe(forma, i), lineas: lineasCompletas(tras) };
}

/** ¿Queda alguna jugada posible con estas formas? */
export function hayMovimiento(tablero, formas) {
  return formas.some((forma) =>
    Array.from({ length: TOTAL }, (_, i) => i).some((i) => puedeColocar(tablero, forma, i))
  );
}

export function celdasVacias(tablero) {
  const libres = [];
  for (let i = 0; i < TOTAL; i++) if (tablero[i] === null) libres.push(i);
  return libres;
}
