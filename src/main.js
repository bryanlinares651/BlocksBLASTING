// Une el motor, la pantalla y el sonido. Aca vive la interaccion.

import { nuevaPartida, jugar, usarPoder, comprar, previsualizar, usarLampara, xpNecesaria, PRECIOS } from './engine/game.js';
import { LADO, coordenadas, indice, celdasDe, BLOQUEADA } from './engine/board.js';
import { Escenario } from './render/stage.js';
import { flotarPuntos } from './render/effects.js';
import { PiezaFlotante } from './render/floating.js';
import { Celebracion } from './render/celebracion.js';
import { PALETA, PALETA_CSS, COLORES_JEFE, intensidad } from './render/theme.js';
import { Sonido } from './audio/sfx.js';
import { TEMAS, temaPorId, siguienteTema, aplicarCss, paletaDe } from './render/temas.js';

const $ = (id) => document.getElementById(id);
const GUARDADO = 'nova-blocks-v1';
const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const sonido = new Sonido();
let escenario;
let flotante;
let fiesta;
let estado;
let apuntando = null;   // 'bomba' | 'rayo' cuando se esta eligiendo donde
let temaActual = TEMAS[0];
let consejoVisible = null;
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
  return paletaDe(temaActual).texto[nombre] ?? PALETA_CSS[nombre] ?? PALETA_CSS.cyan;
}

