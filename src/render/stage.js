// El tablero dibujado con PixiJS: celdas, bloques, vista previa y la explosion.

import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { LADO, coordenadas, indice, BLOQUEADA } from '../engine/board.js';
import { TEMA, PALETA, NOMBRES_COLOR, COLORES_PIEZA, BASURA, oklchAHex, intensidad, CURVAS } from './theme.js';
import { Explosiones, Temblor, Destello } from './effects.js';
import { TEMAS, paletaDe } from './temas.js';

const RADIO = 0.22;   // esquinas, como fraccion del lado del bloque
const HUECO = 0.085;  // separacion entre celdas

// La celda VACIA va casi recta, independiente del tema: es fondo, no pieza.
const RADIO_CELDA_VACIA = 0.06;

export class Escenario {
  constructor(contenedor, { reducido = false, tema = TEMAS[0] } = {}) {
    this.contenedor = contenedor;
    this.reducido = reducido;
    this.app = new Application();
    this.texturas = new Map();
    this.bloques = new Map();      // indice de celda -> Sprite
    this.animaciones = [];
    this.jefeActivo = null;
    this.pulso = 0;
    this.tema = tema;
    this.paleta = paletaDe(tema).pixi;
  }

  /**
   * Cambia el tema en caliente: nueva paleta, texturas nuevas y fondo nuevo.
   * Los bloques que ya estan en el tablero se repintan con el color del tema
   * que les toca, asi la partida no queda mezclando dos estilos.
   */
  aplicarTema(tema) {
    this.tema = tema;
    this.paleta = paletaDe(tema).pixi;
    for (const t of this.texturas.values()) t.destroy(true);
    this.texturas.clear();
    this.texturaSellada?.destroy(true);
    this.generarTexturas();
    this.dibujarFondo();
    for (const [i, s] of this.bloques) {
      s.texture = this.texturaDe(s.__color);
    }
  }

  async iniciar() {
    const lado = this.medirLado();
    await this.app.init({
      width: lado,
      height: lado,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl',
    });
    this.contenedor.appendChild(this.app.canvas);

    this.mundo = new Container();
    this.capaFondo = new Container();
    this.capaBloques = new Container();
    this.capaPreview = new Container();
    this.mundo.addChild(this.capaFondo, this.capaBloques, this.capaPreview);

    this.efectos = new Explosiones(this.app, { reducido: this.reducido });
    this.destello = new Destello(this.app);
    this.app.stage.addChild(this.mundo, this.efectos.capa, this.destello.capa);

    this.temblor = new Temblor(this.mundo);
    this.calcularMedidas();
    this.generarTexturas();
    this.dibujarFondo();

    this.app.ticker.add((tick) => this.actualizar(tick.deltaMS / 1000));
    window.addEventListener('resize', () => this.redimensionar());
    return this;
  }

  medirLado() {
    const ancho = this.contenedor.clientWidth || 340;
    // Se deja aire para que el tablero no toque los bordes de la pantalla en
    // pantallas altas; el limite de 520 evita un tablero gigante en tablet.
    return Math.max(280, Math.min(ancho, 520));
  }

  calcularMedidas() {
    const total = this.app.screen.width;
    this.celda = total / LADO;
    this.hueco = this.celda * HUECO;
    this.bloque = this.celda - this.hueco;
    this.pisoY = total + this.celda; // las particulas rebotan un poco abajo del tablero
  }

  posicion(i) {
    const { fila, columna } = coordenadas(i);
    return {
      x: columna * this.celda + this.celda / 2,
      y: fila * this.celda + this.celda / 2,
    };
  }

