# Análisis de Game Design: Nova Blocks vs. Block Blast
*Diagnóstico de Jugabilidad, Feedback Visual/Sonoro y Retención Casual*

## Contexto y Diagnóstico Actual
Nova Blocks cuenta con una base técnica sólida en PixiJS y HTML (motor determinista, sistema de eventos síncrono en `src/engine/game.js`, 6 jefes con mecánicas cambiantes y 3 temas visuales). Sin embargo, Bryan nota que en su iPhone el juego no genera el enganche ni la adicción de **Block Blast**.

En los juegos de bloques casuales, la adicción no proviene de la complejidad de las reglas, sino del **bucle de retroalimentación sensorial continua (juiciness)**: estímulos visuales, sonoros y táctiles que recompensan inmediatamente cada acción y generan picos de dopamina.

---

## Las 10 Mejoras de Enganche (Priorizadas por Impacto / Esfuerzo)

### 1. Banners Enormes de Elogio Escalado ("GOOD!", "GREAT!", "EXCELLENT!", "UNBELIEVABLE!")
- **Qué hace Block Blast**: Muestra textos animados gigantes en el centro del tablero ("GOOD!", "GREAT!", "EXCELLENT!", "UNBELIEVABLE!", "PERFECT!") con animación pop-in de escala 3D, destellos dorados y partículas al limpiar 2+ líneas o lograr combos altos.
- **Qué tiene Nova Blocks hoy**: Solo muestra un texto discreto en la parte inferior HTML (`#estado`) que dice `Se van 2 líneas` o `1 línea fuera`, junto con el flotante estático `+1,120`.
- **Especificación exacta**:
  - **Mensaje**: 2 líneas -> "GOOD!", 3 líneas -> "GREAT!", 4 líneas -> "UNBELIEVABLE!", Combo ≥ 3 -> "EXCELLENT!".
  - **Duración**: 800 ms (aparece disparado con escala 0.2 -> 1.3 en 200 ms, flota 400 ms y se desvanece en 200 ms).
  - **Sonido**: Arpegiado brillante de sintetizador rápido de 3 notas con eco corto.
- **Disparador en código (`src/engine/game.js`)**:
  - Suceso: `lineas-limpiadas` (`s.cantidad >= 2` o `s.combo >= 3`). Manejado en `src/main.js` en el `switch (s.tipo)` bajo `case 'lineas-limpiadas':`.

---

### 2. Escala Sonora Arpegiada por Combo Continuo (Pitch Ascendente por Racha)
- **Qué hace Block Blast**: Cada jugada consecutiva que destruye bloques (Combo x1, x2, x3...) eleva la nota base del efecto de sonido en la escala musical (Do -> Re -> Mi -> Fa -> Sol -> La...). El jugador busca encadenar jugadas para escuchar tonos cada vez más agudos y victoriosos.
- **Qué tiene Nova Blocks hoy**: `Sonido.limpiar(lineas, semis)` ajusta la nota únicamente según la *cantidad de líneas* de la jugada actual. Encadenar 5 jugadas seguidas de 1 línea produce exactamente el mismo tono grave en cada turno.
- **Especificación exacta**:
  - **Fórmula de Tono**: `hzBase = BASE * Math.pow(2, (s.combo * 2) / 12)` (sube 2 semitonos por cada nivel de combo acumulado).
  - **Sonido**: Envolvente `triangle` + armónico `sine` brillante escalando hasta Combo x8.
  - **Duración**: 180 ms por tono.
- **Disparador en código (`src/engine/game.js`)**:
  - Suceso: `lineas-limpiadas` (`s.combo`). Enviado en `src/main.js` como parámetro a `sonido.limpiar(s.cantidad, s.combo)`.

---

### 3. Brillo Pre-Clear Pulse (Visualización Premonitoria de Líneas a Romper)
- **Qué hace Block Blast**: Al arrastrar una pieza y posicionarla sobre un lugar que completará una fila o columna, esas celdas completas parpadean y brillan intensamente ("glow pulse") ANTES de soltar el dedo, anticipando la satisfacción de destruirlas.
- **Qué tiene Nova Blocks hoy**: `previsualizarEn` dibuja la silueta de la pieza en el canvas PixiJS, pero las celdas del tablero que están por ser destruidas no alteran su brillo ni su animación.
- **Especificación exacta**:
  - **Efecto**: Si `p.lineas.cantidad > 0`, las celdas en `p.lineas.celdas` se renderizan con un pulso de opacidad (0.5 a 1.0 a 12Hz) y un borde resplandeciente blanco en `src/render/stage.js`.
  - **Duración**: Mientras el dedo sostenga la pieza sobre esas celdas válidas.
  - **Sonido**: Tono continuo de baja intensidad (hum armónico agudo de 520Hz) mientras se mantenga el encaje.
