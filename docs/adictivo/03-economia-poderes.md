# Auditoría de la economía de poderes — Nova Blocks

**Fecha:** 2026-07-26
**Alcance:** `src/engine/scoring.js`, `src/engine/game.js`, `src/main.js`, `index.html`, `src/styles.css`
**Método:** todos los números salen de (a) las funciones reales importadas en Node, o (b) 600 partidas simuladas con el motor real (`jugar()` de `game.js`, sin modificar), o (c) mediciones en el navegador sobre el servidor de desarrollo a 390×664. Ninguna cifra está estimada a ojo. Donde algo no existe en el código, lo digo explícitamente.

---

## 0. Resumen ejecutivo

El diagnóstico no es el que uno esperaría. **El problema no es que falten monedas: es que sobran y no se pueden gastar.**

1. El guardado real del navegador de pruebas trae `{"mejor":5960,"monedas":1241}`. **1241 monedas sin gastar** = 31 bombas al precio actual. La economía no es tacaña con quien juega bien.
2. Al mismo tiempo, **el 50.8% de las partidas de un jugador flojo terminan sin poder comprar absolutamente nada** (18 monedas de mediana contra un precio mínimo de 40). La curva está invertida: quien necesita ayuda no la puede pagar, quien no la necesita acumula.
3. La causa de esa inversión es que **el 52–56% de las monedas vienen de subir de nivel** (+50 de golpe), que es una lotería de escalón: o te tocó, o te quedaste en ~15 monedas. No es un ingreso, es un premio binario.
4. **Los precios están ordenados al revés de la utilidad real.** La lámpara (0 celdas, 0 puntos) cuesta 50, más que la bomba (hasta 9 celdas + 80 puntos) que cuesta 40. El revólver es el más caro (80) y su único caso de uso real es inalcanzable por diseño.
5. **La tienda está a 332 px de scroll del fondo del documento** y los tres botones de poder están `disabled` cuando tenés 0 unidades, sin importar que tengas 1241 monedas. Ese es el motivo real de que las monedas se acumulen: el camino del dinero al poder está cortado en la interfaz, no en los precios.

La propuesta de abajo **no imprime dinero** (+7% de ingreso para el jugador bueno). Redistribuye el ingreso hacia el piso, reordena los precios por utilidad medida, y elimina 5 de los 7 pasos que hoy hay que dar para usar una bomba.

---

## 1. Lo que dice el código (fuentes y precios reales)

### Las únicas 4 fuentes de monedas que existen

Verificado con `grep -rn "monedas" src/`. No hay ninguna otra.

| # | Fuente | Dónde | Cuánto |
|---|---|---|---|
| 1 | Limpiar líneas | `game.js:122` → `scoring.js:17` | `lineas * 8` |
| 2 | Jugada que NO limpia | `game.js:148` → `scoring.js:17` | `1` (el `lineas <= 0 ? 1` de `monedasPorLineas`) |
| 3 | Dejar el tablero vacío | `game.js:154` | `+100` |
| 4 | Subir de nivel | `game.js:168` → `scoring.js:67` | `subidas * 50` |

Regalo inicial: **120** (`game.js:16`, con fallback duplicado en `main.js:38` y `main.js:493`, y un tercer 120 escrito a mano en `index.html:50`).

### Lo que NO existe (verificado, no asumido)

- **No existe ninguna recompensa en monedas por vencer a un jefe.** `avanzar()` (`bosses/index.js:225-258`) emite `jefe-vencido` y nada más.
- **LA CUOTA promete un pago que no existe.** El comentario de `bosses/index.js:132` dice *"Si llegas, se va y te paga"*. `alTerminar` (`bosses/index.js:156`) devuelve `{ aviso: { tipo: 'cuota-premio' } }` — **cero monedas**. Peor: `procesar()` en `main.js:228-297` **no tiene ningún `case` para `cuota-cumplida`, `cuota-premio` ni `cuota-fallada`**. El jugador ni siquiera se entera de si cumplió. Es una mecánica completa que no llega a la pantalla.
- **No existe una tabla de precios exportada.** `const precios` vive dentro de `comprar()` (`game.js:304`), local. Por eso la interfaz no puede mostrar un precio en un botón de poder: **no tiene de dónde leerlo.** Este es el bloqueador técnico concreto de casi toda la mejora de fricción.
- **Los precios están duplicados en el HTML** (`index.html:140,145,150,155`) escritos a mano. Cambiar un precio en `game.js` y no en el HTML hace que la tienda mienta, sin error.
- No existe fuente diaria, ni racha entre partidas, ni recompensa por ver un anuncio, ni tope de monedas, ni forma de vender o reembolsar.

