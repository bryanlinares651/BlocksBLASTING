import { describe, it, expect } from 'vitest';
import {
  crearTablero, puedeColocar, colocar, lineasCompletas, limpiar, hayMovimiento,
  simular, celdasDeFila, celdasDeColumna, indice, BLOQUEADA, LADO,
} from './board.js';
import { FORMAS, repartir, repartirJugable, crearPieza, GRANDES } from './pieces.js';
import { puntosPorLineas, puntosPorColocar, aplicarXp, xpNecesaria, multiplicadorCombo, BONUS_TABLERO_LIMPIO, GRACIA_COMBO, monedasPorLineas } from './scoring.js';
import { nuevaPartida, jugar, usarPoder, comprar, previsualizar, usarLampara, buscarConsejo, PRECIOS } from './game.js';
import { PREMIO_JEFE } from '../bosses/index.js';

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
      // Umbral fuera de alcance a proposito: dejar el tablero limpio paga 2000
      // de bonus, eso cruzaria el umbral del jefe, y El Bloqueador sella celdas
      // — el tablero ya no quedaria vacio y este test mediria otra cosa.
      proximoJefeEn: 999999,
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

  it('el bonus de tablero limpio puede invocar al jefe en la misma jugada', () => {
    // No es un bug: limpiar todo paga 2000 y eso cruza el umbral. Queda
    // documentado porque es un momento fuerte del juego, no un accidente.
    const p = nuevaPartida({ azar: azarFijo });
    const tablero = crearTablero();
    for (let c = 0; c < 7; c++) tablero[indice(0, c)] = '#f00';
    const listo = { ...p, tablero, puntaje: 0, proximoJefeEn: 2000,
      piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: true },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: true }] };
    const { sucesos } = jugar(listo, 0, indice(0, 7));
    expect(sucesos.some((s) => s.tipo === 'tablero-limpio')).toBe(true);
    expect(sucesos.some((s) => s.tipo === 'jefe-entra')).toBe(true);
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
      // Los cuadros quedan SIN usar a proposito. Si estuvieran gastados, al
      // colocar el punto se dispararia un reparto nuevo, y el reparto justo
      // entregaria algo que entra: el juego seguiria. Aca el final es
      // legitimo — te quedan piezas en mano y ninguna cabe.
      piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: false },
               { nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: false }],
    };
    const { estado, sucesos } = jugar(sinSalida, 0, indice(0, 0));
    expect(sucesos.some((s) => s.tipo === 'lineas-limpiadas')).toBe(false);
    expect(estado.terminada).toBe(true);
    expect(sucesos.some((s) => s.tipo === 'fin-del-juego')).toBe(true);
    // Termina con piezas EN MANO que no entran, no por un reparto nuevo malo:
    // esa distincion es toda la diferencia entre perder jugando y perder por
    // mala suerte del reparto.
    expect(estado.piezas.every((p) => p.usada || !hayMovimiento(estado.tablero, [p.forma])))
      .toBe(true);
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
    // La partida ahora arranca CON bomba y lampara, asi que hay que vaciar el
    // inventario a proposito para probar el rechazo.
    const p = { ...nuevaPartida({ azar: azarFijo }), poderes: { bomba: 0, rayo: 0, lampara: 0 } };
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
    // Sin fijar el precio exacto: lo que importa es que cobre y entregue, no
    // cuanto. Los precios se ajustan al balancear y el test no deberia romperse
    // cada vez.
    const p = nuevaPartida({ azar: azarFijo, monedas: 100 });
    const { estado } = comprar(p, 'bomba');
    expect(estado.monedas).toBeLessThan(100);
    expect(estado.poderes.bomba).toBe(p.poderes.bomba + 1);
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

