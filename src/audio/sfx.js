// Sonido generado por codigo. Cero archivos que descargar.
//
// Dos cosas de iOS que hay que respetar o no suena nada:
//  1. El contexto de audio arranca suspendido hasta que el usuario toca la
//     pantalla. Por eso `despertar()` se llama en el primer toque, no al cargar.
//  2. El interruptor de silencio del iPhone silencia la categoria por defecto.
//     No hay forma de saltarlo desde la web, y por eso la vibracion va aparte:
//     con el telefono en silencio, la vibracion es todo el feedback que queda.

const BASE = 320; // Hz, la nota de la que cuelga todo lo demas

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

  pulso(ms) {
    if (this.vibrar && navigator.vibrate) navigator.vibrate(ms);
  }

  // --- Los sonidos del juego ---

  colocar() {
    this.tono({ hz: 180, tipo: 'triangle', duracion: 0.07, volumen: 0.32, desliz: -60 });
    this.pulso(12);
  }

  /**
   * El sonido central. Sube `n` semitonos segun cuantas lineas se limpiaron, y
   * arriba de dos agrega una quinta: cuatro lineas tienen que sonar a acorde,
   * no al mismo pitido mas agudo.
   */
  limpiar(lineas, semis) {
    const raiz = semitonos(BASE, semis);
    this.ruido({ duracion: 0.13 + lineas * 0.02, volumen: 0.3, corte: 900 + lineas * 500 });
    this.tono({ hz: raiz, tipo: 'triangle', duracion: 0.17 + lineas * 0.04, volumen: 0.4 });
    this.tono({ hz: semitonos(raiz, 7), tipo: 'sine', duracion: 0.2 + lineas * 0.05, volumen: 0.24 });
    if (lineas >= 3) {
      this.tono({ hz: semitonos(raiz, 12), tipo: 'sine', duracion: 0.3, volumen: 0.2 });
    }
    if (lineas >= 4) {
      this.tono({ hz: semitonos(raiz, 16), tipo: 'sine', duracion: 0.42, volumen: 0.18 });
    }
    this.pulso(lineas >= 3 ? [18, 30, 45] : lineas * 16);
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

  finDelJuego() {
    [0, -3, -7, -12].forEach((s, i) => {
      setTimeout(() => this.tono({
        hz: semitonos(BASE, s), tipo: 'triangle', duracion: 0.4, volumen: 0.3,
      }), i * 130);
    });
    this.pulso([60, 80, 120]);
  }
}