### Los precios (`game.js:304`)

```js
const precios = { bomba: 40, rayo: 60, revolver: 80, lampara: 50 };
```

---

## 2. Pregunta 1 — ¿Cuántas monedas gana un jugador por partida?

### 2.1 El modelo pedido: 40 jugadas, 1 línea cada 3 jugadas

Ejecutado con las funciones reales (`monedasPorLineas`, `puntosPorColocar`, `puntosPorLineas`, `multiplicadorCombo`, `aplicarXp`).

Tamaño medio de pieza, calculado sobre el catálogo real de `pieces.js`: **24 formas, 97 celdas en total → 4.0417 celdas por pieza**, así que `puntosPorColocar` promedio = **40.42 puntos por jugada**.

```
40 jugadas, limpia en las jugadas 3, 6, 9 ... 39  →  13 limpiezas, 27 jugadas sin limpiar

Monedas por líneas   : 13 × monedasPorLineas(1)=8  = 104
Monedas de consuelo  : 27 × monedasPorLineas(0)=1  =  27
Monedas por nivel    :  3 subidas × 50             = 150
                                              TOTAL = 281 monedas
Puntaje final: 4 907   ·   Nivel final: 4
```

**Hallazgo colateral importante: con esa cadencia el combo nunca se corta.** `GRACIA_COMBO = 2` (`scoring.js:28`) aguanta 2 jugadas sin limpiar; limpiar cada 3 gasta exactamente 2 de gracia y la resetea. El combo sube 1→13 sin interrupción y se topa en ×5 a partir del combo 9:

```
jugada  3: combo= 1  ×1     70 pts
jugada  9: combo= 3  ×2    140 pts
jugada 18: combo= 6  ×3.5  245 pts
jugada 27: combo= 9  ×5    350 pts   ← tope
jugada 39: combo=13  ×5    350 pts
```

Si en cambio limpia **cada 4 jugadas**, la gracia se agota y el combo se corta siempre: nunca pasa de 1. El resultado cae a **210 monedas y 2 317 puntos** (contra 281 y 4 907). Es decir: **una jugada de diferencia en la cadencia cambia el puntaje ×2.1**. La frontera 3/4 es un acantilado, no una pendiente.

### 2.2 La realidad: 600 partidas jugadas con el motor de verdad

El modelo de 40 jugadas es optimista. Simulé partidas completas con `jugar()` y dos jugadores: uno "bueno" que usa **la misma heurística que la lámpara del juego** (`buscarConsejo`), y uno "casual" que elige una jugada válida al azar.

| | Casual | Bueno |
|---|---|---|
| Jugadas por partida (mediana) | **11** | **25** |
| Puntaje (mediana) | 480 | 2 085 |
| **Monedas (mediana)** | **18** | **182** |
| Monedas (promedio) | 46 | 188 |
| Monedas por jugada | 3.87 | 7.22 |
| Limpiezas por partida | 1.0 | 8.3 (1 cada 3.1 jugadas) |
| Partidas con ≥1 jefe | 0% | 55% |
| Partidas con tablero limpio | 0.0% | **1.5%** |

Reparto del ingreso:

| Fuente | Casual | Bueno |
|---|---|---|
| Subir de nivel | **56%** | **52%** |
| Líneas | 20% | 37% |
| Consuelo (+1) | 24% | 9% |
| Jefes | 0% | 0% |
| Tablero limpio | 0% | 1% |

**Dos conclusiones duras:**

- **Más de la mitad del dinero del juego viene de una fuente que el jugador no asocia con jugar bien.** Subir de nivel es un aviso de 1.7 segundos (`main.js:271`); limpiar 4 líneas de una — la jugada más difícil que se hace seguido — paga 32 monedas, menos que el 50 de un nivel que subió solo.
- **El bono de nivel es un escalón, no una curva.** La mediana casual (18) y el promedio casual (46) están a 2.5× de distancia: la distribución es bimodal. O te tocó el +50, o terminaste con ~15 monedas. Eso explica el siguiente número.