describe('combos', () => {
  it('el multiplicador crece pero tiene techo', () => {
    expect(multiplicadorCombo(0)).toBe(1);
    expect(multiplicadorCombo(1)).toBe(1);
    expect(multiplicadorCombo(2)).toBe(1.5);
    expect(multiplicadorCombo(3)).toBe(2);
    // Sin techo, una racha larga vuelve irrelevante todo lo demas
    expect(multiplicadorCombo(50)).toBe(5);
  });

  it('limpiar dos jugadas seguidas sube el combo', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const conFila = (fila, pieza) => {
      const t = crearTablero();
      for (let c = 0; c < 7; c++) t[indice(fila, c)] = '#f00';
      return { ...p, tablero: t, combo: 0,
        piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
                 { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
                 { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false }] };
    };
    const uno = jugar(conFila(0), 0, indice(0, 7));
    expect(uno.estado.combo).toBe(1);
    // Segunda limpieza consecutiva partiendo del combo que quedo
    const dosBase = { ...conFila(2), combo: uno.estado.combo };
    const dos = jugar(dosBase, 0, indice(2, 7));
    expect(dos.estado.combo).toBe(2);
    expect(dos.sucesos.find((s) => s.tipo === 'lineas-limpiadas').multiplicador).toBe(1.5);
  });

  it('una jugada sin limpiar gasta gracia; pasada la gracia, corta', () => {
    // Antes se cortaba a la primera. Bryan pidio que aguantara, porque acomodar
    // una pieza para preparar la jugada grande es justo lo que el juego pide.
    const p = { ...nuevaPartida({ azar: azarFijo }), combo: 4, proximoJefeEn: 999999 };
    const primera = jugar(p, 0, 0);
    expect(primera.estado.combo).toBe(4);

    const agotada = { ...p, graciaUsada: GRACIA_COMBO };
    const ultima = jugar(agotada, 0, 0);
    expect(ultima.estado.combo).toBe(0);
    expect(ultima.sucesos.find((s) => s.tipo === 'combo-cortado').era).toBe(4);
  });

  it('guarda el mejor combo de la partida', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const t = crearTablero();
    for (let c = 0; c < 7; c++) t[indice(0, c)] = '#f00';
    const listo = { ...p, tablero: t, combo: 6,
      piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: true },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: true }] };
    expect(jugar(listo, 0, indice(0, 7)).estado.mejorCombo).toBe(7);
  });
});

describe('tablero limpio', () => {
  it('avisa y paga bonus al dejarlo vacio', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const t = crearTablero();
    for (let c = 0; c < 7; c++) t[indice(0, c)] = '#f00';
    const listo = { ...p, tablero: t, puntaje: 0,
      piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: true },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: true }] };
    const { estado, sucesos } = jugar(listo, 0, indice(0, 7));
    const limpio = sucesos.find((s) => s.tipo === 'tablero-limpio');
    expect(limpio).toBeTruthy();
    expect(limpio.bonus).toBe(BONUS_TABLERO_LIMPIO);
    expect(limpio.vez).toBe(1);
    expect(estado.puntaje).toBeGreaterThan(BONUS_TABLERO_LIMPIO);
    expect(estado.tablerosLimpiados).toBe(1);
  });

  it('NO lo avisa si quedan bloques', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const t = crearTablero();
    for (let c = 0; c < 7; c++) t[indice(0, c)] = '#f00';
    t[indice(5, 5)] = '#f00';  // un bloque suelto que sobrevive
    const listo = { ...p, tablero: t,
      piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: true },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: true }] };
    const { sucesos } = jugar(listo, 0, indice(0, 7));
    expect(sucesos.some((s) => s.tipo === 'tablero-limpio')).toBe(false);
  });

  it('el bonus vale mas que la mejor jugada normal', () => {
    // Si no, nadie va a buscar el tablero limpio
    expect(BONUS_TABLERO_LIMPIO).toBeGreaterThan(puntosPorLineas(4));
  });
});

