# Nova Blocks

Juego de bloques donde cada tanto aparece un jefe y te cambia las reglas.

Cuadrícula 8×8, tres piezas por turno, se limpian filas y columnas completas. La diferencia
con los demás: a partir de los 2000 puntos entra un jefe que impone una regla molesta
durante unos turnos. Lo aguantás y se va, y el siguiente aparece más lejos.

## Los jefes

| Jefe | Qué te hace | Turnos |
|---|---|---|
| El Bloqueador | Sella 3 celdas: no se pueden usar ni limpiar | 8 |
| El Basurero | Cada 2 turnos te tira un bloque encima | 10 |
| El Tacaño | Te da 2 piezas por turno en vez de 3 | 12 |
| El Gigante | Solo te salen piezas de 4 celdas o más | 10 |

## Correrlo

```bash
npm install
npm run dev      # desarrollo
npm test         # 62 pruebas del motor y los jefes
npm run build    # version de produccion
```

## Cómo está armado

Cuatro piezas que se entienden por separado:

- **`src/engine/`** — las reglas. JavaScript puro, sin nada de pantalla: recibe acciones y
  devuelve estados. Es la parte que decide si una jugada vale y cuánto suma, y por eso es la
  que tiene pruebas automáticas.
- **`src/bosses/`** — los jefes. Cada uno es un objeto con la misma forma. Agregar uno nuevo
  son unas 15 líneas y no se toca el motor ni la pantalla.
- **`src/render/`** — el dibujo con PixiJS: tablero, partículas, temblor y destello.
- **`src/audio/`** — el sonido, generado por código con WebAudio. Cero archivos.

La paleta vive en OKLCH (ver [DESIGN.md](DESIGN.md)) y se convierte a RGB para PixiJS. Al ser
perceptualmente uniforme, dos colores con la misma luminosidad se ven igual de brillantes
aunque tengan tonos distintos, y por eso las seis piezas se leen como un sistema.

El motor guarda los colores por **nombre**, nunca como valor de pixel: traducir nombre a
color es tarea del render y solo de él.

## Se instala en el teléfono

Es una PWA: desde el iPhone, Compartir → *Añadir a pantalla de inicio*. Queda con ícono
propio, sin la barra de Safari, y abre sin internet.

## Documentos

- [PRODUCT.md](PRODUCT.md) — para quién es y qué evita ser
- [DESIGN.md](DESIGN.md) — paleta, tipografía y la escala del golpe
- [docs/superpowers/specs/](docs/superpowers/specs/) — el diseño técnico
