# Nova Blocks — Diseño

Fecha: 2026-07-26
Autor: Claude, con Bryan Linares

## Qué es

Un juego de bloques tipo Block Blast, para uso personal de Bryan, instalado en su iPhone
como aplicación. Cuadrícula 8×8, tres piezas por turno, se limpian filas y columnas
completas. La diferencia con el original: **jefes que aparecen cada cierto puntaje e
imponen una regla molesta durante unos turnos**, al estilo de los boss blinds de Balatro.

Punto de partida: `index.html` (16 KB) generado por Hermes el 2026-07-26, probado y
funcional. Se conserva como referencia de mecánica y de estética, no como base de código.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Alcance | Solo para Bryan | Sin cuentas, sin servidor, sin costos recurrentes |
| Estructura de partida | Infinito con jefes | Se juega en ratos cortos; no se pierde el avance |
| Render del tablero | PixiJS v8 (WebGL/WebGPU) | Miles de partículas sin trabarse; filtros de brillo y resplandor |
| Render de la interfaz | HTML + CSS | Más liviano y accesible para puntaje, tienda y menús |
| Sonido | Generado por código (WebAudio) | Cero archivos que descargar; tono variable según la cadena |
| Distribución | PWA en GitHub Pages | HTTPS gratis (requisito para instalar), actualizar = hacer push |
| Persistencia | localStorage | Sin backend; el récord y el progreso viven en el teléfono |

**Descartados con razón:** Phaser (trae física, mapas y cámaras que este juego no usa);
app nativa en Swift (cada cambio pasa por revisión de Apple, que es justamente lo que hace
que el Block Blast original se sienta estancado); alojarlo dentro de mueblesrocagt.com
(mezcla un juego personal con el sitio de la empresa).

## Arquitectura

Cuatro piezas independientes. Cada una se puede entender y probar sin leer las otras.

### 1. `src/engine/` — Las reglas del juego

JavaScript puro, sin nada de pantalla. Recibe acciones y devuelve estados.

- `board.js` — la cuadrícula: colocar, detectar líneas completas, limpiar, saber si hay
  movimientos posibles.
- `pieces.js` — el catálogo de formas y la generación de las tres piezas del turno.
- `scoring.js` — puntos, monedas, nivel, experiencia, cadenas.
- `game.js` — junta todo lo anterior y expone el estado de la partida.

**Por qué separado:** es la parte que decide si una jugada es válida y cuántos puntos vale.
Al no depender de la pantalla, se puede probar con tests automáticos y no se rompe cuando
cambia el diseño. Es la misma decisión que se tomó con la CNC: la lógica que importa vive
en código determinista y testeable.

### 2. `src/bosses/` — Los jefes

Cada jefe es un archivo con la misma forma: cuándo aparece, qué hace en cada turno, cuándo
se va. El motor no sabe qué jefes existen; solo les pregunta si quieren modificar algo.

```js
// forma de un jefe
{
  id: 'bloqueador',
  nombre: 'El Bloqueador',
  aparecePorPuntaje: 2000,
  turnos: 8,
  alEmpezar(estado)  { /* marca 3 celdas como bloqueadas */ },
  enCadaTurno(estado){ /* nada */ },
  alTerminar(estado) { /* libera las celdas */ }
}
```

**Por qué así:** agregar un jefe nuevo es escribir un archivo de ~15 líneas y sumarlo a una
lista. No se toca el motor ni la pantalla. Esto es lo que hace viable el objetivo de Bryan
de tener contenido nuevo seguido.

**Jefes de la primera entrega (4):**

| Jefe | Qué hace |
|---|---|
| El Bloqueador | Marca celdas como intocables durante sus turnos |
| El Basurero | Cada 2 turnos tira un bloque suelto en un lugar al azar |
| El Tacaño | Te da solo 2 piezas por turno en vez de 3 |
| El Gigante | Solo te salen piezas grandes (4 y 5 celdas) |

### 3. `src/render/` — Lo que se ve

- `stage.js` — arranca PixiJS y dibuja el tablero y las piezas.
- `effects.js` — partículas al reventar, temblor de pantalla, resplandor de la línea que
  se va a limpiar, rebote al soltar la pieza.