- **Disparador en código (`src/engine/game.js`)**:
  - Función `previsualizar(estado, indicePieza, celda)`. Consumido en `src/main.js` dentro de `previsualizarEn()` hacia `escenario.pintarPreview()`.

---

### 4. Rebalanceo de Poderes: Economía Rápida (1-Tap & Precios Bajos)
- **Qué hace Block Blast / Puzzles Casuales**: Los poderes son baratos (se financian con 2-3 jugadas buenas) y de uso instantáneo con 1 solo tap para mantener el flujo constante de juego.
- **Qué tiene Nova Blocks hoy**: Bomba cuesta 40 monedas, Rayo 60, Lámpara 50, Revólver 80. Con 1 moneda por jugada sin líneas o 8 monedas por línea, requiere ahorrar durante decenas de jugadas. Además, Bomba y Rayo exigen 2 taps (activar botón + tocar tablero).
- **Especificación exacta**:
  - **Nuevos Precios**: Bomba: 15 monedas | Rayo: 20 monedas | Revólver (refrescar piezas): 10 monedas | Lámpara: 12 monedas.
  - **Uso 1-Tap**: Tocar el botón de Rayo destruye automáticamente la fila con más bloques ocupados sin obligar a apuntar; el Revólver recambia las 3 piezas inmediatamente.
  - **Sonido**: `sonido.poder()` inmediato con destello de pantalla.
- **Disparador en código (`src/engine/game.js`)**:
  - Modificar objeto `precios` en `comprar(estado, articulo)` dentro de `src/engine/game.js` y ajustar invocaciones en `src/main.js`.

---

### 5. Hitstop / Frame Freeze en Explosiones Múltiples (Sensación de Impacto)
- **Qué hace Block Blast**: Al romper 3 o 4 líneas de golpe o lograr un combo alto, la animación del tablero se congela por 60 a 90 ms justo antes de fragmentar los bloques. Este congelamiento táctico ("Hitstop") transmite una sensación de peso físico demoledor.
- **Qué tiene Nova Blocks hoy**: La animación de fragmentación e hiper-partículas arranca inmediatamente sin ninguna pausa.
- **Especificación exacta**:
  - **Efecto**: Pausar `app.ticker.stop()` en PixiJS durante 80 ms si `cantidad >= 3`. Transcurridos los 80 ms, reanudar el ticker y disparar el sistema de `Explosiones`.
  - **Duración**: 60 ms para 2 líneas, 90 ms para 3+ líneas.
  - **Sonido**: Golpe de sub-bajo (sub-bass drop en 55Hz) durante el micro-congelamiento.
- **Disparador en código (`src/engine/game.js`)**:
  - Suceso: `lineas-limpiadas` (`s.cantidad >= 3`). Manejado en `src/main.js`.

---

### 6. Relámpago Láser de Barrido Horizontal / Vertical
- **Qué hace Block Blast**: Al completar una fila o columna, un rayo láser/eléctrico atraviesa la línea de extremo a extremo un instante antes de que los bloques se conviertan en partículas.
- **Qué tiene Nova Blocks hoy**: En `reventarCeldas`, cada bloque simplemente revienta lanzando partículas cuadradas individuales.
- **Especificación exacta**:
  - **Efecto**: Renderizar un `Graphics` en PixiJS en forma de haz luminoso horizontal o vertical de 4px de grosor que se expande del centro hacia las orillas en 150 ms.
  - **Duración**: 150 ms.
  - **Sonido**: Sweep de ruido filtrado (efecto "laser zap" de alta frecuencia).
- **Disparador en código (`src/engine/game.js`)**:
  - Suceso: `lineas-limpiadas` (`s.filas`, `s.columnas`). Implementado en `src/render/stage.js` dentro de `reventarCeldas()`.

---