> **El 50.8% de las partidas casuales terminan sin alcanzar ni para el artículo más barato de la tienda.**

Y el tablero limpio (`+100` monedas, `BONUS_TABLERO_LIMPIO = 2000` puntos, cambio de tema) ocurre en **1.5% de las partidas buenas y 0% de las casuales**. Es la recompensa más espectacular del juego y prácticamente nadie la ve.

---

## 3. Pregunta 2 — ¿Cuántos poderes compra con eso?

Con la mediana de monedas de cada perfil, gastando todo en un solo artículo:

| | Monedas (mediana) | bomba 40 | rayo 60 | lámpara 50 | revólver 80 |
|---|---|---|---|---|---|
| Casual (11 jugadas) | 18 | **0** | **0** | **0** | **0** |
| Bueno (25 jugadas) | 182 | 4 | 3 | 3 | 2 |
| Modelo 40 jugadas | 281 | 7 | 4 | 5 | 3 |

Para el jugador bueno, **4 bombas por partida de 25 jugadas está bien**: una cada 6 jugadas. Ese perfil no está roto. Para el casual, cero es cero.

---

## 4. Pregunta 3 — ¿Cuántas jugadas para comprar UNA bomba? ¿Se siente castigador?

Desde 0 monedas, hasta juntar las 40 de una bomba:

| Perfil | Mediana de jugadas | % de partidas que llegan |
|---|---|---|
| Bueno | **9 jugadas** | 99% |
| Casual | 11 jugadas | **47%** |

En el modelo analítico: **9 jugadas** — pero solo porque en la jugada 9 cae el +50 del nivel 2. **Sin ese bono harían falta 12 jugadas** (4 limpiezas × 8 + 8 jugadas × 1 = 40).

**¿Es castigador?** Nueve a doce jugadas por una bomba **no es castigador — es correcto**. Una partida buena dura 25 jugadas; pagar 9 de esas 25 por un poder es una decisión con peso, que es lo que hace que valga la pena tenerlo.

**Lo castigador es otra cosa, y son tres cosas concretas:**

1. **El 51% de las partidas flojas nunca llegan.** No es que tarde: es que no pasa nunca. El jugador que más necesita una bomba es exactamente el que no la va a tener.
2. **La bomba nunca "se paga sola".** A la tasa real del jugador bueno (7.22 monedas/jugada), una bomba de 40 cuesta **5.5 jugadas de ingreso**. Y devuelve, como mucho, 9 celdas de espacio = **2.2 piezas** (a 4.04 celdas por pieza). Pagás 5.5 jugadas para recuperar 2.2 jugadas de tablero. **Ningún poder devuelve en espacio lo que cuesta en ingreso.** El punto de equilibrio estaría en ~16 monedas. Por eso las 1241 monedas del guardado están intactas: comprar nunca es la jugada obviamente correcta, así que nadie compra.
3. **Un poder mal apuntado se pierde entero, sin aviso.** En `game.js:224`:
   ```js
   const borrables = objetivo.filter((c) => estado.tablero[c] !== BLOQUEADA);
   ```
   El filtro saca las celdas del jefe, pero **deja pasar las celdas vacías (`null`)**. Bombardeaste una zona vacía: se consume el poder, se te acreditan los 80 puntos, y no pasó nada. El propio código ya sabe que eso está mal — `usarLampara` (`game.js:293-296`) tiene el criterio contrario y comentado: *"No se cobra: no hay nada que aconsejar. Pagar por 'no hay jugada buena' seria una estafa."* La bomba y el rayo no tienen esa protección.

---

## 5. Pregunta 4 — ¿Hay una compra claramente mala?

Sí, hay dos. Esto es lo que hace cada poder **según `usarPoder()` (`game.js:203-236`)**, no según la etiqueta:

| Poder | Precio | Celdas que borra | Puntos | Efecto extra |
|---|---|---|---|---|
| **bomba** | 40 | 3×3 centrado: **9** en el centro, 6 en un borde, **4 en una esquina** | +80 | — |
| **rayo** | 60 | la fila entera: **8 siempre**, apuntes donde apuntes | +80 | — |
| **lámpara** | 50 | **0** | **0** | te marca la mejor jugada, válida 1 turno |
| **revólver** | 80 | **0** | **0** | reparte una mano nueva |

### 5.1 El rayo es la peor compra por eficiencia

Celdas borradas por moneda gastada:

```
bomba en el centro : 9 / 40 = 0.225 celdas/moneda
bomba en un borde  : 6 / 40 = 0.150
rayo (siempre)     : 8 / 60 = 0.133
bomba en esquina   : 4 / 40 = 0.100
```

Puntos por moneda: bomba `80/40 = 2.00`, rayo `80/60 = 1.33`.

Y la comparación que decide: **con 80 monedas comprás 1 rayo + 20 de vuelto (8 celdas, 80 puntos, 1 uso) o 2 bombas (hasta 18 celdas, 160 puntos, 2 usos).** Las dos bombas ganan en todo.

El rayo tiene una ventaja real —8 celdas garantizadas sin depender de la puntería, en línea recta, que es lo que reabre espacio para `cinco_h`— pero **una prima de +50% sobre la bomba no está pagada por 8 celdas contra 9.**

### 5.2 El revólver es la peor compra por diseño

Es el artículo **más caro del juego (80)** y:

- **Su caso de uso natural es literalmente inalcanzable.** `jugar()` marca `terminada` en la misma llamada en que te quedás sin movidas (`game.js:193`), y `mostrarFin()` (`main.js:287`) levanta `#capa-fin`, que es `position: fixed; inset: 0` (`styles.css:404-413`) **sin `pointer-events: none`** — a diferencia de `capa-jefe` y `capa-limpio`, que sí lo tienen. La tienda queda tapada. **Nunca podés revolver para salvarte de perder.** Para usarlo tendrías que adivinar la muerte una jugada antes.
- **Su etiqueta miente por defecto.** `index.html:154` dice *"Cambia tus piezas actuales"*. Lo que hace `comprar()` (`game.js:312`) es llamar a `repartirJugable(...)`, que devuelve **3 piezas nuevas sin usar**. Si ya gastaste 2 de las 3, el revólver **te rellena la mano completa**: son 2 piezas extra. Ese es su verdadero poder, es el más fuerte del juego, y no está escrito en ningún lado.
- Y ni siquiera garantiza piezas mejores: `repartirJugable` solo garantiza que **al menos una entre**, que es exactamente lo que ya garantiza el reparto normal (`game.js:56-60`).

### 5.3 La lámpara está mal ubicada en la escala

Cuesta **50, más que la bomba (40)**, y no toca el tablero ni da un punto. Su valor es informativo y **caduca en una jugada**. Es el objeto que enseña a jugar y el que salva a quien está atascado — es decir, el objeto del jugador flojo — y es el segundo más caro de la tienda, para un jugador cuya mediana de monedas es 18.

---

## 6. La economía nueva (con la cuenta de cada número)

### Principio

No subir el ingreso: **redistribuirlo hacia el piso, y reordenar los precios según la utilidad medida.** El objetivo declarado, en números:

- **Meta A (que no sea cruel):** ≥90% de las partidas, incluso las malas, tienen que poder comprar algo. Hoy: 49.2%.
- **Meta B (que no sea gratis):** una partida buena de 25 jugadas tiene que alcanzar para **4–5 poderes**, no 8. Hoy: 4. **Esta meta ya se cumple y no hay que romperla.**

### 6.1 Monedas — cambios propuestos