describe('la lampara', () => {
  it('encuentra la jugada que limpia una linea', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const t = crearTablero();
    for (let c = 0; c < 7; c++) t[indice(0, c)] = '#f00';
    const listo = { ...p, tablero: t, poderes: { bomba: 0, rayo: 0, lampara: 1 },
      piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: false },
               { nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: false }] };
    const { estado, sucesos } = usarLampara(listo);
    const consejo = sucesos.find((s) => s.tipo === 'consejo');
    expect(consejo.lineas).toBe(1);
    expect(consejo.celda).toBe(indice(0, 7));  // el unico hueco de la fila
    expect(consejo.indicePieza).toBe(0);
    expect(estado.poderes.lampara).toBe(0);
  });

  it('sin lineas posibles, elige la que deja menos huecos sueltos', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const listo = { ...p, poderes: { bomba: 0, rayo: 0, lampara: 1 },
      piezas: [{ nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: false },
               { nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: true },
               { nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: true }] };
    const consejo = usarLampara(listo).sucesos.find((s) => s.tipo === 'consejo');
    expect(consejo).toBeTruthy();
    expect(consejo.lineas).toBe(0);
    expect(consejo.huecos).toBe(0);   // en tablero vacio no deberia dejar ninguno
  });

  it('NO cobra el poder si no hay ninguna jugada posible', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const sinSalida = { ...p, tablero: Array(64).fill('#f00'),
      poderes: { bomba: 0, rayo: 0, lampara: 1 } };
    const { estado, sucesos } = usarLampara(sinSalida);
    expect(sucesos[0]).toMatchObject({ tipo: 'rechazado', razon: 'sin-consejo' });
    expect(estado.poderes.lampara).toBe(1);   // sigue intacto
  });

  it('respeta al Tacaño: solo aconseja la pieza permitida', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const conJefe = { ...p, poderes: { bomba: 0, rayo: 0, lampara: 1 },
      jefe: { id: 'tacano', soloLaPrimera: true, turnosRestantes: 5 },
      piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: false },
               { nombre: 'cuadro', forma: FORMAS.cuadro, color: '#0ff', usada: false }] };
    const consejo = usarLampara(conJefe).sucesos.find((s) => s.tipo === 'consejo');
    expect(consejo.indicePieza).toBe(0);
  });

  it('se puede comprar en la tienda', () => {
    const p = nuevaPartida({ azar: azarFijo, monedas: 100 });
    const { estado } = comprar(p, 'lampara');
    expect(estado.monedas).toBeLessThan(100);
    expect(estado.poderes.lampara).toBe(p.poderes.lampara + 1);
  });
});

describe('catalogo de formas', () => {
  it('toda forma tiene al menos una celda y ninguna se repite', () => {
    for (const [nombre, forma] of Object.entries(FORMAS)) {
      expect(forma.length, nombre).toBeGreaterThan(0);
      const claves = forma.map(([x, y]) => `${x},${y}`);
      expect(new Set(claves).size, `${nombre} tiene celdas repetidas`).toBe(forma.length);
    }
  });

  it('ninguna forma es mas grande que el tablero', () => {
    for (const [nombre, forma] of Object.entries(FORMAS)) {
      const ancho = Math.max(...forma.map((p) => p[0])) + 1;
      const alto = Math.max(...forma.map((p) => p[1])) + 1;
      expect(ancho, `${nombre} es muy ancha`).toBeLessThanOrEqual(LADO);
      expect(alto, `${nombre} es muy alta`).toBeLessThanOrEqual(LADO);
    }
  });

  it('toda forma entra en un tablero vacio', () => {
    // Una forma que no entra nunca seria una partida perdida de arranque
    for (const [nombre, forma] of Object.entries(FORMAS)) {
      expect(hayMovimiento(crearTablero(), [forma]), `${nombre} no entra`).toBe(true);
    }
  });
});

