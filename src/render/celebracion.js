// Los mensajes que salen en pantalla cuando hacés algo bien.
//
// Bryan lo describio exacto: "en Block Blast sale good, good job, combo, un
// monton de cosas". Eso no es decoracion — es el juego diciendote QUE hiciste y
// que estuvo bueno. Sin esto, limpiar cuatro lineas y limpiar una se sienten
// igual de anonimas aunque una valga cuatro veces mas.
//
// Reglas que sigue este sistema:
//  - Un mensaje por jugada, el mas alto que corresponda. Dos mensajes juntos se
//    tapan y no se lee ninguno.
//  - El texto crece con el logro: BIEN es chico, INCREIBLE ocupa media pantalla.
//  - Se van solos y rapido. Un mensaje que tarda es un mensaje que estorba.

const ESCALONES = [
  { desde: 4, texto: '¡INCREÍBLE!', clase: 'epica',   escala: 1.0 },
  { desde: 3, texto: '¡EXCELENTE!', clase: 'grande',  escala: 0.88 },
  { desde: 2, texto: '¡MUY BIEN!',  clase: 'media',   escala: 0.76 },
  { desde: 1, texto: '¡BIEN!',      clase: 'chica',   escala: 0.66 },
];

// Frases de racha. Se eligen por combo, no por lineas: son dos ejes distintos y
// premiar los dos con el mismo mensaje desperdicia la mitad del refuerzo.
const RACHAS = [
  { desde: 8, texto: 'IMPARABLE' },
  { desde: 6, texto: 'EN LLAMAS' },
  { desde: 4, texto: 'EN RACHA' },
  { desde: 2, texto: 'SEGUIDO' },
];

export class Celebracion {
  constructor(contenedor, { reducido = false } = {}) {
    this.contenedor = contenedor;
    this.reducido = reducido;
    this.capa = document.createElement('div');
    this.capa.className = 'celebracion';
    this.capa.setAttribute('aria-hidden', 'true');
    contenedor.appendChild(this.capa);
  }

  /** Mensaje principal por cantidad de lineas. */
  porLineas(cantidad) {
    const e = ESCALONES.find((x) => cantidad >= x.desde);
    if (e) this.mostrar(e.texto, { clase: e.clase, escala: e.escala });
  }

  /** Frase de racha, mas chica y debajo del mensaje principal. */
  porCombo(combo) {
    const r = RACHAS.find((x) => combo >= x.desde);
    if (r) this.mostrar(`${r.texto} ×${combo}`, { clase: 'racha', escala: 0.6, retraso: 130 });
  }

  /** Texto libre, para momentos con nombre propio. */
  mensaje(texto, clase = 'media') {
    this.mostrar(texto, { clase, escala: 0.8 });
  }

  mostrar(texto, { clase = 'media', escala = 1, retraso = 0 } = {}) {
    const pintar = () => {
      const el = document.createElement('div');
      el.className = `celebra ${clase}`;
      el.textContent = texto;
      el.style.setProperty('--escala', escala);

      // Cada letra entra por separado: es lo que hace que el texto se sienta
      // "lanzado" y no simplemente aparecido. Con movimiento reducido se
      // muestra entero, sin escalonar.
      if (!this.reducido) {
        el.replaceChildren();
        [...texto].forEach((letra, i) => {
          const span = document.createElement('span');
          span.textContent = letra === ' ' ? ' ' : letra;
          span.style.animationDelay = `${i * 22}ms`;
          el.appendChild(span);
        });
      }

      this.capa.appendChild(el);
      el.addEventListener('animationend', (ev) => {
        if (ev.target === el) el.remove();
      });
      // Red de seguridad: si la animacion no dispara su evento (pestaña en
      // segundo plano, por ejemplo), el nodo igual se limpia.
      setTimeout(() => el.remove(), 2200);
    };
    if (retraso) setTimeout(pintar, retraso);
    else pintar();
  }

  limpiar() {
    this.capa.replaceChildren();
  }
}
