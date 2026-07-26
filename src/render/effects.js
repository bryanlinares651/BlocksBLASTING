// Explosiones, temblor y destellos. Todo lo que hace que limpiar una fila se
// sienta en la mano y no solo se vea.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TEMA, CURVAS } from './theme.js';

const GRAVEDAD = 2100;      // px/s2
const REBOTE = 0.42;
const ROCE = 0.86;

/**
 * Fabrica de particulas. Todas comparten una sola textura para que la placa de
 * video las dibuje de una pasada; con una textura por particula, 300 en pantalla
 * arrancan a tironear.
 */
export class Explosiones {
  constructor(app, { reducido = false } = {}) {
    this.app = app;
    this.reducido = reducido;
    this.capa = new Container();
    this.particulas = [];
    this.libres = [];

    const g = new Graphics().roundRect(0, 0, 8, 8, 2).fill(0xffffff);
    this.textura = app.renderer.generateTexture(g);
    g.destroy();
  }

  /** Reusa sprites en vez de crear y destruir: el recolector de basura es lo que produce los tirones. */
  tomarSprite() {
    const s = this.libres.pop();
    if (s) {
      s.visible = true;
      return s;
    }
    const nuevo = new Sprite(this.textura);
    nuevo.anchor.set(0.5);
    this.capa.addChild(nuevo);
    return nuevo;
  }

  soltarSprite(s) {
    s.visible = false;
    this.libres.push(s);
  }

  /**
   * Revienta un bloque en `cantidad` pedazos que salen despedidos, caen con
   * gravedad, rebotan una vez contra el piso del tablero y se apagan.
   */
  reventar(x, y, lado, color, cantidad, pisoY) {
    const n = this.reducido ? Math.max(3, Math.round(cantidad / 4)) : cantidad;
    for (let i = 0; i < n; i++) {
      const s = this.tomarSprite();
      const escala = (lado / 8) * (0.18 + Math.random() * 0.34);
      s.tint = color;
      s.alpha = 1;
      s.scale.set(escala);
      s.x = x + (Math.random() - 0.5) * lado * 0.8;
      s.y = y + (Math.random() - 0.5) * lado * 0.8;
      s.rotation = Math.random() * Math.PI;

      // Reparto radial con un sesgo hacia arriba: si salen en todas
      // direcciones por igual, la explosion se ve como una mancha.
      const angulo = Math.random() * Math.PI * 2;
      const fuerza = 160 + Math.random() * 420;
      this.particulas.push({
        s,
        vx: Math.cos(angulo) * fuerza,
        vy: Math.sin(angulo) * fuerza - 260,
        giro: (Math.random() - 0.5) * 14,
        vida: 0,
        vidaMax: 0.55 + Math.random() * 0.4,
        escala,
        pisoY,
        reboto: false,
      });
    }
  }

  actualizar(dt) {
    for (let i = this.particulas.length - 1; i >= 0; i--) {
      const p = this.particulas[i];
      p.vida += dt;
      if (p.vida >= p.vidaMax) {
        this.soltarSprite(p.s);
        this.particulas.splice(i, 1);
        continue;
      }
      p.vy += GRAVEDAD * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.giro * dt;

      if (p.pisoY !== undefined && p.s.y > p.pisoY && !p.reboto) {
        p.s.y = p.pisoY;
        p.vy = -p.vy * REBOTE;
        p.vx *= ROCE;
        p.reboto = true;
      }

      const t = p.vida / p.vidaMax;
      p.s.alpha = 1 - CURVAS.salidaFirme(t);
      p.s.scale.set(p.escala * (1 - t * 0.35));
    }
  }

  get activas() {
    return this.particulas.length;
  }

  limpiar() {
    for (const p of this.particulas) this.soltarSprite(p.s);
    this.particulas.length = 0;
  }
}

/**
 * Temblor de pantalla. Decae exponencialmente y alterna de lado: un temblor con
 * ruido puro se ve como vibracion barata; alternado se siente como un golpe.
 */
export class Temblor {
  constructor(objetivo) {
    this.objetivo = objetivo;
    this.tiempo = 0;
    this.duracion = 0;
    this.fuerza = 0;
    this.baseX = objetivo.x;
    this.baseY = objetivo.y;
  }

  golpear(fuerza, ms) {
    // Un golpe nuevo no reinicia uno mas fuerte a mitad de camino.
    if (fuerza < this.fuerza && this.tiempo < this.duracion) return;
    this.fuerza = fuerza;
    this.duracion = ms / 1000;
    this.tiempo = 0;
  }

  actualizar(dt) {
    if (this.tiempo >= this.duracion) {
      this.objetivo.x = this.baseX;
      this.objetivo.y = this.baseY;
      return;
    }
    this.tiempo += dt;
    const t = Math.min(1, this.tiempo / this.duracion);
    const caida = Math.pow(1 - t, 2.2);
    const fase = t * Math.PI * 14;
    this.objetivo.x = this.baseX + Math.sin(fase) * this.fuerza * caida;
    this.objetivo.y = this.baseY + Math.cos(fase * 0.7) * this.fuerza * caida * 0.6;
  }

  recentrar(x, y) {
    this.baseX = x;
    this.baseY = y;
  }
}

/** Destello blanco a pantalla completa. Sube instantaneo y baja lento. */
export class Destello {
  constructor(app) {
    this.app = app;
    this.capa = new Graphics();
    this.alpha = 0;
    this.objetivo = 0;
    this.redibujar();
  }

  redibujar() {
    const { width, height } = this.app.screen;
    this.capa.clear().rect(0, 0, width, height).fill(0xffffff);
    this.capa.alpha = 0;
  }

  disparar(intensidad) {
    this.alpha = Math.min(0.5, intensidad * 0.42);
    this.capa.alpha = this.alpha;
  }

  actualizar(dt) {
    if (this.capa.alpha <= 0.001) {
      this.capa.alpha = 0;
      return;
    }
    this.capa.alpha = Math.max(0, this.capa.alpha - dt * 2.6);
  }
}

/**
 * Numeros que suben y se desvanecen sobre el tablero ("+1120"). Se hacen con
 * HTML y no con PixiJS a proposito: el texto en canvas obliga a generar una
 * textura por cada numero distinto, y eso es caro para algo que se lee mejor
 * con la tipografia del sistema.
 */
export function flotarPuntos(contenedor, texto, x, y, color = '#ffffff') {
  const el = document.createElement('div');
  el.className = 'puntos-flotantes';
  el.textContent = texto;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color;
  contenedor.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}