describe('reparto justo', () => {
  // Bryan perdio una partida asi: coloco sus tres piezas, le repartieron tres
  // nuevas al azar, ninguna entraba y se acabo el juego sin que hubiera jugado
  // mal. El reparto tiene que mirar el tablero.
  const cabe = (tablero, forma) => {
    for (let i = 0; i < tablero.length; i++) if (puedeColocar(tablero, forma, i)) return true;
    return false;
  };

  it('con huecos de una sola celda, reparte algo que entra', () => {
    // Tablero con solo huecos sueltos: unicamente el 'punto' cabe. Un reparto
    // al azar casi nunca lo incluye tres veces seguidas.
    const t = Array(64).fill('#f00');
    for (let i = 0; i < LADO; i++) t[indice(i, i)] = null;
    const azarQueNuncaDaElPunto = () => 0.5;   // cae siempre en la misma forma grande
    const piezas = repartirJugable(t, cabe, 3, azarQueNuncaDaElPunto);
    expect(piezas.some((p) => cabe(t, p.forma))).toBe(true);
  });

  it('reparte jugable en cien tableros distintos', () => {
    // Prueba de fuerza bruta: si el reparto justo tiene un agujero, aparece aca.
    let fallos = 0;
    for (let semilla = 0; semilla < 100; semilla++) {
      let x = semilla + 1;
      const azar = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
      const t = Array(64).fill('#f00');
      // dejar entre 1 y 8 huecos sueltos, en diagonal
      const huecos = 1 + (semilla % 8);
      for (let i = 0; i < huecos; i++) t[indice(i, i)] = null;
      const piezas = repartirJugable(t, cabe, 3, azar);
      if (!piezas.some((p) => cabe(t, p.forma))) fallos++;
    }
    expect(fallos).toBe(0);
  });

  it('con el tablero realmente lleno, no se cuelga', () => {
    // Aca perder SI es legitimo: no hay hueco para nada.
    const lleno = Array(64).fill('#f00');
    expect(() => repartirJugable(lleno, cabe, 3, () => 0.5)).not.toThrow();
    expect(repartirJugable(lleno, cabe, 3, () => 0.5)).toHaveLength(3);
  });

  it('jugando una partida entera, ningun reparto nuevo llega muerto', () => {
    // La regla es sobre el REPARTO: cada vez que el juego entrega piezas
    // nuevas, al menos una tiene que entrar. Que las piezas que YA tenias en
    // mano dejen de caber si es parte del juego — ahi perdes por como jugaste.
    let estado = nuevaPartida({ azar: () => 0.37 });
    let repartosMuertos = 0;
    let repartos = 0;
    for (let turno = 0; turno < 120 && !estado.terminada; turno++) {
      const libre = estado.piezas.findIndex((p) => !p.usada);
      if (libre < 0) break;
      let jugo = false;
      for (let celda = 0; celda < 64 && !jugo; celda++) {
        const r = jugar(estado, libre, celda);
        if (r.sucesos.some((s) => s.tipo === 'colocada')) {
          if (r.sucesos.some((s) => s.tipo === 'piezas-nuevas')) {
            repartos++;
            const alguna = r.estado.piezas.some((p) => cabe(r.estado.tablero, p.forma));
            if (!alguna && Object.values(FORMAS).some((f) => cabe(r.estado.tablero, f))) {
              repartosMuertos++;
            }
          }
          estado = r.estado;
          jugo = true;
        }
      }
      if (!jugo) break;
    }
    expect(repartos).toBeGreaterThan(3);      // que la partida realmente repartio
    expect(repartosMuertos).toBe(0);
  });
});

describe('combo con gracia', () => {
  const conCombo = (combo, gracia = 0) => ({
    ...nuevaPartida({ azar: azarFijo }), combo, graciaUsada: gracia, proximoJefeEn: 999999,
  });

  it('una jugada sin limpiar NO corta la racha', () => {
    const { estado, sucesos } = jugar(conCombo(3), 0, 0);
    expect(estado.combo).toBe(3);
    expect(sucesos.some((s) => s.tipo === 'combo-cortado')).toBe(false);
    expect(sucesos.find((s) => s.tipo === 'combo-en-riesgo').quedan).toBe(GRACIA_COMBO);
  });

  it('se corta recien al pasarse de la gracia', () => {
    let estado = conCombo(3);
    for (let i = 0; i < GRACIA_COMBO; i++) {
      estado = jugar(estado, estado.piezas.findIndex((p) => !p.usada), indice(i, 0)).estado;
      expect(estado.combo).toBe(3);
    }
    const ultima = jugar(estado, estado.piezas.findIndex((p) => !p.usada), indice(6, 0));
    expect(ultima.estado.combo).toBe(0);
    expect(ultima.sucesos.some((s) => s.tipo === 'combo-cortado')).toBe(true);
  });

  it('limpiar devuelve la gracia entera', () => {
    const t = crearTablero();
    for (let c = 0; c < 7; c++) t[indice(0, c)] = '#f00';
    const gastada = { ...conCombo(2, GRACIA_COMBO), tablero: t,
      piezas: [{ nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: false },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: true },
               { nombre: 'punto', forma: FORMAS.punto, color: '#0ff', usada: true }] };
    const { estado } = jugar(gastada, 0, indice(0, 7));
    expect(estado.combo).toBe(3);
    expect(estado.graciaUsada).toBe(0);
  });

  it('sin combo activo no avisa de riesgo', () => {
    const { sucesos } = jugar(conCombo(0), 0, 0);
    expect(sucesos.some((s) => s.tipo === 'combo-en-riesgo')).toBe(false);
  });
});

