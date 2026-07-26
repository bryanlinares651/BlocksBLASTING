// Une el motor, la pantalla y el sonido. Aca vive la interaccion.

import { nuevaPartida, jugar, usarPoder, comprar, previsualizar, xpNecesaria } from './engine/game.js';
import { LADO, coordenadas, indice, BLOQUEADA } from './engine/board.js';
import { Escenario } from './render/stage.js';
import { flotarPuntos } from './render/effects.js';
import { PALETA, PALETA_CSS, COLORES_JEFE, intensidad } from './render/theme.js';
import { Sonido } from './audio/sfx.js';

const $ = (id) => document.getElementById(id);
const GUARDADO = 'nova-blocks-v1';
const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const sonido = new Sonido();
let escenario;
let estado;
let apuntando = null;   // 'bomba' | 'rayo' cuando se esta eligiendo donde
let arrastre = null;    // { pieza, celda } mientras el dedo esta abajo

// ---------------------------------------------------------------- persistencia

function cargarGuardado() {
  try {
    const crudo = localStorage.getItem(GUARDADO);
    if (!crudo) return {};
    const d = JSON.parse(crudo);
    // Si el guardado esta corrupto o es de otra version, se arranca de cero en
    // vez de romper. El record va aparte para no perderlo nunca.
    return {
      mejor: Number.isFinite(d.mejor) ? d.mejor : 0,
      monedas: Number.isFinite(d.monedas) ? d.monedas : 120,
    };
  } catch {
    return {};
  }
}

function guardar() {
  try {
    localStorage.setItem(GUARDADO, JSON.stringify({
      mejor: estado.mejor,
      monedas: estado.monedas,
    }));
  } catch {
    // Modo privado de Safari puede negar el guardado. No es motivo para romper.
  }
}

// ---------------------------------------------------------------- interfaz

function aviso(texto) {
  const el = $('aviso');
  el.textContent = texto;
  el.dataset.visible = '1';
  clearTimeout(aviso.reloj);
  aviso.reloj = setTimeout(() => { el.dataset.visible = '0'; }, 1700);
}

function estadoTexto(texto, tono = '') {
  const el = $('estado');
  el.textContent = texto;
  if (tono) el.dataset.tono = tono; else delete el.dataset.tono;
}

/** Numero de PixiJS -> string CSS. Solo para los colores de jefe. */
function cssDeNumero(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/** Nombre de color del motor -> string CSS. */
function cssDeNombre(nombre) {
  return PALETA_CSS[nombre] ?? PALETA_CSS.cyan;
}

function pintarMarcadores() {
  $('puntaje').textContent = estado.puntaje.toLocaleString('es');
  $('monedas').textContent = estado.monedas;
  $('mejor').textContent = estado.mejor.toLocaleString('es');
  $('nivel').textContent = estado.nivel;
  const falta = xpNecesaria(estado.nivel);
  $('xp-texto').textContent = `${estado.xp} / ${falta}`;
  $('barra').style.width = `${Math.min(100, (estado.xp / falta) * 100)}%`;

  $('cuenta-bomba').textContent = estado.poderes.bomba;
  $('cuenta-rayo').textContent = estado.poderes.rayo;
  $('btn-bomba').disabled = estado.poderes.bomba === 0;
  $('btn-rayo').disabled = estado.poderes.rayo === 0;
}

function pintarJefe() {
  const banda = $('banda-jefe');
  if (!estado.jefe) {
    banda.hidden = true;
    escenario.marcarJefe(null);
    document.documentElement.style.removeProperty('--jefe');
    return;
  }
  const color = COLORES_JEFE[estado.jefe.id];
  document.documentElement.style.setProperty('--jefe', cssDeNumero(color));
  banda.hidden = false;
  $('jefe-nombre').textContent = estado.jefe.nombre;
  $('jefe-regla').textContent = estado.jefe.descripcion;
  $('jefe-turnos').textContent = `${estado.jefe.turnosRestantes} turnos`;
  escenario.marcarJefe({ ...estado.jefe, color });
}

function pintarBandeja() {
  const bandeja = $('bandeja');
  bandeja.replaceChildren();
  estado.piezas.forEach((pieza, i) => {
    const el = document.createElement('button');
    el.className = 'pieza';
    el.type = 'button';
    if (pieza.usada) el.dataset.usada = '1';
    if (estado.seleccionada === i) el.dataset.elegida = '1';
    el.setAttribute('aria-label', `Pieza de ${pieza.forma.length} bloques`);

    const xs = pieza.forma.map((p) => p[0]);
    const ys = pieza.forma.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const mini = document.createElement('div');
    mini.className = 'mini';
    mini.style.gridTemplateColumns = `repeat(${maxX - minX + 1}, auto)`;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const celda = document.createElement('span');
        if (pieza.forma.some(([a, b]) => a === x && b === y)) {
          celda.style.setProperty('--c', cssDeNombre(pieza.color));
        } else {
          celda.dataset.vacio = '1';
        }
        mini.appendChild(celda);
      }
    }
    el.appendChild(mini);
    engancharPieza(el, i);
    bandeja.appendChild(el);
  });
}