  /**
   * Una textura por color, con el brillo interno ya dibujado. No se usa `tint`
   * sobre una textura blanca porque el tinte multiplica, y eso apagaria el
   * brillo superior en vez de dejarlo claro.
   */
  generarTexturas() {
    const lado = Math.ceil(this.bloque * 2); // al doble, para que no pixele al escalar
    const r = lado * (this.tema?.bloque?.radio ?? RADIO);

    const construir = (hex, hexClaro, hexOscuro) => {
      const g = new Graphics();
      g.roundRect(0, lado * 0.08, lado, lado * 0.92, r).fill(hexOscuro);     // sombra corta
      g.roundRect(0, 0, lado, lado * 0.92, r).fill(hex);                      // cuerpo
      g.roundRect(lado * 0.12, lado * 0.08, lado * 0.76, lado * 0.3, r * 0.7)
        .fill({ color: hexClaro, alpha: 0.55 });                              // luz de arriba
      const t = this.app.renderer.generateTexture(g);
      g.destroy();
      return t;
    };

    // Las texturas se indexan por NOMBRE de color, igual que las guarda el motor.
    for (const nombre of NOMBRES_COLOR) {
      const c = this.tema.piezas[nombre] ?? COLORES_PIEZA[nombre];
      const b = this.tema.bloque;
      this.texturas.set(
        nombre,
        construir(
          this.paleta[nombre],
          oklchAHex(Math.min(0.98, c.L + 0.16 * (b.brillo / 0.6)), c.C * 0.7, c.H),
          oklchAHex(Math.max(0.05, c.L - 0.24 * (b.sombra / 0.26)), c.C * 0.85, c.H)
        )
      );
    }

    // Basura del jefe Basurero: gris tintado, sin brillo vivo, para que se lea
    // como estorbo y no como una pieza mas.
    this.texturas.set(
      BASURA,
      construir(oklchAHex(0.48, 0.02, 265), oklchAHex(0.6, 0.015, 265), oklchAHex(0.3, 0.02, 265))
    );
    this.texturaSellada = (() => {
      const g = new Graphics();
      g.roundRect(0, 0, lado, lado, r).fill(TEMA.sellada);
      g.roundRect(lado * 0.1, lado * 0.1, lado * 0.8, lado * 0.8, r * 0.6)
        .stroke({ width: lado * 0.06, color: TEMA.bordeVivo, alpha: 0.9 });
      const t = this.app.renderer.generateTexture(g);
      g.destroy();
      return t;
    })();
  }

  texturaDe(color) {
    if (color === BLOQUEADA) return this.texturaSellada;
    return this.texturas.get(color) ?? this.texturas.get(BASURA);
  }

  /** Color de particula para un nombre de color del motor. */
  pixelDe(color) {
    if (color === BLOQUEADA) return TEMA.bordeVivo;
    return this.paleta[color] ?? PALETA[color] ?? TEMA.tintaSuave;
  }

  /**
   * Las celdas vacias van casi rectas y mas apagadas que los bloques.
   *
   * Con el mismo redondeo que las piezas, la cuadricula vacia se lee como un
   * monton de cuadritos grises sueltos compitiendo por atencion — Bryan lo
   * describio exacto. Rectas y tenues, la cuadricula desaparece y lo unico que
   * se ve son las piezas, que es lo que importa.
   */
  dibujarFondo() {
    this.capaFondo.removeChildren();
    const g = new Graphics();
    const radio = this.bloque * RADIO_CELDA_VACIA;
    for (let i = 0; i < LADO * LADO; i++) {
      const { x, y } = this.posicion(i);
      g.roundRect(x - this.bloque / 2, y - this.bloque / 2, this.bloque, this.bloque, radio)
        .fill(this.tema?.fondo?.celda ?? TEMA.celda);
    }
    this.capaFondo.addChild(g);
  }

  /** Sincroniza los sprites con el tablero del motor. */
  pintarTablero(tablero, { animarNuevas = [] } = {}) {
    for (let i = 0; i < tablero.length; i++) {
      const color = tablero[i];
      const existente = this.bloques.get(i);

      if (color === null) {
        if (existente) {
          this.capaBloques.removeChild(existente);
          existente.destroy();
          this.bloques.delete(i);
        }
        continue;
      }

      if (existente && existente.__color === color) continue;
      if (existente) {
        this.capaBloques.removeChild(existente);
        existente.destroy();
      }

      const s = new Sprite(this.texturaDe(color));
      s.anchor.set(0.5);
      s.width = this.bloque;
      s.height = this.bloque;
      s.__color = color;
      const { x, y } = this.posicion(i);
      s.x = x;
      s.y = y;
      this.capaBloques.addChild(s);
      this.bloques.set(i, s);

      if (animarNuevas.includes(i)) this.animarAsentado(s);
    }
  }

