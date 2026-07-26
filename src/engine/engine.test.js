import { describe, it, expect } from 'vitest';
import {
  crearTablero, puedeColocar, colocar, lineasCompletas, limpiar, hayMovimiento,
  simular, celdasDeFila, celdasDeColumna, indice, BLOQUEADA, LADO,
} from './board.js';
import { FORMAS, repartir, crearPieza, GRANDES } from './pieces.js';
import { puntosPorLineas, puntosPorColocar, aplicarXp, xpNecesaria } from './scoring.js';
import { nuevaPartida, jugar, usarPoder, comprar, previsualizar } from './game.js';

// Azar fijo para que los tests no dependan de la suerte.
const azarFijo = () => 0;

describe('tablero: colocar', () => {
  it('acepta una pieza que cabe', () => {
    expect(puedeColocar(crearTablero(), FORMAS.cuadro, 0)).toBe(true);
  });

  it('rechaza una pieza que se sale por la derecha', () => {
    // cuatro_h en la columna 7 necesitaria las columnas 8, 9 y 10
    expect(puedeColocar(crearTablero(), FORMAS.cuatro_h, indice(0, 7))).toBe(false);
  });

  it('rechaza una pieza que se sale por abajo', () => {
    expect(puedeColocar(crearTablero(), FORMAS.cuatro_v, indice(7, 0))).toBe(false);
  });

  it('rechaza si la celda ya esta ocupada', () => {
    const t = colocar(crearTablero(), FORMAS.punto, 0, '#f00');
    expect(puedeColocar(t, FORMAS.punto, 0)).toBe(false);
  });

  it('no modifica el tablero que recibe', () => {
    const original = crearTablero();
    colocar(original, FORMAS.cuadro, 0, '#f00');
    expect(original.every((c) => c === null)).toBe(true);
  });

  it('una pieza que se sale NO envuelve a la fila siguiente', () => {
    // El bug clasico de las cuadriculas planas: columna 7 + 1 = columna 0 de la fila de abajo.
    const t = crearTablero();
    expect(puedeColocar(t, FORMAS.dos_h, indice(3, 7))).toBe(false);
  });
});

describe('tablero: lineas', () => {
  it('detecta una fila completa', () => {
    let t = crearTablero();
    for (const c of celdasDeFila(3)) t[c] = '#f00';
    const l = lineasCompletas(t);
    expect(l.filas).toEqual([3]);
    expect(l.cantidad).toBe(1);
    expect(l.celdas).toHaveLength(8);
  });

  it('detecta una columna completa', () => {
    let t = crearTablero();
    for (const c of celdasDeColumna(5)) t[c] = '#f00';
    expect(lineasCompletas(t).columnas).toEqual([5]);
  });

  it('cuenta fila y columna cruzadas como 2 lineas pero 15 celdas', () => {
    let t = crearTablero();
    for (const c of celdasDeFila(0)) t[c] = '#f00';
    for (const c of celdasDeColumna(0)) t[c] = '#f00';
    const l = lineasCompletas(t);
    expect(l.cantidad).toBe(2);
    expect(l.celdas).toHaveLength(15); // 8 + 8 - 1 de la esquina compartida
  });

  it('una celda BLOQUEADA impide completar la linea', () => {
    let t = crearTablero();
    for (const c of celdasDeFila(2)) t[c] = '#f00';
    t[indice(2, 4)] = BLOQUEADA;
    expect(lineasCompletas(t).cantidad).toBe(0);
  });

  it('limpiar deja las celdas vacias', () => {
    let t = crearTablero();
    for (const c of celdasDeFila(1)) t[c] = '#f00';
    const limpio = limpiar(t, celdasDeFila(1));
    expect(limpio.filter(Boolean)).toHaveLength(0);
  });
});

describe('tablero: fin de juego', () => {
  it('con el tablero lleno no hay movimiento', () => {
    const lleno = Array(64).fill('#f00');
    expect(hayMovimiento(lleno, [FORMAS.punto])).toBe(false);
  });

  it('con un hueco suelto, el punto entra pero el cuadro no', () => {
    const casiLleno = Array(64).fill('#f00');
    casiLleno[indice(4, 4)] = null;
    expect(hayMovimiento(casiLleno, [FORMAS.punto])).toBe(true);
    expect(hayMovimiento(casiLleno, [FORMAS.cuadro])).toBe(false);
  });
});

