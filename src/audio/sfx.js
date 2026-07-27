// Sonido generado por codigo. Cero archivos que descargar.
//
// Dos cosas de iOS que hay que respetar o no suena nada:
//  1. El contexto de audio arranca suspendido hasta que el usuario toca la
//     pantalla. Por eso `despertar()` se llama en el primer toque, no al cargar.
//  2. El interruptor de silencio del iPhone silencia la categoria por defecto.
//     No hay forma de saltarlo desde la web, y por eso la vibracion va aparte:
//     con el telefono en silencio, la vibracion es todo el feedback que queda.

const BASE = 320; // Hz, la nota de la que cuelga todo lo demas

/**
 * Escala pentatonica mayor. Cada jugada encadenada sube un peldaño.
 *
 * Antes el tono dependia SOLO de cuantas lineas hacias de una vez: romper una
 * linea cinco turnos seguidos sonaba cinco veces igual. Ahora la racha sube la
 * nota, y eso es lo que hace que no quieras cortarla — el oido anticipa la
 * siguiente y romper el combo se siente como una nota que falta.
 *
 * Pentatonica y no cromatica porque cualquier par de sus notas suena bien junto:
 * no hay forma de que una racha larga produzca una combinacion desafinada.
 */
const ESCALA_COMBO = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

/** Sube `n` semitonos sobre una frecuencia. */
function semitonos(hz, n) {
  return hz * Math.pow(2, n / 12);
}

export class Sonido {
  constructor() {
    this.ctx = null;
    this.maestro = null;
    this.silenciado = localStorage.getItem('nova-silencio') === '1';
    this.vibrar = localStorage.getItem('nova-vibrar') !== '0';
  }