function pintarMarcadores() {
  $('puntaje').textContent = estado.puntaje.toLocaleString('es');
  $('monedas').textContent = estado.monedas;
  $('mejor').textContent = estado.mejor.toLocaleString('es');
  $('nivel').textContent = estado.nivel;
  const falta = xpNecesaria(estado.nivel);
  $('xp-texto').textContent = `${estado.xp} / ${falta}`;
  $('barra').style.width = `${Math.min(100, (estado.xp / falta) * 100)}%`;

  // Un poder en cero pero con monedas para comprarlo NO se deshabilita: muestra
  // el precio y lo compra de un toque. Antes el boton quedaba muerto con el
  // banco lleno y habia que bajar a la tienda — 332px de scroll para algo que
  // podias pagar sin moverte.
  for (const [id, tipo] of [['bomba', 'bomba'], ['rayo', 'rayo'], ['lampara', 'lampara']]) {
    const cuantos = estado.poderes[tipo] ?? 0;
    const precio = PRECIOS[tipo];
    const alcanza = estado.monedas >= precio;
    const btn = $(`btn-${id}`);
    const cuenta = $(`cuenta-${id}`);
    if (cuantos > 0) {
      cuenta.textContent = cuantos;
      delete cuenta.dataset.precio;
      btn.disabled = false;
    } else {
      cuenta.textContent = precio;
      cuenta.dataset.precio = '1';
      btn.disabled = !alcanza;
    }
  }
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

/** El contador de racha, arriba del tablero. Desaparece solo al cortarse. */
function pintarCombo(combo, centro = null) {
  const el = $('combo');
  if (combo < 2) {
    el.dataset.visible = '0';
    return;
  }
  el.dataset.visible = '1';
  el.querySelector('.combo-numero').textContent = `×${combo}`;
  // Reiniciar la animacion: sin esto, el segundo combo seguido no late.
  el.classList.remove('late');
  void el.offsetWidth;
  el.classList.add('late');
  if (centro) {
    flotarPuntos($('flotantes'), `COMBO ×${combo}`, centro.x, centro.y - 34,
                 cssDeNombre('rosa'));
  }
}

/**
 * Tablero limpio: la jugada mas dificil. Paga bonus Y cambia el tema, que es
 * la idea de Bryan — la recompensa no es solo un numero, es ver algo nuevo.
 */
function celebrarTableroLimpio(suceso) {
  sonido.tableroLimpio();
  fiesta.mensaje('¡PERFECTO!', 'epica');
  const capa = $('capa-limpio');
  const nuevo = siguienteTema(temaActual.id);
  $('limpio-bonus').textContent = `+${suceso.bonus.toLocaleString('es')}`;
  $('limpio-tema').textContent = nuevo.nombre;
  $('limpio-lema').textContent = nuevo.lema;
  capa.hidden = false;

  // El cambio ocurre a mitad de la animacion, con la pantalla tapada: si se
  // cambiara a la vista, se ven las texturas viejas un cuadro y parpadea.
  setTimeout(() => {
    temaActual = nuevo;
    aplicarCss(nuevo);
    escenario.aplicarTema(nuevo);
    escenario.efectos.aplicarTema?.(nuevo);
    pintarBandeja();
  }, reducido ? 60 : 420);

  setTimeout(() => { capa.hidden = true; }, reducido ? 500 : 1900);
}

/** La lampara: marca la jugada aconsejada hasta que hagas otra cosa. */
function mostrarConsejo(suceso) {
  consejoVisible = suceso;
  const pieza = estado.piezas[suceso.indicePieza];
  estado = { ...estado, seleccionada: suceso.indicePieza };
  pintarBandeja();
  previsualizarEn(suceso.indicePieza, suceso.celda);
  sonido.subirNivel();
  aviso(suceso.lineas > 0
    ? `Ahí rompés ${suceso.lineas === 1 ? '1 línea' : `${suceso.lineas} líneas`}`
    : 'Ahí es donde mejor encaja');
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
        escenario.reventarCeldas(s.celdas, tableroAntes, s.cantidad,
                                 { filas: s.filas, columnas: s.columnas });
        sonido.limpiar(s.cantidad, fuerza.semitonos, s.combo ?? 1);
        const centro = escenario.centroDe(s.celdas[Math.floor(s.celdas.length / 2)]);
        const puntos = s.puntos ?? s.cantidad * s.cantidad * 70;
        flotarPuntos($('flotantes'), `+${puntos.toLocaleString('es')}`, centro.x, centro.y,
                     cssDeNombre('ambar'));
        pintarCombo(s.combo ?? 0, centro);
        fiesta.porLineas(s.cantidad);
        if ((s.combo ?? 0) >= 2) fiesta.porCombo(s.combo);
        const cuantas = s.cantidad === 1 ? '1 línea' : `${s.cantidad} líneas`;
        estadoTexto(s.cantidad >= 3 ? `¡${cuantas}!` : `${cuantas} fuera`, 'bien');
        break;
      }

      case 'combo-cortado':
        sonido.comboCortado();
        pintarCombo(0);
        break;

      case 'tablero-limpio':
        celebrarTableroLimpio(s);
        break;

      case 'consejo':
        mostrarConsejo(s);
        break;

      case 'subio-nivel':
        fiesta.mensaje(`NIVEL ${s.nivel}`, 'media');
        sonido.subirNivel();
        aviso(`Nivel ${s.nivel} · +${s.monedas} monedas`);
        break;

      case 'jefe-entra':
        anunciarJefe(s);
        estadoTexto(s.nombre, 'malo');
        break;

      case 'jefe-vencido':
        fiesta.mensaje('¡LO AGUANTASTE!', 'grande');
        sonido.jefeVencido();
        aviso(`${s.nombre} se fue`);
        estadoTexto('Tu turno');
        break;

      case 'basura-cae':
        sonido.basura();
        break;

      case 'cuota-cumplida':
        fiesta.mensaje('¡CUOTA CUMPLIDA!', 'grande');
        sonido.jefeVencido();
        break;

      case 'cuota-premio':
        aviso(`Cuota cumplida · +${80} monedas`);
        break;

      case 'cuota-fallada':
        aviso(`No llegaste a la cuota · ${s.bloques} bloques de castigo`);
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
        if (s.razon === 'nada-que-romper') aviso('Ahí no hay nada que romper');
        if (s.razon === 'jefe-la-bloquea') aviso('El jefe solo te deja la primera');
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

// Cuanto se levanta la pieza sobre el dedo, en celdas. Con 0 el dedo la tapa;
// con mucho se despega y deja de sentirse agarrada.
const LEVANTE = 1;

/**
 * Convierte la posicion del dedo en la celda donde va el ORIGEN de la pieza.
 *
 * La pieza se agarra del CENTRO, no de su esquina de arriba a la izquierda, y
 * en los dos ejes. Centrando solo a lo ancho, una pieza vertical de 4 se siente
 * como si manejaras su segundo bloque en vez de la pieza entera.
 *
 * Encima de eso se levanta `LEVANTE` celdas, porque si no el dedo tapa justo lo
 * que estas tratando de ver.
 */
function celdaObjetivo(pieza, clientX, clientY) {
  const r = escenario.app.canvas.getBoundingClientRect();
  const paso = r.width / LADO;
  const colDedo = Math.floor((clientX - r.left) / paso);
  const filaDedo = Math.floor((clientY - r.top) / paso);

  const xs = pieza.forma.map((p) => p[0]);
  const ys = pieza.forma.map((p) => p[1]);
  const ancho = Math.max(...xs) - Math.min(...xs) + 1;
  const alto = Math.max(...ys) - Math.min(...ys) + 1;

  const colOrigen = colDedo - Math.floor((ancho - 1) / 2);
  const filaOrigen = filaDedo - Math.floor((alto - 1) / 2) - LEVANTE;

  // Se recorta para que la pieza ENTERA entre en el tablero, no solo su origen:
  // si no, arrastrar hasta el borde deja media pieza afuera y la jugada se
  // vuelve invalida por una razon que no se ve.
  const cf = Math.max(0, Math.min(LADO - alto, filaOrigen));
  const cc = Math.max(0, Math.min(LADO - ancho, colOrigen));
  return indice(cf, cc);
}

function previsualizarEn(indicePieza, celda) {
  const p = previsualizar(estado, indicePieza, celda);
  const pieza = estado.piezas[indicePieza];
  // Cuando NO cabe se pinta igual la pieza entera, en rojo. Mostrar una sola
  // celda deja al jugador sin saber que esta intentando poner ni contra que
  // choca: se ve un cuadrito suelto y un cartel que dice que no cabe.
  const celdas = p.valido
    ? p.celdas
    : celdasDe(pieza?.forma ?? [[0, 0]], celda).filter((c) => c >= 0);
  // Las celdas que chocan se marcan mas fuerte: asi se ve DONDE esta el
  // estorbo, no solo que hay uno.
  const choques = p.valido ? [] : celdas.filter((c) => estado.tablero[c] !== null);
  escenario.pintarPreview({
    celdas,
    choques,
    lineas: p.lineas,
    valido: p.valido,
    color: pieza ? pieza.color : 'cyan',
  });
  const rompe = $('rompe');
  if (p.valido && p.lineas?.cantidad) {
    const n = p.lineas.cantidad;
    $('rompe-numero').textContent = n;
    $('rompe-texto').textContent = n === 1 ? 'LÍNEA' : 'LÍNEAS';
    rompe.dataset.visible = '1';
    rompe.dataset.jefe = estado.jefe ? '1' : '0';
    estadoTexto(n === 1 ? 'Se va 1 línea' : `Se van ${n} líneas`, 'bien');
  } else if (p.valido) {
    rompe.dataset.visible = '0';
    estadoTexto('Cabe acá');
  } else {
    rompe.dataset.visible = '0';
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
    // Capturar el puntero es una mejora, no un requisito: si falla (pasa con
    // eventos sinteticos, y puede pasar si el puntero se solto antes de
    // tiempo) no puede llevarse puesto el resto del arrastre.
    try { el.setPointerCapture?.(ev.pointerId); } catch { /* sin captura, igual funciona */ }
    levantarFlotante(i, ev.clientX, ev.clientY);
    pintarBandeja();
  });
}

