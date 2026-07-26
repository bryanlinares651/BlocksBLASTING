// Los tres estilos del juego. Rotan cada vez que dejas el tablero vacio.
//
// La idea (de Bryan): limpiar el tablero entero no deberia dar solo puntos,
// deberia darte algo NUEVO que ver. Asi la jugada dificil tiene una recompensa
// que se siente, y hay una razon para buscar el tablero limpio en vez de
// acumular bloques.
//
// Cada tema define su paleta en OKLCH, su fondo y como se dibujan los bloques.
// Agregar un tema es sumar un objeto a la lista: nada mas lo conoce por nombre.

import { oklchAHex } from './theme.js';

const ok = (L, C, H) => oklchAHex(L, C, H);
const css = (L, C, H) => `oklch(${L} ${C} ${H})`;

export const TEMAS = [
  {
    id: 'jugoso',
    nombre: 'JUGOSO',
    lema: 'Blandito y dulce',
    // Colores de caramelo: lightness alta y chroma generosa. Se ven ricos.
    piezas: {
      rosa:    { L: 0.74, C: 0.185, H: 355 },
      cyan:    { L: 0.80, C: 0.135, H: 196 },
      ambar:   { L: 0.85, C: 0.155, H: 88 },
      violeta: { L: 0.70, C: 0.180, H: 292 },
      verde:   { L: 0.80, C: 0.165, H: 150 },
      naranja: { L: 0.76, C: 0.170, H: 45 },
    },
    fondo: {
      base: css(0.15, 0.035, 275),
      resplandor: css(0.32, 0.080, 280),
      celda: ok(0.26, 0.034, 275),
      tablero: ok(0.155, 0.032, 275),
    },
    bloque: { radio: 0.28, brillo: 0.62, sombra: 0.26, aplaste: 1 },
    particulas: { vida: 0.9, gravedad: 2300, rebote: 0.5 },
  },

  {
    id: 'neon',
    nombre: 'NEÓN',
    lema: 'Máquina de salón',
    // Chroma al maximo y fondo casi negro: los bloques parecen tubos encendidos.
    piezas: {
      rosa:    { L: 0.68, C: 0.255, H: 350 },
      cyan:    { L: 0.80, C: 0.180, H: 195 },
      ambar:   { L: 0.83, C: 0.190, H: 92 },
      violeta: { L: 0.62, C: 0.250, H: 295 },
      verde:   { L: 0.78, C: 0.215, H: 145 },
      naranja: { L: 0.70, C: 0.215, H: 40 },
    },
    fondo: {
      base: css(0.09, 0.028, 268),
      resplandor: css(0.26, 0.115, 300),
      celda: ok(0.18, 0.030, 268),
      tablero: ok(0.10, 0.026, 268),
    },
    bloque: { radio: 0.14, brillo: 0.85, sombra: 0.12, aplaste: 0.6 },
    particulas: { vida: 0.75, gravedad: 1700, rebote: 0.62 },
  },

  {
    id: 'cosmico',
    nombre: 'CÓSMICO',
    lema: 'Cristales en el vacío',
    // Fondo profundo con estrellas; las piezas bajan la chroma y suben la
    // luminosidad para parecer cristal iluminado desde adentro.
    piezas: {
      rosa:    { L: 0.78, C: 0.130, H: 340 },
      cyan:    { L: 0.84, C: 0.100, H: 205 },
      ambar:   { L: 0.88, C: 0.110, H: 80 },
      violeta: { L: 0.74, C: 0.135, H: 285 },
      verde:   { L: 0.82, C: 0.115, H: 160 },
      naranja: { L: 0.80, C: 0.120, H: 50 },
    },
    fondo: {
      base: css(0.11, 0.040, 258),
      resplandor: css(0.30, 0.095, 250),
      celda: ok(0.20, 0.038, 258),
      tablero: ok(0.125, 0.036, 258),
    },
    bloque: { radio: 0.20, brillo: 0.50, sombra: 0.18, aplaste: 0.8 },
    particulas: { vida: 1.25, gravedad: 900, rebote: 0.35 },  // flotan, no caen
    estrellas: true,
  },
];

export const NOMBRES_TEMA = TEMAS.map((t) => t.id);

export function temaPorId(id) {
  return TEMAS.find((t) => t.id === id) ?? TEMAS[0];
}

export function siguienteTema(idActual) {
  const i = TEMAS.findIndex((t) => t.id === idActual);
  return TEMAS[(i + 1) % TEMAS.length];
}

/** Colores del tema listos para PixiJS (numero) y para CSS (texto). */
export function paletaDe(tema) {
  const pixi = {};
  const texto = {};
  for (const [nombre, c] of Object.entries(tema.piezas)) {
    pixi[nombre] = ok(c.L, c.C, c.H);
    texto[nombre] = `oklch(${c.L} ${c.C} ${c.H})`;
  }
  return { pixi, texto };
}

/** Vuelca el tema a variables CSS. El HTML se repinta solo. */
export function aplicarCss(tema) {
  const raiz = document.documentElement;
  const { texto } = paletaDe(tema);
  for (const [nombre, valor] of Object.entries(texto)) {
    raiz.style.setProperty(`--p-${nombre}`, valor);
  }
  raiz.style.setProperty('--noche-honda', tema.fondo.base);
  raiz.style.setProperty('--resplandor', tema.fondo.resplandor);
  raiz.dataset.tema = tema.id;
}