  despertar() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.maestro = this.ctx.createGain();
    this.maestro.gain.value = 0.28;
    this.maestro.connect(this.ctx.destination);
  }

  get activo() {
    return this.ctx && !this.silenciado;
  }

  alternarSilencio() {
    this.silenciado = !this.silenciado;
    localStorage.setItem('nova-silencio', this.silenciado ? '1' : '0');
    return this.silenciado;
  }

  /** Un tono simple con envolvente. La envolvente es lo que evita el "clic" del corte seco. */
  tono({ hz, tipo = 'triangle', duracion = 0.12, volumen = 0.5, ataque = 0.005, desliz = 0 }) {
    if (!this.activo) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gan = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(hz, t);
    if (desliz) osc.frequency.exponentialRampToValueAtTime(Math.max(20, hz + desliz), t + duracion);
    gan.gain.setValueAtTime(0.0001, t);
    gan.gain.exponentialRampToValueAtTime(volumen, t + ataque);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    osc.connect(gan).connect(this.maestro);
    osc.start(t);
    osc.stop(t + duracion + 0.02);
  }

  /** Ruido corto filtrado: es lo que suena a "crujido" y no a pitido. */
  ruido({ duracion = 0.16, volumen = 0.35, corte = 1600, q = 1.2 }) {
    if (!this.activo) return;
    const t = this.ctx.currentTime;
    const muestras = Math.floor(this.ctx.sampleRate * duracion);
    const buffer = this.ctx.createBuffer(1, muestras, this.ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < muestras; i++) {
      datos[i] = (Math.random() * 2 - 1) * (1 - i / muestras);
    }
    const fuente = this.ctx.createBufferSource();
    fuente.buffer = buffer;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = corte;
    filtro.Q.value = q;
    const gan = this.ctx.createGain();
    gan.gain.setValueAtTime(volumen, t);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    fuente.connect(filtro).connect(gan).connect(this.maestro);
    fuente.start(t);
  }

  /**
   * Vibracion. OJO: iOS Safari NO implementa la Vibration API, asi que en el
   * iPhone esto no hace nada por mas que se llame. Por eso el sub-grave de
   * abajo no es un adorno: es el unico "golpe fisico" que llega en iPhone,
   * porque el parlante mueve aire y eso se siente en la mano.
   */
  pulso(ms) {
    if (this.vibrar && navigator.vibrate) navigator.vibrate(ms);
  }

  /** Golpe sub-grave. Es lo que le da cuerpo al impacto en un parlante chico. */
  subGrave({ desde = 130, hasta = 42, duracion = 0.09, volumen = 0.55 } = {}) {
    if (!this.activo) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gan = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(desde, t);
    osc.frequency.exponentialRampToValueAtTime(hasta, t + duracion);
    gan.gain.setValueAtTime(0.0001, t);
    gan.gain.exponentialRampToValueAtTime(volumen, t + 0.004);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    osc.connect(gan).connect(this.maestro);
    osc.start(t);
    osc.stop(t + duracion + 0.02);
  }

  /**
   * Chasquido de ataque: 2 ms de nada que cambian todo. Sin esto el sonido
   * "empieza" en vez de "golpear", y por mas grave que le pongas atras se
   * sigue sintiendo blando.
   */
  chasquido(volumen = 0.4) {
    if (!this.activo) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gan = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.007);
    gan.gain.setValueAtTime(volumen, t);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    osc.connect(gan).connect(this.maestro);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  // --- Los sonidos del juego ---

  colocar() {
    this.chasquido(0.16);
    this.tono({ hz: 180, tipo: 'triangle', duracion: 0.07, volumen: 0.32, desliz: -60 });
    this.subGrave({ desde: 95, hasta: 55, duracion: 0.05, volumen: 0.22 });
    this.pulso(12);
  }

  /**
   * El sonido central. Sube `n` semitonos segun cuantas lineas se limpiaron, y
   * arriba de dos agrega una quinta: cuatro lineas tienen que sonar a acorde,
   * no al mismo pitido mas agudo.
   */
  limpiar(lineas, semis, combo = 1) {
    // La nota sale de DOS ejes: cuantas lineas de una vez (semis) y cuantas
    // jugadas encadenadas (la escala). Son cosas distintas y las dos merecen
    // premio propio.
    const peldano = ESCALA_COMBO[Math.min(Math.max(combo - 1, 0), ESCALA_COMBO.length - 1)];
    const raiz = semitonos(BASE, semis + peldano);

    this.chasquido(0.34 + lineas * 0.05);
    this.subGrave({ desde: 120 + lineas * 14, volumen: 0.42 + lineas * 0.06 });
    this.ruido({ duracion: 0.13 + lineas * 0.02, volumen: 0.3, corte: 900 + lineas * 500 + combo * 120 });
    this.tono({ hz: raiz, tipo: 'triangle', duracion: 0.17 + lineas * 0.04, volumen: 0.4 });
    this.tono({ hz: semitonos(raiz, 7), tipo: 'sine', duracion: 0.2 + lineas * 0.05, volumen: 0.24 });
    if (lineas >= 3) {
      this.tono({ hz: semitonos(raiz, 12), tipo: 'sine', duracion: 0.3, volumen: 0.2 });
    }
    if (lineas >= 4) {
      this.tono({ hz: semitonos(raiz, 16), tipo: 'sine', duracion: 0.42, volumen: 0.18 });
    }
    // Racha alta: arpegio corto arriba de todo. Es el premio de la racha, no
    // de las lineas, y por eso solo suena cuando el combo lo justifica.
    if (combo >= 4) {
      [0, 4, 7].forEach((s, i) => {
        setTimeout(() => this.tono({
          hz: semitonos(raiz, s + 12), tipo: 'sine', duracion: 0.14, volumen: 0.16,
        }), 40 + i * 45);
      });
    }
    this.pulso(lineas >= 3 ? [18, 30, 45] : lineas * 16);
  }

  /** Perder la racha suena: un tono que se cae. */
  comboCortado() {
    this.tono({ hz: 220, tipo: 'triangle', duracion: 0.26, volumen: 0.22, desliz: -120 });
    this.subGrave({ desde: 90, hasta: 38, duracion: 0.18, volumen: 0.3 });
    this.pulso(22);
  }

  jefeEntra() {
    this.tono({ hz: 70, tipo: 'sawtooth', duracion: 0.55, volumen: 0.42, desliz: -28 });
    this.tono({ hz: 104, tipo: 'triangle', duracion: 0.4, volumen: 0.25 });
    this.ruido({ duracion: 0.5, volumen: 0.2, corte: 300, q: 0.7 });
    this.pulso([40, 60, 90]);
  }

  jefeVencido() {
    [0, 4, 7, 12].forEach((s, i) => {
      setTimeout(() => this.tono({
        hz: semitonos(BASE, s + 5), tipo: 'triangle', duracion: 0.22, volumen: 0.3,
      }), i * 70);
    });
    this.pulso([25, 40, 25, 60]);
  }

  subirNivel() {
    [0, 5, 9].forEach((s, i) => {
      setTimeout(() => this.tono({
        hz: semitonos(BASE, s + 12), tipo: 'sine', duracion: 0.18, volumen: 0.26,
      }), i * 60);
    });
    this.pulso(30);
  }

  poder() {
    this.tono({ hz: 620, tipo: 'square', duracion: 0.1, volumen: 0.22, desliz: -380 });
    this.ruido({ duracion: 0.22, volumen: 0.32, corte: 2200 });
    this.pulso(35);
  }

  basura() {
    this.tono({ hz: 120, tipo: 'square', duracion: 0.1, volumen: 0.2, desliz: -50 });
    this.pulso(18);
  }

  rechazo() {
    this.tono({ hz: 140, tipo: 'square', duracion: 0.07, volumen: 0.18 });
    this.pulso(8);
  }

  /** Tablero limpio: la fanfarria mas larga del juego. Se la gana. */
  tableroLimpio() {
    [0, 4, 7, 12, 16, 19].forEach((s, i) => {
      setTimeout(() => this.tono({
        hz: semitonos(BASE, s), tipo: 'triangle', duracion: 0.3, volumen: 0.32,
      }), i * 85);
    });
    setTimeout(() => this.ruido({ duracion: 0.6, volumen: 0.24, corte: 2600 }), 120);
    this.pulso([30, 50, 30, 50, 80]);
  }

  finDelJuego() {
    [0, -3, -7, -12].forEach((s, i) => {
      setTimeout(() => this.tono({
        hz: semitonos(BASE, s), tipo: 'triangle', duracion: 0.4, volumen: 0.3,
      }), i * 130);
    });
    this.pulso([60, 80, 120]);
  }
}