function pintarTodo({ animarNuevas = [] } = {}) {
  escenario.pintarTablero(estado.tablero, { animarNuevas });
  pintarMarcadores();
  pintarBandeja();
  pintarJefe();
}

// ---------------------------------------------------------------- sucesos

function anunciarJefe(suceso) {
  const capa = $('capa-jefe');
  document.documentElement.style.setProperty('--jefe', cssDeNumero(COLORES_JEFE[suceso.id]));
  $('anuncio-nombre').textContent = suceso.nombre;
  $('anuncio-regla').textContent = suceso.descripcion;
  capa.hidden = false;
  sonido.jefeEntra();
  setTimeout(() => { capa.hidden = true; }, reducido ? 700 : 1500);
}

/** Traduce lo que dice el motor en animacion y sonido. */
function procesar(sucesos, tableroAntes) {
  for (const s of sucesos) {
    switch (s.tipo) {
      case 'colocada':
        sonido.colocar();
        break;

      case 'lineas-limpiadas': {
        const fuerza = intensidad(s.cantidad);
        escenario.reventarCeldas(s.celdas, tableroAntes, s.cantidad);
        sonido.limpiar(s.cantidad, fuerza.semitonos);
        const centro = escenario.centroDe(s.celdas[Math.floor(s.celdas.length / 2)]);
        const puntos = s.cantidad * s.cantidad * 70;
        flotarPuntos($('flotantes'), `+${puntos.toLocaleString('es')}`, centro.x, centro.y,
                     PALETA_CSS.ambar);
        const cuantas = s.cantidad === 1 ? '1 línea' : `${s.cantidad} líneas`;
        estadoTexto(s.cantidad >= 3 ? `¡${cuantas}!` : `${cuantas} fuera`, 'bien');
        break;
      }

      case 'subio-nivel':
        sonido.subirNivel();
        aviso(`Nivel ${s.nivel} · +${s.monedas} monedas`);
        break;

      case 'jefe-entra':
        anunciarJefe(s);
        estadoTexto(s.nombre, 'malo');
        break;

      case 'jefe-vencido':
        sonido.jefeVencido();
        aviso(`${s.nombre} se fue`);
        estadoTexto('Tu turno');
        break;

      case 'basura-cae':
        sonido.basura();
        break;

      case 'poder-usado':
        sonido.poder();
        break;

      case 'fin-del-juego':
        sonido.finDelJuego();
        mostrarFin();
        break;

      case 'rechazado':
        sonido.rechazo();
        if (s.razon === 'no-cabe') aviso('Ahí no cabe');
        if (s.razon === 'sin-monedas') aviso('Te faltan monedas');
        break;
    }
  }
}

function mostrarFin() {
  $('fin-puntaje').textContent = estado.puntaje.toLocaleString('es');
  $('fin-mejor').textContent = estado.puntaje >= estado.mejor
    ? 'Tu mejor partida hasta ahora'
    : `Tu récord sigue en ${estado.mejor.toLocaleString('es')}`;
  const n = estado.jefesVencidos.length;
  $('fin-jefes').textContent = n === 0
    ? 'No llegaste a ningún jefe'
    : `Jefes aguantados: ${n}`;
  $('capa-fin').hidden = false;
  estadoTexto('Fin del juego', 'malo');
}

// ---------------------------------------------------------------- jugar

function aplicar(resultado, { animarEn = [] } = {}) {
  const antes = estado.tablero;
  estado = resultado.estado;
  procesar(resultado.sucesos, antes);
  pintarTodo({ animarNuevas: animarEn });
  guardar();
}

function colocar(indicePieza, celda) {
  const pieza = estado.piezas[indicePieza];
  if (!pieza) return;
  const destino = [];
  const { fila, columna } = coordenadas(celda);
  for (const [x, y] of pieza.forma) {
    const f = fila + y, c = columna + x;
    if (f >= 0 && f < LADO && c >= 0 && c < LADO) destino.push(indice(f, c));
  }
  aplicar(jugar(estado, indicePieza, celda), { animarEn: destino });
  escenario.limpiarPreview();
  if (!estado.terminada) estadoTexto(estado.jefe ? estado.jefe.nombre : 'Tu turno',
                                     estado.jefe ? 'malo' : '');
}