describe('economia de poderes', () => {
  it('un poder esta al alcance en pocas limpiezas', () => {
    // Se mide la REGLA, no el precio: querer un poder y poder comprarlo en el
    // momento, no dentro de media partida. Fijar el numero exacto rompia el
    // test en cada rebalanceo sin que nada estuviera mal.
    const masBarato = Math.min(...Object.values(PRECIOS));
    const limpiezasNecesarias = Math.ceil(masBarato / monedasPorLineas(1));
    expect(limpiezasNecesarias).toBeLessThanOrEqual(3);
  });

  it('la jugada grande paga MUCHO mas que varias chicas', () => {
    // Premia habilidad, no volumen: cuatro lineas de una vez valen mas que
    // cuatro limpiezas de a una.
    expect(monedasPorLineas(4)).toBeGreaterThan(monedasPorLineas(1) * 4);
  });

  it('los jefes pagan por aguantarlos', () => {
    // Antes daban cero: aguantar al mas duro del juego valia lo mismo que
    // colocar una pieza suelta, y encima te dejaba el tablero peor.
    expect(PREMIO_JEFE.entra).toBeGreaterThan(0);
    expect(PREMIO_JEFE.vencido).toBeGreaterThan(0);
    expect(PREMIO_JEFE.cuota).toBeGreaterThan(PREMIO_JEFE.vencido);
  });

  it('un poder sobre celdas vacias NO se cobra', () => {
    const p = { ...nuevaPartida({ azar: azarFijo }), poderes: { bomba: 1, rayo: 0, lampara: 0 } };
    const r = usarPoder(p, 'bomba', indice(4, 4));   // tablero vacio
    expect(r.sucesos[0]).toMatchObject({ tipo: 'rechazado', razon: 'nada-que-romper' });
    expect(r.estado.poderes.bomba).toBe(1);
    expect(r.estado.puntaje).toBe(p.puntaje);   // tampoco regala los 80 puntos
  });

  it('un poder sobre celdas con bloques SI se cobra', () => {
    const t = Array(64).fill('rosa');
    const p = { ...nuevaPartida({ azar: azarFijo }), tablero: t,
                poderes: { bomba: 1, rayo: 0, lampara: 0 } };
    const r = usarPoder(p, 'bomba', indice(4, 4));
    expect(r.sucesos[0].tipo).toBe('poder-usado');
    expect(r.estado.poderes.bomba).toBe(0);
  });

  it('la racha paga mas monedas, con techo', () => {
    expect(monedasPorLineas(1, 5)).toBeGreaterThan(monedasPorLineas(1, 1));
    expect(monedasPorLineas(1, 50)).toBe(monedasPorLineas(1, 7)); // el techo aplica
  });

  it('una jugada sin limpiar igual paga algo', () => {
    expect(monedasPorLineas(0)).toBeGreaterThan(0);
  });

  it('la partida arranca con poderes para probar', () => {
    const p = nuevaPartida({ azar: azarFijo });
    const total = p.poderes.bomba + p.poderes.rayo + p.poderes.lampara;
    expect(total).toBeGreaterThan(0);
  });

  it('con las monedas de arranque alcanza para varios poderes', () => {
    // 120 monedas iniciales: tiene que dar para probar de todo, no para uno solo
    let p = nuevaPartida({ azar: azarFijo, monedas: 120 });
    let comprados = 0;
    for (const art of ['bomba', 'rayo', 'lampara', 'revolver']) {
      const r = comprar(p, art);
      if (r.sucesos[0].tipo === 'comprado') { comprados++; p = r.estado; }
    }
    expect(comprados).toBe(4);
  });
});