- `ui.js` — el HTML de arriba y abajo: puntaje, monedas, nivel, poderes, tienda.

### 4. `src/audio/` — El sonido

`sfx.js` genera los sonidos con WebAudio, sin archivos. Un "toc" al colocar, un crujido al
limpiar que **sube de tono con cada línea encadenada**, un golpe grave al aparecer el jefe.
Con botón de silencio, y vibración del teléfono en paralelo.

## Cómo se ve y se siente

Se conserva la estética del prototipo, que ya funciona: fondo azul noche con un resplandor
arriba a la izquierda, bloques de colores saturados con brillo interno, tipografía blanca.

Lo que se agrega, que es donde está la diferencia con Block Blast:

- **Al limpiar una fila:** los bloques no desaparecen — revientan. Cada uno se parte en
  ~25 partículas que salen despedidas con gravedad, rebotan una vez y se apagan. La fila
  destella en blanco un instante antes.
- **Al encadenar:** cada línea adicional en la misma jugada sube el tono del sonido y suma
  un temblor corto de pantalla. Cuatro líneas de una vez tiene que sentirse distinto a una.
- **Al soltar la pieza:** rebota apenas al asentarse, no aparece de golpe.
- **Al entrar un jefe:** la pantalla se oscurece medio segundo, entra su nombre desde
  arriba, suena un golpe grave. Mientras dure, un borde de color pulsa en el tablero.

**Criterio de "terminado" para esta parte:** que limpiar cuatro filas de una vez se sienta
mejor que en Block Blast. Es subjetivo y se juzga jugando, no leyendo.

## Errores y casos límite

- **Sin WebGL** (iPhone viejo o modo ahorro): PixiJS cae solo a Canvas 2D. Se detecta y se
  bajan las partículas de 25 a 8 por bloque.
- **Sonido bloqueado**: iOS no deja sonar nada antes de que el usuario toque la pantalla.
  El audio se inicializa en el primer toque, no al cargar.
- **Guardado corrupto**: si el `localStorage` tiene basura, se arranca de cero en vez de
  romper. El récord se guarda aparte para no perderlo.
- **Sin internet**: el service worker guarda todo; el juego abre igual.
- **Pantalla girada / iPhone chico**: el tablero se escala al ancho disponible, mínimo
  320 px.

## Pruebas

- **Automáticas (Vitest)** sobre `engine/` y `bosses/`: colocación válida e inválida,
  detección de líneas, limpieza simultánea de fila y columna, fin de juego, puntaje de
  cadenas, y que cada jefe aplique y revierta su efecto sin dejar rastro.
- **A mano en navegador a 375×812** (tamaño iPhone), como se probó el prototipo: colocar,
  arrastrar, limpiar, aguantar un jefe completo, instalar como app y abrirla sin internet.
- **Regla heredada del prototipo:** no dar por bueno un comportamiento porque el código
  parezca correcto. Los tres bugs del prototipo (poderes que no dejan elegir dónde, texto
  de estado pegado, plural mal) aparecieron jugando, no leyendo.

## Bugs del prototipo que se corrigen

1. **Los poderes no dejan elegir dónde.** La bomba explota en el primer bloque que
   encuentra, siempre arriba a la izquierda. Ahora se elige tocando.
2. **El texto de estado se queda pegado** después de colocar ("Se quitarán 1 líneas").
3. **Falta el singular:** "1 líneas" → "1 línea".

## Fuera de alcance (segunda entrega)

Reto diario con racha, misiones y logros de largo plazo, modos de juego alternativos, más
jefes. Todo esto se apoya en la estructura de arriba; no requiere rehacer nada.

## Criterio de terminado

1. Bryan lo tiene instalado en su iPhone, con ícono propio, y abre sin internet.
2. Se puede jugar una partida completa, aguantar los 4 jefes y perder por falta de movidas.
3. Los tests de `engine/` y `bosses/` pasan.
4. Limpiar cuatro filas de una vez se siente mejor que en Block Blast — juzgado por Bryan.