describe('tablero: vista previa', () => {
  it('avisa cuantas lineas se limpiarian antes de soltar', () => {
    let t = crearTablero();
    for (let c = 0; c < 7; c++) t[indice(0, c)] = '#f00';
    const p = simular(t, FORMAS.punto, indice(0, 7));
    expect(p.valido).toBe(true);
    expect(p.lineas.cantidad).toBe(1);
  });

  it('marca invalido sin romperse cuando no cabe', () => {
    const lleno = Array(64).fill('#f00');
    const p = simular(lleno, FORMAS.punto, 0);
    expect(p.valido).toBe(false);
    expect(p.celdas).toEqual([]);
  });
});

describe('puntaje', () => {
  it('4 lineas de una vez valen mucho mas que 4 de a una', () => {
    expect(puntosPorLineas(4)).toBe(1120);
    expect(puntosPorLineas(1) * 4).toBe(280);
    expect(puntosPorLineas(4)).toBeGreaterThan(puntosPorLineas(1) * 4);
  });

  it('colocar siempre suma algo', () => {
    expect(puntosPorColocar(1)).toBe(10);
    expect(puntosPorLineas(0)).toBe(0);
  });

  it('una jugada enorme puede subir varios niveles de golpe', () => {
    // nivel 1 pide 500, nivel 2 pide 1000 -> 1600 alcanza para dos subidas
    const r = aplicarXp({ nivel: 1, xp: 0 }, 1600);
    expect(r.nivel).toBe(3);
    expect(r.subidas).toBe(2);
    expect(r.monedasExtra).toBe(100);
    expect(r.xp).toBe(100);
  });

  it('sin xp suficiente no sube de nivel', () => {
    const r = aplicarXp({ nivel: 1, xp: 0 }, 100);
    expect(r.nivel).toBe(1);
    expect(r.subidas).toBe(0);
  });
});

describe('partida', () => {
  it('colocar suma puntos y marca la pieza como usada', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const { estado, sucesos } = jugar(p, 0, 0);
    expect(estado.puntaje).toBeGreaterThan(0);
    expect(estado.piezas[0].usada).toBe(true);
    expect(sucesos.some((s) => s.tipo === 'colocada')).toBe(true);
  });

  it('rechaza reusar una pieza ya gastada', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const primera = jugar(p, 0, 0).estado;
    const ocupadasAntes = primera.tablero.filter(Boolean).length;
    const segunda = jugar(primera, 0, indice(4, 0));
    expect(segunda.estado.tablero.filter(Boolean).length).toBe(ocupadasAntes);
    expect(segunda.sucesos[0]).toMatchObject({ tipo: 'rechazado', razon: 'ya-usada' });
  });

  it('rechaza una jugada donde no cabe, sin romper el estado', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const lleno = { ...p, tablero: Array(64).fill('#f00') };
    const r = jugar(lleno, 0, 0);
    expect(r.sucesos[0]).toMatchObject({ tipo: 'rechazado', razon: 'no-cabe' });
    expect(r.estado).toBe(lleno);
  });

  it('limpiar una linea avisa con un suceso y suma monedas', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const tablero = crearTablero();
    for (let c = 0; c < 7; c++) tablero[indice(0, c)] = '#f00';
    const listo = {
      ...p,
      tablero,
      piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false }],
    };
    const { estado, sucesos } = jugar(listo, 0, indice(0, 7));
    const limpiadas = sucesos.find((s) => s.tipo === 'lineas-limpiadas');
    expect(limpiadas.cantidad).toBe(1);
    expect(estado.tablero.filter(Boolean)).toHaveLength(0);
    expect(estado.monedas).toBeGreaterThan(p.monedas);
  });

  it('reparte piezas nuevas al gastar las tres', () => {
    let estado = nuevaPartida({ azar: azarFijo });
    const sucesosTotales = [];
    for (let i = 0; i < 3; i++) {
      const r = jugar(estado, i, indice(i * 2, 0));
      estado = r.estado;
      sucesosTotales.push(...r.sucesos);
    }
    expect(sucesosTotales.some((s) => s.tipo === 'piezas-nuevas')).toBe(true);
    expect(estado.piezas.every((p) => !p.usada)).toBe(true);
  });

  it('detecta el fin del juego', () => {
    // Un tablero ahogado NO es un tablero lleno: uno lleno tiene todas las
    // filas completas y la primera jugada lo limpia entero. Este deja la
    // diagonal vacia (un hueco por fila y por columna, asi nada esta
    // completo) mas dos huecos sueltos en la fila y la columna donde vamos a
    // jugar, para que ni siquiera esa jugada complete algo. Todos los huecos
    // quedan aislados: solo entraria el 'punto', y el reparto da 'cruz'.
    const azarGrande = () => 0.99; // reparte 'cruz', de 5 celdas
    const p = nuevaPartida({ azar: azarGrande });
    const tablero = Array(64).fill('#f00');
    for (let i = 0; i < LADO; i++) tablero[indice(i, i)] = null;
    tablero[indice(0, 4)] = null;
    tablero[indice(4, 0)] = null;
    const sinSalida = {
      ...p,
      tablero,
      piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: true },
               { nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: true }],
    };
    const { estado, sucesos } = jugar(sinSalida, 0, indice(0, 0));
    expect(sucesos.some((s) => s.tipo === 'lineas-limpiadas')).toBe(false);
    expect(estado.terminada).toBe(true);
    expect(sucesos.some((s) => s.tipo === 'fin-del-juego')).toBe(true);
  });

  it('guarda el mejor puntaje', () => {
    const p = nuevaPartida({ azar: azarFijo, mejor: 0 });
    const { estado } = jugar(p, 0, 0);
    expect(estado.mejor).toBe(estado.puntaje);
  });
});