| Qué | Hoy | Propuesto | La cuenta |
|---|---|---|---|
| `monedasPorLineas(0)` (consuelo) | `1` | **`3`** | Es el piso. El casual hace ~10 jugadas sin limpiar por partida: pasa de 10 a 30 monedas. Sube el ingreso del casual +20 y el del bueno +34 (17 jugadas sin limpiar) — sube más al que menos tiene, en proporción: del 24% al 60% de su ingreso, contra 9%→26% en el bueno. |
| `monedasPorLineas(n)` | `n * 8` | **`n * n * 8`** | **La limpieza de 1 línea no cambia (8), y el 95.4% de las limpiezas son de 1 línea** (medido: 3158 de 3311). Solo paga distinto lo raro: 2 líneas 16→32, 3 líneas 24→72, 4 líneas 32→128. Inflación total: **+7 monedas por partida buena**. A cambio, las monedas por fin copian la forma de los puntos, que ya son cuadráticos a propósito (`scoring.js:13-15`) — hoy los puntos empujan a guardar la jugada grande y las monedas no. |
| Bono por subir de nivel | `50` | **`20`** | Es el escalón que rompe la curva. A 50 explica el 52-56% del ingreso y hace que la mediana casual (18) y su promedio (46) estén a 2.5×. A 20 baja al 17-19% y la distribución deja de ser una lotería. |
| **Jefe entra** | *no existe* | **`+40`** | El dinero tiene que llegar **cuando sube la dificultad, no después**. Un jefe dura 8-10 turnos de juego degradado; 40 monedas es "tomá, comprate la bomba que vas a necesitar". Impacto: 0.57 jefes por partida buena → +23 monedas de promedio, **0 para el casual** (nunca ve un jefe). No infla al que ya tiene. |
| **Jefe vencido** | *no existe* | **`+40`** | Aguantar el jefe hoy paga exactamente lo mismo que no aguantarlo. |
| **Cuota cumplida** | *promete y no paga* | **`+80`** | Cumple la promesa escrita en `bosses/index.js:132`. Es el único jefe con una meta que se puede fallar; tiene que ser el que más paga. **Requiere además agregar los `case` que faltan en `procesar()`** — hoy el jugador ni se entera. |
| Tablero limpio | `100` | **`100`** (sin cambio) | Ocurre en el 1.5% de las partidas. No mueve la economía; el premio real es el cambio de tema. |
| Regalo inicial | `120` | **`120`** (sin cambio) | Con los precios nuevos ya compra 3 lámparas + 1 bomba. Alcanza. |

### 6.2 Precios — cambios propuestos

Ordenados por utilidad medida, no por vibra:

| Artículo | Hoy | Propuesto | La cuenta |
|---|---|---|---|
| **lámpara** | 50 | **20** | Es lo único que no toca el tablero ni da puntos, y caduca en 1 jugada: tiene que ser lo más barato. A 20 la mediana casual de la economía nueva (39) compra 1 y le sobra. Es el objeto que enseña a jugar; cobrarlo más caro que la bomba era cobrar más por menos. |
| **bomba** | 40 | **35** | Corte chico a propósito: a 4 bombas por partida buena, la bomba ya estaba bien. 35 = "una limpieza doble" con la fórmula nueva (2 líneas = 32) más un pelo. |
| **rayo** | 60 | **45** | Sigue por encima de la bomba porque garantiza 8 celdas apuntes donde apuntes, pero la prima baja de **+50% a +29%**, que es lo que vale esa garantía frente a 9 celdas mal apuntadas. |
| **revólver** | 80 | **35** | Al precio de una bomba. Es el botón de emergencia: caro no lo compra nadie, y su valor real (mano nueva de 3 piezas) es exactamente lo que necesitás cuando estás atascado. **El precio solo sirve si además se abre la ventana donde se puede usar** (ver 7.3). |

### 6.3 Resultado medido (mismas 600 partidas, monedas recalculadas)

| | Hoy | Propuesto | Cambio |
|---|---|---|---|
| **Casual — monedas (mediana)** | 18 | **39** | ×2.2 |
| Casual — monedas (promedio) | 46 | 54 | +17% |
| **Casual — partidas sin alcanzar NADA** | **50.8%** | **2.5%** | ✅ Meta A |
| Casual — compra con la mediana | nada | 1 bomba **o** 1 lámpara + vuelto | |
| **Bueno — monedas (mediana)** | 182 | **194** | **+7%** |
| Bueno — bombas con la mediana | 4 | **5** | ✅ Meta B |
| Bueno — partidas sin alcanzar nada | 1.5% | 0.0% | |

Reparto del ingreso, antes → después:

