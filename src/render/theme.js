// La paleta vive en OKLCH y se convierte a RGB para PixiJS.
//
// Por que no guardar los hex directamente: OKLCH es perceptualmente uniforme, o
// sea que dos colores con la misma L se ven igual de brillantes aunque tengan
// tonos distintos. En hex eso no pasa (#ffff00 se ve mucho mas claro que
// #0000ff pese a "valer" lo mismo). Manteniendo OKLCH como fuente unica, el CSS
// y el canvas no se pueden desincronizar.

/** OKLCH -> sRGB. Devuelve { r, g, b } en 0..255. */
export function oklchARgb(L, C, H) {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab -> LMS
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS -> sRGB lineal
  const rl = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const gamma = (c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };

  return { r: gamma(rl), g: gamma(gl), b: gamma(bl) };
}

/** OKLCH -> numero 0xRRGGBB, que es lo que come PixiJS. */
export function oklchAHex(L, C, H) {
  const { r, g, b } = oklchARgb(L, C, H);
  return (r << 16) | (g << 8) | b;
}

const ok = (L, C, H) => oklchAHex(L, C, H);

export const TEMA = {
  nocheHonda: ok(0.13, 0.032, 265),
  noche: ok(0.17, 0.034, 265),
  superficie: ok(0.21, 0.036, 265),
  celda: ok(0.25, 0.032, 265),
  borde: ok(0.33, 0.04, 265),
  bordeVivo: ok(0.46, 0.055, 265),
  tinta: ok(0.96, 0.008, 265),
  tintaSuave: ok(0.7, 0.028, 265),
  sellada: ok(0.3, 0.02, 265),
};

/**
 * Los seis colores de pieza. Misma lightness y chroma aproximadas, variando el
 * tono: por eso se leen como un sistema y ninguno grita mas que otro. El ambar
 * y el verde llevan L un poco mas alta porque a igual numero los amarillos se
 * perciben mas apagados que los rosas — la calibracion es perceptual, no
 * aritmetica.
 */
export const COLORES_PIEZA = {
  rosa: { L: 0.72, C: 0.17, H: 350 },
  cyan: { L: 0.78, C: 0.13, H: 200 },
  ambar: { L: 0.81, C: 0.15, H: 85 },
  violeta: { L: 0.68, C: 0.17, H: 292 },
  verde: { L: 0.77, C: 0.155, H: 148 },
  naranja: { L: 0.73, C: 0.16, H: 45 },
};

export const NOMBRES_COLOR = Object.keys(COLORES_PIEZA);

/** nombre -> numero 0xRRGGBB, para PixiJS. */
export const PALETA = Object.fromEntries(
  Object.entries(COLORES_PIEZA).map(([n, c]) => [n, ok(c.L, c.C, c.H)])
);

/** nombre -> string CSS, para el HTML. Misma fuente, dos formatos. */
export const PALETA_CSS = Object.fromEntries(
  Object.entries(PALETA).map(([n, hex]) => [n, `#${hex.toString(16).padStart(6, '0')}`])
);

/** Color del bloque que tira el jefe Basurero. No es una pieza jugable. */
export const BASURA = 'basura';

export const COLORES_JEFE = {
  bloqueador: ok(0.62, 0.215, 15),
  basurero: ok(0.58, 0.09, 75),
  tacano: ok(0.82, 0.17, 92),
  gigante: ok(0.64, 0.2, 295),
};

/** Version mas clara del mismo color, para el brillo interno del bloque. */
export function aclarar(nombre, delta = 0.12) {
  const c = COLORES_PIEZA[nombre];
  if (!c) return TEMA.tinta;
  return ok(Math.min(0.98, c.L + delta), c.C * 0.85, c.H);
}

/** Version mas oscura, para la sombra bajo el bloque. */
export function oscurecer(nombre, delta = 0.22) {
  const c = COLORES_PIEZA[nombre];
  if (!c) return TEMA.nocheHonda;
  return ok(Math.max(0.05, c.L - delta), c.C * 0.9, c.H);
}

/**
 * Cuanto feedback corresponde segun cuantas lineas se limpiaron de una vez.
 * Es el corazon del juego: una, dos, tres y cuatro tienen que ser cuatro
 * sensaciones distintas, no la misma mas grande.
 */
export function intensidad(lineas) {
  if (lineas >= 4) return { particulas: 38, temblor: 16, msTemblor: 400, duracion: 550, semitonos: 12, destello: 1.0 };
  if (lineas === 3) return { particulas: 28, temblor: 10, msTemblor: 300, duracion: 450, semitonos: 7, destello: 0.7 };
  if (lineas === 2) return { particulas: 20, temblor: 6, msTemblor: 240, duracion: 380, semitonos: 3, destello: 0.45 };
  return { particulas: 14, temblor: 3, msTemblor: 180, duracion: 320, semitonos: 0, destello: 0.25 };
}

export const CURVAS = {
  salida: (t) => 1 - Math.pow(2, -10 * t),          // expo
  salidaFirme: (t) => 1 - Math.pow(1 - t, 5),        // quint
  entradaSalida: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};