describe('poderes', () => {
  it('la bomba explota DONDE elegis, no en la esquina', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const tablero = Array(64).fill('#f00');
    const con = { ...p, tablero, poderes: { bomba: 1, rayo: 0 } };
    const { estado, sucesos } = usarPoder(con, 'bomba', indice(4, 4));
    // 3x3 alrededor de (4,4) = 9 celdas, y la esquina 0 sigue llena
    expect(sucesos[0].celdas).toHaveLength(9);
    expect(estado.tablero[indice(0, 0)]).toBe('#f00');
    expect(estado.tablero[indice(4, 4)]).toBe(null);
  });

  it('la bomba en una esquina recorta el 3x3 sin salirse', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const con = { ...p, tablero: Array(64).fill('#f00'), poderes: { bomba: 1, rayo: 0 } };
    const { sucesos } = usarPoder(con, 'bomba', indice(0, 0));
    expect(sucesos[0].celdas).toHaveLength(4); // solo el cuadrante que existe
  });

  it('el rayo limpia la fila elegida', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const con = { ...p, tablero: Array(64).fill('#f00'), poderes: { bomba: 0, rayo: 1 } };
    const { estado } = usarPoder(con, 'rayo', indice(6, 3));
    expect(celdasDeFila(6).every((c) => estado.tablero[c] === null)).toBe(true);
    expect(estado.tablero[indice(5, 3)]).toBe('#f00');
  });

  it('no deja usar un poder que no tenes', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const r = usarPoder(p, 'bomba', 0);
    expect(r.sucesos[0]).toMatchObject({ tipo: 'rechazado', razon: 'sin-poder' });
  });

  it('un poder NO borra las celdas del jefe', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const tablero = Array(64).fill('#f00');
    tablero[indice(4, 4)] = BLOQUEADA;
    const con = { ...p, tablero, poderes: { bomba: 1, rayo: 0 } };
    const { estado } = usarPoder(con, 'bomba', indice(4, 4));
    expect(estado.tablero[indice(4, 4)]).toBe(BLOQUEADA);
  });
});

describe('tienda', () => {
  it('compra un poder y descuenta las monedas', () => {
    const p = nuevaPartida({ azar: azarFijo, monedas: 100 });
    const { estado } = comprar(p, 'bomba');
    expect(estado.monedas).toBe(60);
    expect(estado.poderes.bomba).toBe(1);
  });

  it('no deja comprar sin monedas', () => {
    const p = nuevaPartida({ azar: azarFijo, monedas: 10 });
    const r = comprar(p, 'bomba');
    expect(r.sucesos[0]).toMatchObject({ tipo: 'rechazado', razon: 'sin-monedas' });
    expect(r.estado.monedas).toBe(10);
  });

  it('revolver cambia las piezas', () => {
    const p = nuevaPartida({ azar: azarFijo, monedas: 100 });
    const gastada = { ...p, piezas: p.piezas.map((x) => ({ ...x, usada: true })) };
    const { estado } = comprar(gastada, 'revolver');
    expect(estado.piezas.every((x) => !x.usada)).toBe(true);
  });
});

describe('piezas', () => {
  it('reparte la cantidad pedida', () => {
    expect(repartir(3, azarFijo)).toHaveLength(3);
    expect(repartir(2, azarFijo)).toHaveLength(2);
  });

  it('el catalogo de grandes solo trae piezas de 4 o mas', () => {
    expect(GRANDES.length).toBeGreaterThan(0);
    for (const nombre of GRANDES) expect(FORMAS[nombre].length).toBeGreaterThanOrEqual(4);
  });

  it('una pieza nueva arranca sin usar y con forma propia', () => {
    const p = crearPieza(azarFijo);
    expect(p.usada).toBe(false);
    p.forma[0][0] = 99;
    expect(crearPieza(azarFijo).forma[0][0]).not.toBe(99); // no comparte la forma del catalogo
  });
});