| Fuente | Casual hoy → nuevo | Bueno hoy → nuevo |
|---|---|---|
| Subir de nivel | 56% → **19%** | 52% → **19%** |
| Líneas | 20% → 21% | 37% → **38%** |
| Consuelo | 24% → 60% | 9% → 26% |
| Jefes | 0% → 0% | **0% → 17%** |

**El ingreso total del jugador bueno sube 7%.** Todo lo demás es redistribución. Eso es "accesible sin volverlos gratis" con la cuenta puesta.

### 6.4 Lo que hay que aceptar de esta propuesta

Dos cosas, dichas de frente:

- **El 60% del ingreso del casual pasa a ser el consuelo de +3 por jugada.** Es un estipendio. Es intencional —es el piso anti-crueldad que le permite comprar la lámpara que le va a enseñar a jugar mejor— pero es un estipendio, y hay que llamarlo así.
- **La simulación subestima el efecto.** El jugador simulado nunca compra ni usa poderes. En la realidad, poderes más baratos → partidas más largas → más monedas → más poderes. Es un lazo que se refuerza solo. Por eso los recortes de precio son conservadores (bomba −12%, no −40%) y por eso **hay que medir después de aplicar**, no antes.

### 6.5 Un cambio de mecánica que vale más que cualquier precio

La bomba nunca va a ser una compra racional mientras cueste 5.5 jugadas de ingreso y devuelva 2.2 jugadas de espacio. Bajar el precio hasta el punto de equilibrio (~16 monedas) la volvería spam. La salida no es el precio: **es darle a la bomba algo que una pieza no puede hacer nunca.**

Hoy `game.js:224` lo prohíbe explícitamente:

```js
// Un poder nunca borra las celdas del jefe: para eso hay que aguantarlo.
const borrables = objetivo.filter((c) => estado.tablero[c] !== BLOQUEADA);
```

**Propuesta: que la bomba —y solo la bomba— sí borre celdas `BLOQUEADA`.** Es la única cosa del juego que ninguna jugada puede resolver, aparece exactamente en el momento más difícil (EL BLOQUEADOR sella 3 celdas, EL ENCOGEDOR sella todo el borde) y convierte la bomba de "comodidad cara" en "la respuesta al jefe". Además le da al jugador una razón para comprar **antes** de estar desesperado, que es lo que hoy no existe. El rayo y la lámpara mantienen la restricción, y así cada poder tiene una identidad distinta en vez de tres versiones del mismo botón.

---

## 7. Fricción de uso

### 7.1 Los pasos reales, medidos

El enunciado hablaba de 5 pasos. Medido en el navegador a **390×664** (viewport real de un iPhone en Safari con la barra de direcciones), son **7**, dos de ellos scroll:

| # | Paso | Dónde |
|---|---|---|
| 1 | **Scroll 332 px hacia abajo** para que aparezca "Canjear monedas" | `#btn-tienda` vive en 957–996 px; el documento mide 1031 px y el viewport 664. Son el **90% de todo el scroll de la página**. |
| 2 | Tocar `#btn-tienda` | `main.js:569` |
| 3 | Tocar el artículo | `main.js:575-583` |
| 4 | **Tocar la × o el fondo para cerrar** — la tienda **no se cierra sola** al comprar | `main.js:570-573`; el handler de compra nunca hace `hidden = true` |
| 5 | **Scroll de vuelta hacia arriba** para ver el tablero | el tablero ocupa 190–726 px; desde el scroll de la tienda no se ve |
| 6 | Tocar `#btn-bomba` para apuntar | `main.js:543-557` |
| 7 | Tocar la celda objetivo | `main.js:504-523` |

Mediciones de respaldo (`getBoundingClientRect` sobre el servidor de desarrollo, viewport 390×664):

```
docHeight 1031  ·  viewport 664  ·  scroll total 367 px
#btn-bomba   → 775–827  (necesita 163 px de scroll)
#btn-tienda  → 957–996  (necesita 332 px de scroll)
.tablero-marco → 190–726 (el tablero solo ya no entra entero)
```

### 7.2 Los tres bloqueos que explican las 1241 monedas sin gastar

**(a) El botón que dice "Bomba" está muerto cuando más lo querés.** `main.js:92-94`:

```js
$('btn-bomba').disabled = estado.poderes.bomba === 0;
$('btn-rayo').disabled = estado.poderes.rayo === 0;
$('btn-lampara').disabled = !estado.poderes.lampara;
```

Verificado en vivo: con **1241 monedas en el guardado**, los tres botones reportan `disabled: true`, al 42% de opacidad (`styles.css:361`). El gesto más directo que existe para "quiero una bomba" no hace nada. **Este es el bug de economía más caro del juego y no está en ningún número.**

**(b) La tienda te esconde tu propio saldo.** `#capa-tienda` es `position: fixed; inset: 0` con un velo al 74% (`styles.css:404-413`). Verificado con `document.elementFromPoint` sobre el contador `#monedas`: devuelve **`capa-tienda`**. El único contador de monedas del juego queda tapado por la tienda, y la cabecera de la hoja dice literalmente `"Canjear ×"` — **sin saldo**. Estás decidiendo una compra sin ver cuánto tenés.

**(c) La tienda no te dice qué podés pagar.** Verificado: los cuatro `[data-comprar]` reportan `disabled: false` sin importar el saldo. Tocás, y recién ahí `aviso('Te faltan monedas')` (`main.js:293`) durante 1.7 segundos. Es un toque muerto, y encima el aviso no dice cuánto falta.

### 7.3 Qué eliminar, concretamente

**→ Eliminar los pasos 1 a 5 de un solo cambio: comprar desde el botón del poder.**

Este es el cambio grande y es barato. Dos ediciones:

1. **Sacar `precios` de adentro de `comprar()`** (`game.js:304`) y exportarlo a nivel de módulo. Hoy la interfaz **no tiene de dónde leer un precio** — por eso `index.html:140,145,150,155` los tiene escritos a mano y duplicados. Este es el bloqueador técnico real.
2. En `pintarMarcadores()` (`main.js:80-95`), cambiar la regla del `disabled`:
   ```
   si tenés unidades      → botón activo, la .cuenta muestra el número
   si tenés 0 y te alcanza → botón ACTIVO, la .cuenta muestra el precio ("35 ◈")
   si tenés 0 y no alcanza → disabled, la .cuenta muestra cuánto falta ("−12")
   ```
   Y en el handler (`main.js:543-557`), si `!estado.poderes[tipo]`, llamar a `comprar()` y, si sale bien, seguir de largo a `apuntando = tipo`.

**Resultado: 2 toques (comprar+apuntar, y objetivo) en vez de 7.** La tienda deja de ser el camino principal y pasa a ser el lugar donde comprás de a varios.

**→ Eliminar el scroll: subir los poderes al lado del tablero.**

`.panel` mide 271 px de alto y arranca en 701, con el tablero terminando en 726. Tres opciones, en orden de preferencia:

1. **Convertir los tres poderes en chips compactos dentro de `.tablero-cabeza`** (`index.html:76-83`, donde ya viven el "8 × 8" y el contador de combo). Un chip de icono + contador ocupa ~44 px contra los 271 del panel, y queda **pegado arriba del tablero**, en el mismo golpe de vista que el objetivo. Los textos descriptivos ("Revienta un 3×3 donde toques") son copia de tutorial que solo importa la primera vez, y ya se muestran igual en el `aviso` al apuntar (`main.js:551`).
2. `position: sticky; bottom: 0` sobre `.panel`.
3. Mover `<section class="panel">` antes de `<section class="tablero-marco">` en el HTML — funciona, pero empuja el tablero más abajo todavía.

**→ Arreglos de un renglón cada uno:**

- **Cerrar la tienda al comprar.** `main.js:575-583`, agregar `$('capa-tienda').hidden = true` cuando `compro` es true. Elimina el paso 4.
- **Poner el saldo en la cabecera de la tienda.** `index.html:133-136`, junto al `<h2>Canjear</h2>`, y actualizarlo desde `pintarMarcadores()`.
- **Deshabilitar los artículos que no podés pagar**, con el faltante visible en vez del aviso de 1.7 s.
- **Un solo origen de precios.** Que `index.html` no traiga números escritos a mano: pintar los `.precio` desde la tabla exportada.

**→ Que apuntar se pueda cancelar y que no se desperdicie.**

