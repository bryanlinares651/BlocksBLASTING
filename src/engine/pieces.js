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

export function formasDisponibles(piezas) {
  return piezas.filter((p) => !p.usada).map((p) => p.forma);
}