/**
 * Convierte la posicion del dedo en la celda donde va el ORIGEN de la pieza.
 *
 * Dos ajustes que hacen la diferencia en el telefono:
 *  - La pieza se dibuja ~1.4 celdas arriba del dedo, porque si no el dedo tapa
 *    justo lo que estas intentando ver.
 *  - Se centra horizontalmente respecto al dedo: agarras la pieza del medio,
 *    no de su esquina de arriba a la izquierda.
 */
function celdaObjetivo(pieza, clientX, clientY) {
  const r = escenario.app.canvas.getBoundingClientRect();
  const paso = r.width / LADO;
  const col = Math.floor((clientX - r.left) / paso);
  const fila = Math.floor((clientY - r.top - paso * 1.4) / paso);

  const xs = pieza.forma.map((p) => p[0]);
  const ancho = Math.max(...xs) - Math.min(...xs) + 1;
  const colOrigen = col - Math.floor((ancho - 1) / 2);

  const cf = Math.max(0, Math.min(LADO - 1, fila));
  const cc = Math.max(0, Math.min(LADO - 1, colOrigen));
  return indice(cf, cc);
}

function previsualizarEn(indicePieza, celda) {
  const p = previsualizar(estado, indicePieza, celda);
  const pieza = estado.piezas[indicePieza];
  escenario.pintarPreview({
    celdas: p.valido ? p.celdas : [celda],
    lineas: p.lineas,
    valido: p.valido,
    color: pieza ? pieza.color : 'cyan',
  });
  if (p.valido && p.lineas?.cantidad) {
    const n = p.lineas.cantidad;
    estadoTexto(n === 1 ? 'Se va 1 línea' : `Se van ${n} líneas`, 'bien');
  } else if (p.valido) {
    estadoTexto('Cabe acá');
  } else {
    estadoTexto('Ahí no cabe', 'malo');
  }
}

function engancharPieza(el, i) {
  el.addEventListener('pointerdown', (ev) => {
    if (estado.piezas[i]?.usada || estado.terminada) return;
    sonido.despertar();
    ev.preventDefault();
    apuntando = null;
    estado = { ...estado, seleccionada: i };
    arrastre = { pieza: i, celda: null };
    document.body.classList.add('arrastrando');
    el.setPointerCapture?.(ev.pointerId);
    pintarBandeja();
  });
}

// Cuanto puede salirse el dedo del tablero sin que se corte el preview. Hacia
// afuera es seguro: da holgura en los bordes sin crear zonas muertas adentro.
const HOLGURA = 70;

function moverArrastre(ev) {
  if (!arrastre) return;
  const pieza = estado.piezas[arrastre.pieza];
  if (!pieza) return;
  if (!escenario.dentro(ev.clientX, ev.clientY, HOLGURA)) {
    escenario.limpiarPreview();
    arrastre.celda = null;
    estadoTexto(estado.jefe ? estado.jefe.nombre : 'Tu turno', estado.jefe ? 'malo' : '');
    return;
  }
  const celda = celdaObjetivo(pieza, ev.clientX, ev.clientY);
  if (celda === arrastre.celda) return;
  arrastre.celda = celda;
  previsualizarEn(arrastre.pieza, celda);
}

function soltarArrastre() {
  if (!arrastre) return;
  const { pieza, celda } = arrastre;
  arrastre = null;
  document.body.classList.remove('arrastrando');
  if (celda === null) {
    escenario.limpiarPreview();
    return;
  }
  const p = previsualizar(estado, pieza, celda);
  if (p.valido) {
    colocar(pieza, celda);
  } else {
    sonido.rechazo();
    aviso('Ahí no cabe');
    escenario.limpiarPreview();
    estadoTexto(estado.jefe ? estado.jefe.nombre : 'Tu turno', estado.jefe ? 'malo' : '');
  }
}

// ---------------------------------------------------------------- arranque

