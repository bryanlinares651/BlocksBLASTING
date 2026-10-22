import { leer, escribir } from './storage.js';
import { nuevaPartida, quedanJugadas } from './engine/game.js';
import { TOTAL, BLOQUEADA } from './engine/board.js';
import { FORMAS, COLORES } from './engine/pieces.js';
import { JEFES } from './bosses/index.js';
import { xpNecesaria } from './engine/scoring.js';

// Se mantiene la clave para migrar los guardados antiguos de monedas/record.
export const GUARDADO = 'nova-blocks-v1';
const entero = (n) => Number.isSafeInteger(n) && n >= 0;
const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const poderesValidos = (p) => objeto(p) && ['bomba', 'rayo', 'lampara'].every((k) => entero(p[k]));
const copiarPoderes = (p) => ({ bomba: p.bomba, rayo: p.rayo, lampara: p.lampara });
const idJefe = (id) => JEFES.some((j) => j.id === id);

function validarPartida(p, azar) {
  if (!objeto(p) || !Array.isArray(p.tablero) || p.tablero.length !== TOTAL ||
      !p.tablero.every((c) => c === null || c === BLOQUEADA || c === 'basura' || COLORES.includes(c))) return null;
  if (!Array.isArray(p.piezas) || p.piezas.length < 1 || p.piezas.length > 3) return null;
  const piezas = [];
  for (const pieza of p.piezas) {
    if (!objeto(pieza) || !Object.hasOwn(FORMAS, pieza.nombre) || !COLORES.includes(pieza.color) ||
        typeof pieza.usada !== 'boolean' || JSON.stringify(pieza.forma) !== JSON.stringify(FORMAS[pieza.nombre])) return null;
    piezas.push({ nombre: pieza.nombre, color: pieza.color, usada: pieza.usada,
      forma: FORMAS[pieza.nombre].map((c) => [...c]) });
  }
  const numeros = ['puntaje', 'monedas', 'mejor', 'nivel', 'xp', 'proximoJefeEn',
    'combo', 'graciaUsada', 'mejorCombo', 'tablerosLimpiados', 'turno'];
  if (!numeros.every((k) => entero(p[k])) || p.nivel < 1 || p.xp >= xpNecesaria(p.nivel) ||
      !poderesValidos(p.poderes) || typeof p.terminada !== 'boolean' ||
      !(p.seleccionada === null || (entero(p.seleccionada) && p.seleccionada < piezas.length && !piezas[p.seleccionada].usada)) ||
      !Array.isArray(p.jefesVencidos) || !p.jefesVencidos.every(idJefe)) return null;
  let jefe = null;
  if (p.jefe !== null) {
    if (!objeto(p.jefe)) return null;
    const definicion = JEFES.find((j) => j.id === p.jefe.id);
    if (!definicion || !entero(p.jefe.turnosRestantes) || p.jefe.turnosRestantes < 1 ||
        p.jefe.turnosRestantes > definicion.turnos) return null;
    // Se reintegra la configuracion vigente, nunca funciones ni reglas del JSON.
    const { alEmpezar, enCadaTurno, alTerminar, ...config } = definicion;
    jefe = { ...config, turnosRestantes: p.jefe.turnosRestantes };
    if (jefe.id === 'bloqueador') {
      if (!Array.isArray(p.jefe.selladas) || p.jefe.selladas.length > 3 ||
          !p.jefe.selladas.every((c) => entero(c) && c < TOTAL)) return null;
      jefe.selladas = [...p.jefe.selladas];
    }
    if (jefe.id === 'cuota') {
      if (!entero(p.jefe.objetivo) || typeof p.jefe.cumplida !== 'boolean') return null;
      jefe.objetivo = p.jefe.objetivo;
      jefe.cumplida = p.jefe.cumplida;
    }
  }
  const estado = { tablero: [...p.tablero], piezas, seleccionada: p.seleccionada,
    poderes: copiarPoderes(p.poderes), jefe, jefesVencidos: [...p.jefesVencidos], azar };
  for (const k of numeros) estado[k] = p[k];
  estado.mejor = Math.max(estado.mejor, estado.puntaje);
  estado.terminada = !quedanJugadas(estado);
  return estado;
}

export function restaurarGuardado(datos, azar = Math.random) {
  const d = objeto(datos) ? datos : {};
  const partida = d.version === 2 ? validarPartida(d.partida, azar) : null;
  if (partida) return { estado: partida, tema: typeof d.tema === 'string' ? d.tema : null };
  const estado = nuevaPartida({ azar, monedas: entero(d.monedas) ? d.monedas : 120,
    mejor: entero(d.mejor) ? d.mejor : 0 });
  // Si se corrompe el tablero, no descartar ademas los poderes ya comprados.
  if (d.version === 2 && poderesValidos(d.poderes)) estado.poderes = copiarPoderes(d.poderes);
  return { estado, tema: null };
}

export function cargarGuardado(azar = Math.random) {
  try { return restaurarGuardado(JSON.parse(leer(GUARDADO)), azar); }
  catch { return restaurarGuardado(null, azar); }
}

export function guardarPartida(estado, tema = null) {
  try {
    const { azar, ...partida } = estado;
    if (!validarPartida(partida, Math.random)) return false;
    return escribir(GUARDADO, JSON.stringify({ version: 2, partida, tema,
      mejor: Math.max(estado.mejor, estado.puntaje), monedas: estado.monedas, poderes: estado.poderes }));
  } catch { return false; }
}

/** No abandonar una partida por actualizacion si no se pudo guardar. */
export function recargarTrasGuardar(obtenerEstado, guardar, recargar) {
  let recargando = false;
  return () => {
    if (recargando || !obtenerEstado() || !guardar()) return false;
    recargando = true;
    recargar();
    return true;
  };
}