  /** La pieza se asienta: entra a 1.15 y baja a 1. No aparece de golpe. */
  animarAsentado(sprite) {
    const base = this.bloque;
    this.animaciones.push({
      t: 0,
      ms: 180,
      paso: (p) => {
        const e = CURVAS.salidaFirme(p);
        const escala = 1.15 - 0.15 * e;
        sprite.width = base * escala;
        sprite.height = base * escala;
      },
      fin: () => {
        sprite.width = base;
        sprite.height = base;
      },
    });
  }

  /**
   * Marca dónde caería la pieza y qué líneas se limpiarían. `color` es un
   * nombre. `choques` son las celdas ocupadas que impiden la jugada: se pintan
   * mas fuerte para que se vea DONDE esta el estorbo, no solo que existe.
   */
  pintarPreview({ celdas = [], choques = [], lineas = null, valido = true, color = 'cyan' }) {
    // Se guarda y lo dibuja el ticker: las lineas que se van a romper LATEN, y
    // para eso hay que repintarlas cada cuadro.
    this.preview = { celdas, choques, lineas, valido, pixel: this.pixelDe(color) };
    if (celdas.length === 0 && !lineas) this.preview = null;
    this.dibujarPreview();
  }

  dibujarPreview() {
    this.capaPreview.removeChildren();
    if (!this.preview) return;
    const { celdas, choques, lineas, valido, pixel } = this.preview;
    const g = new Graphics();
    const ROJO = 0xff4d6d;
    const radio = this.tema?.bloque?.radio ?? RADIO;

    // LAS LINEAS QUE SE VAN A ROMPER.
    //
    // Antes esto iba con alpha 0.22, que sobre un fondo oscuro es practicamente
    // invisible: la informacion mas importante del juego — "si soltas aca,
    // rompes" — estaba ahi y no se veia. Ahora late entre 0.42 y 0.72, lleva
    // borde brillante y las celdas crecen un poco. Tiene que gritar.
    if (lineas?.celdas?.length) {
      const tono = this.jefeActivo?.color ?? PALETA.ambar;
      const pulso = 0.42 + Math.sin(this.tiempoPreview * 6.5) * 0.15 + 0.15;
      const crece = 1 + Math.sin(this.tiempoPreview * 6.5) * 0.035;
      for (const c of lineas.celdas) {
        const { x, y } = this.posicion(c);
        const lado = this.celda * crece;
        g.roundRect(x - lado / 2, y - lado / 2, lado, lado, lado * radio)
          .fill({ color: tono, alpha: pulso })
          .stroke({ width: 2.5, color: tono, alpha: 0.95 });
      }
    }

    for (const c of celdas) {
      const { x, y } = this.posicion(c);
      const lado = this.bloque * 1.06;
      const choca = choques.includes(c);
      const tono = valido ? pixel : ROJO;
      g.roundRect(x - lado / 2, y - lado / 2, lado, lado, lado * radio)
        .fill({ color: tono, alpha: valido ? 0.55 : (choca ? 0.55 : 0.22) })
        .stroke({ width: choca ? 3 : 2.5, color: tono, alpha: choca ? 1 : 0.95 });
    }
    this.capaPreview.addChild(g);
  }

  limpiarPreview() {
    this.preview = null;
    this.capaPreview.removeChildren();
  }

  /**
   * El momento importante: las celdas revientan. Cuantas mas lineas, mas
   * pedazos, mas temblor y mas destello — todo escala junto.
   */
  reventarCeldas(celdas, tablero, cantidadLineas) {
    const fuerza = intensidad(cantidadLineas);
    for (const c of celdas) {
      const { x, y } = this.posicion(c);
      const color = tablero[c];
      const sprite = this.bloques.get(c);
      if (sprite) {
        this.capaBloques.removeChild(sprite);
        sprite.destroy();
        this.bloques.delete(c);
      }
      this.efectos.reventar(
        x, y, this.bloque,
        this.pixelDe(color),
        fuerza.particulas,
        this.pisoY
      );
    }
    if (!this.reducido) {
      this.temblor.golpear(fuerza.temblor, fuerza.msTemblor);
      this.destello.disparar(fuerza.destello);
    }
    return fuerza;
  }