/** Levanta la pieza que va a seguir el dedo, ya a la medida del tablero. */
function levantarFlotante(indicePieza, x, y) {
  const pieza = estado.piezas[indicePieza];
  if (!pieza) return;
  flotante.tomar(pieza, escenario.ladoCeldaEnPantalla(), cssDeNombre(pieza.color),
                 x, y - escenario.ladoCeldaEnPantalla() * ALTURA_DEDO);
}

// Cuanto se levanta la pieza sobre el dedo mientras la arrastras, en bloques.
// Tiene que coincidir con el LEVANTE del calculo de celda, o lo que ves y donde
// cae no coinciden.
const ALTURA_DEDO = 1;

// Cuanto puede salirse el dedo del tablero sin que se corte el preview. Hacia
// afuera es seguro: da holgura en los bordes sin crear zonas muertas adentro.
const HOLGURA = 70;

function moverArrastre(ev) {
  if (!arrastre) return;
  const pieza = estado.piezas[arrastre.pieza];
  if (!pieza) return;

  // La pieza sigue el dedo SIEMPRE, aunque este fuera del tablero. Es lo que
  // hace que el arrastre se sienta continuo en vez de a saltos: el ajuste a la
  // cuadricula es solo para la sombra de destino, no para lo que agarras.
  flotante.mover(ev.clientX, ev.clientY - escenario.ladoCeldaEnPantalla() * ALTURA_DEDO);

  if (!escenario.dentro(ev.clientX, ev.clientY, HOLGURA)) {
    escenario.limpiarPreview();
    $('rompe').dataset.visible = '0';
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
  flotante.soltar();
  $('rompe').dataset.visible = '0';
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

  // Los precios de la tienda salen del motor, no escritos a mano en el HTML:
  // dos listas que hay que sincronizar terminan siempre desincronizadas.
  for (const el of document.querySelectorAll('[data-precio-de]')) {
    el.textContent = PRECIOS[el.dataset.precioDe];
  }
  aplicarCss(temaActual);
  escenario = await new Escenario($('tablero'), { reducido, tema: temaActual }).iniciar();
  flotante = new PiezaFlotante($('flotantes'));
  fiesta = new Celebracion($('flotantes'), { reducido });
  window.addEventListener('resize', () => flotante.redimensionar(escenario.ladoCeldaEnPantalla()));
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
      levantarFlotante(estado.seleccionada, ev.clientX, ev.clientY);
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
      // Sin unidades pero con monedas: compra y sigue derecho a apuntar.
      if (!estado.poderes[tipo]) {
        const r = comprar(estado, tipo);
        if (!r.sucesos.some((x) => x.tipo === 'comprado')) {
          aviso('Te faltan monedas');
          return;
        }
        estado = r.estado;
        pintarMarcadores();
        guardar();
      }
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

  $('btn-lampara').addEventListener('click', () => {
    sonido.despertar();
    if (!estado.poderes.lampara) {
      const compra = comprar(estado, 'lampara');
      if (!compra.sucesos.some((x) => x.tipo === 'comprado')) { aviso('Te faltan monedas'); return; }
      estado = compra.estado;
      pintarMarcadores();
    }
    const r = usarLampara(estado);
    estado = r.estado;
    procesar(r.sucesos, estado.tablero);
    pintarMarcadores();
    if (r.sucesos[0]?.razon === 'sin-consejo') aviso('No hay jugada que valga la pena');
    guardar();
  });

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

  // Cambiar de estilo a mano. El cambio "de verdad" se gana limpiando el
  // tablero, pero tener los tres encerrados detras de la jugada mas dificil
  // significaba que Bryan no habia visto NINGUNO despues de un dia jugando.
  $('btn-tema').addEventListener('click', () => {
    sonido.despertar();
    temaActual = siguienteTema(temaActual.id);
    aplicarCss(temaActual);
    escenario.aplicarTema(temaActual);
    pintarBandeja();
    sonido.subirNivel();
    aviso(`${temaActual.nombre} · ${temaActual.lema}`);
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
    temaActual = TEMAS[0];
    aplicarCss(temaActual);
    escenario.aplicarTema(temaActual);
    pintarCombo(0);
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
    escenario, sonido, flotante, fiesta,
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