- Estando en modo `apuntando`, **cualquier** toque en el tablero dispara el poder (`main.js:510-523`). No hay confirmación ni deshacer. El único cancelar es volver a tocar el mismo botón, y el aviso que lo explicaría desaparece a los 1.7 s (`main.js:61`). Fijar el texto de estado mientras dure el modo ("Elegí el objetivo · tocá el poder otra vez para cancelar") y tratar un toque fuera del tablero como cancelar.
- **No consumir el poder si no había nada que romper.** En `usarPoder` (`game.js:224`), si ninguna celda del objetivo está ocupada, devolver `{ tipo: 'rechazado', razon: 'nada-que-romper' }` sin descontar ni sumar los 80 puntos. **El criterio ya existe en el propio archivo**, en `usarLampara` (`game.js:293-296`).

**→ Abrir la ventana donde el revólver sirve.**

En `game.js:193`, antes de fijar `terminada = true`, si el jugador puede pagar un revólver, emitir un suceso `{ tipo: 'sin-movidas' }` en lugar de `fin-del-juego`, y que `main.js` ofrezca **"Mano nueva por 35 ◈"** junto a **"Terminar"**. Hoy `#capa-fin` (`position: fixed; inset: 0`, sin `pointer-events: none` a diferencia de `capa-jefe` y `capa-limpio`) tapa la tienda y cierra la puerta. Es el cambio que más se parece a lo que pediste con "que no seas cruel": nadie pierde teniendo en el bolsillo el botón que lo salvaba.

---

## 8. Orden de implementación sugerido

Por relación impacto/esfuerzo, medida contra los números de arriba:

1. **Exportar `precios` desde `game.js` + comprar desde el botón del poder** (`main.js:80-95` y `543-557`). Convierte 7 pasos en 2 y desbloquea las 1241 monedas paradas. Es el cambio que más mueve la aguja y ninguno de los otros luce sin él.
2. **Poderes compactos arriba del tablero** (`index.html:76-83`). Elimina 332 px de scroll.
3. **Precios nuevos** (lámpara 20, bomba 35, rayo 45, revólver 35). Una línea.
4. **Consuelo 1→3 y bono de nivel 50→20** (`scoring.js:17` y `scoring.js:67`). Baja las partidas-sin-nada del 50.8% al 2.5%.
5. **Pagar por los jefes** (+40 entrar, +40 vencer, +80 cuota) y **agregar los `case` de cuota que faltan** en `procesar()`. Es una mecánica entera que hoy existe en el motor y no llega a la pantalla.
6. **No cobrar un poder que no rompió nada** (`game.js:224`) y **cancelar mientras apuntás**.
7. **Ventana de "mano nueva" antes de perder** (`game.js:193` + `main.js`).
8. **`monedasPorLineas` cuadrático** (`scoring.js:17`). El de menor impacto medido (+7 monedas por partida), pero alinea las monedas con los puntos y hace memorable la jugada grande.

---

## Apéndice — cómo reproducir estos números

- **Modelo analítico y simulaciones:** scripts en el scratchpad de la sesión, importando directamente `src/engine/scoring.js`, `src/engine/game.js`, `src/engine/board.js` y `src/engine/pieces.js`. El jugador "bueno" usa `buscarConsejo()` — la propia heurística de la lámpara del juego — así que no es un óptimo teórico sino el techo que el juego mismo le enseña al jugador. El jugador "casual" elige uniformemente entre las jugadas válidas.
- **Mediciones de layout:** `getBoundingClientRect` y `document.elementFromPoint` sobre el servidor de desarrollo en `localhost:5180`, viewports 375×812 y 390×664.
- **Guardado real:** `localStorage['nova-blocks-v1']` = `{"mejor":5960,"monedas":1241}`. Es el perfil del navegador de pruebas; tomarlo como señal fuerte de que las monedas se acumulan sin gastarse, no como muestra estadística.
- **Advertencia sobre las simulaciones:** el jugador simulado **nunca compra ni usa poderes**, porque el objetivo era medir el ingreso a poderes constantes. Con poderes más baratos las partidas se alargan y el ingreso real va a ser mayor que el proyectado. Los recortes de precio están puestos conservadores por eso.