  marcarJefe(jefe) {
    this.jefeActivo = jefe;
  }

  actualizar(dt) {
    this.efectos.actualizar(dt);
    this.temblor.actualizar(dt);
    this.destello.actualizar(dt);

    // Las lineas a punto de romperse laten. Solo se repinta si hay algo que
    // late: repintar una vista previa quieta en cada cuadro es tirar trabajo.
    this.tiempoPreview = (this.tiempoPreview ?? 0) + dt;
    if (this.preview?.lineas?.celdas?.length) this.dibujarPreview();

    for (let i = this.animaciones.length - 1; i >= 0; i--) {
      const a = this.animaciones[i];
      a.t += dt * 1000;
      const p = Math.min(1, a.t / a.ms);
      a.paso(p);
      if (p >= 1) {
        a.fin?.();
        this.animaciones.splice(i, 1);
      }
    }

    // Latido del borde mientras hay jefe
    if (this.jefeActivo) {
      this.pulso += dt;
      const v = 0.5 + Math.sin(this.pulso * Math.PI) * 0.5;
      this.capaFondo.alpha = 0.75 + v * 0.25;
    } else {
      this.capaFondo.alpha = 1;
      this.pulso = 0;
    }
  }

  redimensionar() {
    const lado = this.medirLado();
    if (Math.abs(lado - this.app.screen.width) < 2) return;
    this.app.renderer.resize(lado, lado);
    this.calcularMedidas();
    this.temblor.recentrar(0, 0);
    this.destello.redibujar();
    for (const t of this.texturas.values()) t.destroy(true);
    this.texturas.clear();
    this.texturaSellada?.destroy(true);
    this.generarTexturas();
    this.dibujarFondo();
    for (const [i, s] of this.bloques) {
      const { x, y } = this.posicion(i);
      s.texture = this.texturaDe(s.__color);
      s.x = x;
      s.y = y;
      s.width = this.bloque;
      s.height = this.bloque;
    }
  }

  /** Traduce un toque en pantalla al indice de celda. */
  celdaEn(clientX, clientY) {
    const r = this.app.canvas.getBoundingClientRect();
    const col = Math.floor(((clientX - r.left) / r.width) * LADO);
    const fila = Math.floor(((clientY - r.top) / r.height) * LADO);
    if (col < 0 || col >= LADO || fila < 0 || fila >= LADO) return null;
    return indice(fila, col);
  }

  /**
   * ¿El punto cae dentro del tablero?
   *
   * `margen` ensancha el area hacia AFUERA, nunca hacia adentro. Un margen
   * negativo (o sumarle pixeles a la coordenada antes de preguntar) crea una
   * franja muerta en el borde donde el dedo ya esta sobre el tablero pero el
   * codigo cree que no, y ahi el preview desaparece justo cuando mas se
   * necesita: al entrar desde la bandeja, que esta pegada abajo.
   */
  dentro(clientX, clientY, margen = 0) {
    const r = this.app.canvas.getBoundingClientRect();
    return clientX >= r.left - margen && clientX <= r.right + margen
        && clientY >= r.top - margen && clientY <= r.bottom + margen;
  }

  centroDe(i) {
    const r = this.app.canvas.getBoundingClientRect();
    const { x, y } = this.posicion(i);
    const escala = r.width / this.app.screen.width;
    return { x: r.left + x * escala, y: r.top + y * escala };
  }

  /**
   * Lado de una celda medido en pixeles de PANTALLA, no del lienzo interno.
   * La pieza que sigue el dedo vive en HTML, y ahi solo existen los de pantalla:
   * usar los del lienzo la dibuja de otro tamaño que el tablero.
   */
  ladoCeldaEnPantalla() {
    return this.app.canvas.getBoundingClientRect().width / LADO;
  }
}