async function iniciar() {
  const guardado = cargarGuardado();
  estado = nuevaPartida({ monedas: guardado.monedas ?? 120, mejor: guardado.mejor ?? 0 });

  escenario = await new Escenario($('tablero'), { reducido }).iniciar();
  pintarTodo();

  const lienzo = escenario.app.canvas;

  // Tocar el tablero: coloca la pieza elegida, o dispara el poder si estas apuntando.
  lienzo.addEventListener('pointerdown', (ev) => {
    sonido.despertar();
    if (estado.terminada) return;
    const celda = escenario.celdaEn(ev.clientX, ev.clientY);
    if (celda === null) return;

    if (apuntando) {
      const tipo = apuntando;
      apuntando = null;
      document.querySelectorAll('.poder').forEach((b) => delete b.dataset.apuntando);
      const antes = estado.tablero;
      const r = usarPoder(estado, tipo, celda);
      const celdas = r.sucesos.find((s) => s.tipo === 'poder-usado')?.celdas ?? [];
      estado = r.estado;
      if (celdas.length) escenario.reventarCeldas(celdas, antes, 1);
      procesar(r.sucesos.filter((s) => s.tipo !== 'poder-usado' || true), antes);
      pintarTodo();
      guardar();
      return;
    }

    // Con una pieza ya elegida, tocar el tablero NO coloca de una: empieza a
    // apuntar. Ves el preview mientras tengas el dedo abajo, lo corres si no te
    // gusta, y recien al soltar se coloca. Colocar en el pointerdown hacia que
    // la pieza cayera antes de que pudieras ver donde iba a caer.
    if (estado.seleccionada !== null && !arrastre) {
      arrastre = { pieza: estado.seleccionada, celda: null };
      document.body.classList.add('arrastrando');
      moverArrastre(ev);
    }
  });

  document.addEventListener('pointermove', moverArrastre, { passive: true });
  document.addEventListener('pointerup', soltarArrastre);
  document.addEventListener('pointercancel', soltarArrastre);

  // Poderes: primero se elige el poder, despues DONDE. El prototipo explotaba
  // siempre en la esquina de arriba a la izquierda.
  for (const [id, tipo] of [['btn-bomba', 'bomba'], ['btn-rayo', 'rayo']]) {
    $(id).addEventListener('click', () => {
      sonido.despertar();
      if (!estado.poderes[tipo]) return;
      apuntando = apuntando === tipo ? null : tipo;
      document.querySelectorAll('.poder').forEach((b) => delete b.dataset.apuntando);
      if (apuntando) {
        $(id).dataset.apuntando = '1';
        aviso(tipo === 'bomba' ? 'Tocá dónde explota' : 'Tocá qué fila limpiar');
        estadoTexto('Elegí el objetivo', 'bien');
      } else {
        estadoTexto('Tu turno');
      }
    });
  }

  $('btn-tienda').addEventListener('click', () => { $('capa-tienda').hidden = false; });
  $('cerrar-tienda').addEventListener('click', () => { $('capa-tienda').hidden = true; });
  $('capa-tienda').addEventListener('click', (ev) => {
    if (ev.target.id === 'capa-tienda') $('capa-tienda').hidden = true;
  });

  document.querySelectorAll('[data-comprar]').forEach((b) => {
    b.addEventListener('click', () => {
      sonido.despertar();
      const r = comprar(estado, b.dataset.comprar);
      const compro = r.sucesos.some((s) => s.tipo === 'comprado');
      aplicar(r);
      if (compro) aviso('Listo');
    });
  });

  $('btn-sonido').addEventListener('click', () => {
    sonido.despertar();
    const mudo = sonido.alternarSilencio();
    $('btn-sonido').dataset.apagado = mudo ? '1' : '0';
    $('btn-sonido').textContent = mudo ? '♪̸' : '♪';
    if (!mudo) sonido.colocar();
  });
  $('btn-sonido').dataset.apagado = sonido.silenciado ? '1' : '0';
  $('btn-sonido').textContent = sonido.silenciado ? '♪̸' : '♪';

  const reiniciar = () => {
    estado = nuevaPartida({ monedas: estado.monedas, mejor: estado.mejor });
    escenario.efectos.limpiar();
    escenario.limpiarPreview();
    $('capa-fin').hidden = true;
    estadoTexto('Tu turno');
    pintarTodo();
    guardar();
  };
  $('btn-reiniciar').addEventListener('click', reiniciar);
  $('btn-otra').addEventListener('click', reiniciar);

  // Para poder probar desde la consola sin jugar media hora
  window.__nova = {
    get estado() { return estado; },
    set estado(v) { estado = v; pintarTodo(); },
    escenario, sonido,
    forzar: (parche) => { estado = { ...estado, ...parche }; pintarTodo(); },
  };
}

/**
 * Recargar sola cuando llega una version nueva.
 *
 * Sin esto, el service worker sirve la copia guardada y lo nuevo recien aparece
 * a la SEGUNDA recarga: se publica un arreglo y el telefono sigue mostrando lo
 * viejo. Aca se puede recargar sin avisar porque no hay nada que perder: el
 * record y las monedas viven en localStorage, no en la pagina. El candado evita
 * el bucle si el navegador avisa dos veces.
 */
if ('serviceWorker' in navigator) {
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    location.reload();
  });
}

iniciar();
