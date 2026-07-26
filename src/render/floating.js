// La pieza que sigue el dedo mientras la arrastras.
//
// Por que existe: sin esto, arrastrar se siente "de teclado". El unico dibujo
// que se movia era el resaltado dentro de la cuadricula, y eso salta de celda
// en celda: el dedo recorre 40 pixeles y en pantalla no cambia nada, hasta que
// de golpe brinca. Aca la pieza se mueve pixel a pixel con el dedo y el ajuste
// a la cuadricula queda solo para la sombra de destino.
//
// Va en HTML y no en el canvas de PixiJS por dos razones: el canvas cubre solo
// el tablero (la pieza tiene que poder verse tambien sobre la bandeja, que esta
// afuera), y `transform` lo compone la placa de video sin repintar nada.

// Mas alto = mas pegado al dedo. En 26 todavia se sentia un pelin de arrastre;
// en 38 la pieza va practicamente bajo el dedo pero conserva el suavizado que
// evita que se vea a saltos cuando el dedo se mueve rapido.
const SEGUIMIENTO = 38;

export class PiezaFlotante {
  constructor(contenedor) {
    this.el = document.createElement('div');
    this.el.className = 'pieza-flotante';
    this.el.setAttribute('aria-hidden', 'true');
    contenedor.appendChild(this.el);

    this.activa = false;
    this.x = 0; this.y = 0;          // posicion dibujada
    this.destinoX = 0; this.destinoY = 0;  // donde esta el dedo
    this.escala = 1;
    this.destinoEscala = 1;
    this.inclinacion = 0;
    this.ultimoX = 0;
    this.animando = false;
  }

  /** Dibuja los bloques de la pieza, a la medida real del tablero. */
  tomar(pieza, ladoBloque, colorCss, x, y) {
    const xs = pieza.forma.map((p) => p[0]);
    const ys = pieza.forma.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const ancho = maxX - minX + 1;
    const alto = maxY - minY + 1;

    this.el.replaceChildren();
    this.el.style.setProperty('--lado', `${ladoBloque}px`);
    this.el.style.width = `${ancho * ladoBloque}px`;
    this.el.style.height = `${alto * ladoBloque}px`;

    for (const [px, py] of pieza.forma) {
      const b = document.createElement('i');
      b.style.left = `${(px - minX) * ladoBloque}px`;
      b.style.top = `${(py - minY) * ladoBloque}px`;
      b.style.setProperty('--c', colorCss);
      this.el.appendChild(b);
    }

    // Aparece ya bajo el dedo, sin viajar desde la bandeja: si interpolara
    // desde la posicion vieja, la pieza "volaria" al agarrarla.
    this.x = this.destinoX = x;
    this.y = this.destinoY = y;
    this.ultimoX = x;
    this.escala = 0.72;          // crece al levantarla: se siente que la agarras
    this.destinoEscala = 1.06;
    this.activa = true;
    this.el.dataset.viva = '1';
    this.pintar();
    this.arrancar();
  }

  mover(x, y) {
    this.destinoX = x;
    this.destinoY = y;
  }

  soltar() {
    this.activa = false;
    this.destinoEscala = 0.7;
    this.el.dataset.viva = '0';
    // El elemento se apaga con la transicion del CSS; el bucle se corta solo.
  }

  arrancar() {
    if (this.animando) return;
    this.animando = true;
    let previo = performance.now();
    const paso = (ahora) => {
      const dt = Math.min(0.05, (ahora - previo) / 1000);
      previo = ahora;
      this.actualizar(dt);
      if (this.activa || Math.abs(this.escala - this.destinoEscala) > 0.01) {
        requestAnimationFrame(paso);
      } else {
        this.animando = false;
      }
    };
    requestAnimationFrame(paso);
  }

  actualizar(dt) {
    // Suavizado exponencial: independiente de los cuadros por segundo, asi se
    // siente igual en un telefono de 60 Hz que en uno de 120.
    const k = 1 - Math.exp(-SEGUIMIENTO * dt);
    this.x += (this.destinoX - this.x) * k;
    this.y += (this.destinoY - this.y) * k;
    this.escala += (this.destinoEscala - this.escala) * (1 - Math.exp(-18 * dt));

    // Se inclina hacia donde va, como una carta arrastrada. Es el detalle que
    // convierte "se mueve" en "tiene peso".
    const velocidad = (this.x - this.ultimoX) / Math.max(dt, 0.001);
    this.ultimoX = this.x;
    const objetivoIncl = Math.max(-9, Math.min(9, velocidad * 0.012));
    this.inclinacion += (objetivoIncl - this.inclinacion) * (1 - Math.exp(-12 * dt));

    this.pintar();
  }

  pintar() {
    this.el.style.transform =
      `translate3d(${this.x}px, ${this.y}px, 0) translate(-50%, -50%) ` +
      `scale(${this.escala}) rotate(${this.inclinacion}deg)`;
  }

  redimensionar(ladoBloque) {
    this.el.style.setProperty('--lado', `${ladoBloque}px`);
  }
}