### 7. Vignette de Advertencia de Peligro ("Danger Vignette")
- **Qué hace Block Blast**: Cuando el tablero se llena (más del 80% ocupado) o las piezas actuales no caben fácilmente, los bordes de la pantalla laten con una sombra roja tenue, elevando drásticamente la tensión y la adrenalina.
- **Qué tiene Nova Blocks hoy**: No existe ninguna alerta visual de peligro. El jugador simplemente se topa de golpe con la pantalla de `fin-del-juego`.
- **Especificación exacta**:
  - **Efecto**: Gradiente radial rojo en los bordes de la pantalla (`vignette`) pulsando con animación CSS a 1.5 Hz cuando el tablero tenga ≥ 48 celdas ocupadas de 64.
  - **Duración**: Continua mientras el tablero se mantenga en estado crítico.
  - **Sonido**: Pulso rítmico grave (60Hz) estilo latido de corazón cada 1 segundo.
- **Disparador en código (`src/engine/game.js`)**:
  - Evaluar la ocupación del tablero en `jugar()` y emitir el suceso `{ tipo: 'estado-peligro', enPeligro: true/false }`.

---

### 8. Proyectiles de Puntos Voladores hacia la Barra de UI ("Score Flying Orbs")
- **Qué hace Block Blast**: Al romper bloques, las cifras de puntos y monedas no solo se muestran como texto flotante, sino que se convierten en pequeñas partículas de luz que vuelan desde el lugar de la explosión hacia la barra de puntuación superior.
- **Qué tiene Nova Blocks hoy**: `flotarPuntos` eleva un texto HTML `+1,120` verticalmente que se desvanece en su posición original.
- **Especificación exacta**:
  - **Efecto**: Generar 3 a 5 orbes luminosos que viajan en trayectoria curva (Bézier) desde la celda destruida hasta las coordenadas de `#puntaje` en 450 ms. Al impactar, el marcador hace un salto de escala (`scale(1.2)`).
  - **Duración**: 450 ms de trayecto.
  - **Sonido**: Secuencia rápida de 3 "clinks" cristalinos agudos al impactar el marcador.
- **Disparador en código (`src/engine/game.js`)**:
  - Suceso: `lineas-limpiadas` (`s.puntos`) y `colocada`.

---

### 9. Aura de Fuego / Chispas en el Marco durante Rachas (Streak Flame)
- **Qué hace Block Blast**: Mantener un combo activo enciende los bordes del tablero con llamas o auras eléctricas con partículas que flotan constantemente.
- **Qué tiene Nova Blocks hoy**: El combo solo se indica con el texto `×2` o `×3` en un elemento HTML pequeño arriba del tablero (`#combo`).
- **Especificación exacta**:
  - **Efecto**: Si `estado.combo >= 3`, aplicar una clase CSS `.en-racha` al contenedor del tablero que añade un resplandor dorado/azul con emisión continua de pequeñas partículas de chispa en PixiJS.
  - **Duración**: Mientras `estado.combo >= 3`.
  - **Sonido**: Crepitar sutil de energía al entrar en racha alta.
- **Disparador en código (`src/engine/game.js`)**:
  - Suceso: `lineas-limpiadas` (`s.combo >= 3`) y `combo-cortado`.

---

### 10. Optimización Háptica Web (iOS Safari Haptic Feedback Fix)
- **Qué hace Block Blast**: En aplicaciones nativas de iOS utiliza `UIImpactFeedbackGenerator` con respuesta táctil diferenciada (ligera, media, pesada).
- **Qué tiene Nova Blocks hoy**: En `src/audio/sfx.js`, `Sonido.pulso(ms)` usa `navigator.vibrate()`. **En iOS Safari (el iPhone de Bryan), `navigator.vibrate` está deshabilitado por Apple**, por lo que Bryan experimenta cero vibración háptica al jugar.
- **Especificación exacta**:
  - **Solución Web iOS**: Generar impulsos auditivos subsónicos de baja frecuencia (40Hz - 50Hz) con pico de presión en WebAudio que simulan vibración en los altavoces del iPhone, combinados con micro-botes de cámara (temblor de 2px).
  - **Escalamiento**: Colocar ficha -> micro-shake 2px | 1 línea -> shake 4px | 3+ líneas -> shake 8px con sub-bajo.
- **Disparador en código (`src/engine/game.js`)**:
  - Suceso: `colocada`, `lineas-limpiadas`, `poder-usado`. Integrado en `src/audio/sfx.js` y `src/render/effects.js`.

---

## Tabla de Priorización (Impacto en Adicción / Esfuerzo de Implementación)

| Prioridad | Elemento | Impacto en Adicción | Esfuerzo de Implementación | Ratio ROI | Disparador Exacto en `src/engine/game.js` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Banners Enormes de Elogio** ("GOOD!", "GREAT!", "UNBELIEVABLE!") | 🔥🔥🔥🔥🔥 (Muy Alto) | ⚡ (Bajo - Overlay HTML/CSS) | **Máximo** | `lineas-limpiadas` (`s.cantidad >= 2` o `s.combo >= 3`) |
| **2** | **Economía Rápida de Poderes** (Precios 10-20, 1-Tap) | 🔥🔥🔥🔥🔥 (Muy Alto) | ⚡ (Bajo - Cambio en `game.js` / `scoring.js`) | **Máximo** | `usarPoder`, `comprar` |
| **3** | **Arpegio de Pitch por Combo** (Sonido escalado por racha) | 🔥🔥🔥🔥 (Alto) | ⚡ (Bajo - Modificar `sfx.js`) | **Muy Alto** | `lineas-limpiadas` (`s.combo`) |
| **4** | **Brillo Pre-Clear Pulse** (Feedback antes de soltar) | 🔥🔥🔥🔥 (Alto) | ⚡⚡ (Medio - Canvas preview en `stage.js`) | **Alto** | `previsualizar()` en `main.js` |
| **5** | **Hitstop / Frame Freeze** (Pausa de impacto 80ms) | 🔥🔥🔥🔥 (Alto) | ⚡ (Bajo - Pausa Ticker en `main.js`) | **Alto** | `lineas-limpiadas` (`s.cantidad >= 3`) |
| **6** | **Danger Vignette** (Advertencia de peligro) | 🔥🔥🔥 (Medio-Alto) | ⚡ (Bajo - CSS overlay + check celdas) | **Alto** | `colocada` / `rellenarSiHaceFalta` |
| **7** | **Relámpago Láser Barrido** | 🔥🔥🔥 (Medio-Alto) | ⚡⚡ (Medio - PixiJS `Graphics` en `stage.js`) | **Medio-Alto** | `lineas-limpiadas` (`s.filas`, `s.columnas`) |
| **8** | **Proyectiles Voladores de Puntos** | 🔥🔥🔥 (Medio) | ⚡⚡ (Medio - Animación Bézier) | **Medio** | `lineas-limpiadas` (`s.puntos`) |
| **9** | **Aura de Fuego en Rachas** (Streak Flame) | 🔥🔥🔥 (Medio) | ⚡⚡ (Medio - CSS animation en tablero) | **Medio** | `lineas-limpiadas` (`s.combo >= 3`) |
| **10** | **Optimizador Háptico iOS** (Sub-bajo + micro-shake) | 🔥🔥🔥 (Medio) | ⚡⚡ (Medio - `sfx.js` + `effects.js`) | **Medio** | `colocada`, `lineas-limpiadas` |

---

## Qué NO Agregar (y por qué)

1. **Popups Modales Intrusivos de "¡Felicitaciones!" que Pausen el Juego**:
   - *Por qué NO*: Interrumpen el estado de "flow" (concentración inmersiva). El jugador de Block Blast quiere colocar piezas sin pausas forzadas. Si cada 30 segundos se abre un modal exigiendo tocar "Continuar", la adicción se convierte en molestia.
2. **Temblor de Pantalla (Screen Shake) Exagerado en Fichas Comunes**:
   - *Por qué NO*: Sacudir la pantalla al colocar un bloque simple de 1x1 causa desensibilización sensorial y fatiga visual rápida. El temblor debe ser una recompensa exclusiva para 3+ líneas o uso de bomba.
3. **Ruletas de la Fortuna / Lootboxes Intermedias Forzadas**:
   - *Por qué NO*: Rompen el ritmo de juego y se sienten farsa comercial. Las recompensas deben ganarse dentro del propio tablero con maestría en el juego (como el bonus de 2000 puntos por tablero limpio existente).
4. **Voces Humanas Estridentes o Efectos Cartoon Chillones**:
   - *Por qué NO*: Se vuelven insoportables tras 5 minutos de uso continuo con audífonos. El paisaje sonoro sintetizado de Nova Blocks es limpio y elegante; solo requiere dinamismo armónico y tono ascendente, no voces caricaturescas.
