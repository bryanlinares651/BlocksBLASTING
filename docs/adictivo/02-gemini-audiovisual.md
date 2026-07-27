# Diagnóstico y Propuesta Audiovisual — Nova Blocks

**Rol:** Diseñador de Sonido y VFX Senior para Juegos Móviles  
**Proyecto:** Nova Blocks (PixiJS + WebAudio API)  
**Objetivo:** Elevar el feedback auditivo y visual ("game feel / juice") al romper líneas para alcanzar el nivel de satisfacción táctil de *Block Blast*.

---

## 1. Diagnóstico del Sistema de Sonido Actual y Mejoras de Síntesis

### Código Auditado en `src/audio/sfx.js`
El motor actual sintetiza sonido en tiempo real usando WebAudio API sin archivos externos (`AudioContext`, `OscillatorNode` y `AudioBuffer` de ruido blanco).
El sonido central de destrucción de líneas es `limpiar(lineas, semis)`:
- Genera una ráfaga de ruido filtrado en banda (`bandpass` entre 900 Hz y 2900 Hz).
- Genera un tono fundamental (`triangle`) en la nota base `BASE = 320 Hz` (Mi4 / E4).
- Agrega un tono secundario a intervalo de quinta (+7 semitonos = 479.5 Hz).
- Si `lineas >= 3`, añade la octava superior (+12 semitonos).
- Si `lineas >= 4`, añade la tercera mayor arriba de la octava (+16 semitonos).

---

### ¿Por qué romper líneas NO da gusto actualmente? (Deficiencias de síntesis)

1. **Ausencia de Impacto Sub-Grave (Sub-Transient / Thump):**
   - La frecuencia base arranca en `320 Hz` (rango medio/alto). Carece por completo de cuerpo en la banda de 45 Hz – 90 Hz. Sin cuerpo grave, la ruptura suena "fina" y de juguete en parlantes de celular.
   - **Solución WebAudio:** Agregar una capa de sub-grave con un oscilador senoidal (`sine`) que descienda rápidamente de 130 Hz a 40 Hz en 70 ms con envolvente exponencial (`exponentialRampToValueAtTime`).

2. **Ataque Plano y Carente de "Snap" o "Pop" Plástico:**
   - La envolvente actual tiene un ataque gradual de 5 ms (`gan.gain.exponentialRampToValueAtTime(volumen, t + ataque)`). Romper un bloque requiere un transitorio crujiente (click/pop) en los primeros 1-2 ms.
   - **Solución WebAudio:** Un oscilador senoidal a 2200 Hz bajando en picada a 300 Hz en solo 6 ms a volumen alto, o un pulso de ruido con filtro paso alto (`highpass` > 4000 Hz) de 3 ms en $t=0$.

3. **Simultaneidad Acústica Plana (Sin Micro-Desfasaje):**
   - Cuando se limpia una fila de 8 bloques, las notas y el ruido disparan exactamente en el mismo instante ($t = 0$). Se percibe como un único pitido sintetizado en vez de la destrucción en cadena de múltiples bloques.
   - **Solución WebAudio:** Escalonar el disparo de frecuencia/ruido con un retraso secuencial de $i \times 12\text{ ms}$ a $18\text{ ms}$ según la posición horizontal/vertical de cada celda en la fila.

4. **Sonidos Secundarios Apagados o Inexistentes:**
   - **Colocación (`colocar()`):** Es un tono triángulo de 180 Hz bajando 60 Hz. Le falta un "click" agudo táctil (bloque encajando) y una pequeña resonancia grave.
   - **Corte de Racha (`combo-cortado`):** No produce sonido alguno. Perder una racha debe dar un "thud" o tono descendente sordo que alerte al jugador.
   - **Preview/Arrastre:** No hay retroalimentación sonara al sobrevolar posiciones donde una línea se va a completar.

---

## 2. Sonido de Recompensa Ascendente (Sistema de Combos)

### Verificación del Código Real
- En `src/audio/sfx.js`, la función `semitonos(hz, n)` existe y `limpiar(lineas, semis)` acepta el argumento `semis`.
- **EL PROBLEMA DETECTADO:** En `src/main.js` (línea 236):
  ```javascript
  const fuerza = intensidad(s.cantidad);
  sonido.limpiar(s.cantidad, fuerza.semitonos);
  ```
  La variable `fuerza.semitonos` proviene de `intensidad(lineas)` en `src/render/theme.js`:
  - 1 línea = 0 semitonos
  - 2 líneas = 3 semitonos
  - 3 líneas = 7 semitonos
  - 4 líneas = 12 semitonos
- **Diagnóstico:** Los semitonos aumentan únicamente según las *líneas limpiadas en un solo movimiento*. **El juego ignora por completo el contador de jugadas consecutivas (`s.combo`) para la afinación del sonido.**
- Si el jugador rompe 1 línea en 5 turnos seguidos (un combo 5x), los 5 sonidos suenan exactamente en la misma nota (320 Hz). En *Block Blast*, cada jugada consecutiva sube un peldaño en la escala musical, generando una sensación progresiva de triunfo.

---

### Propuesta de Mejora (Código WebAudio)

1. **Mapeo a Escala Pentatónica Mayor:**
   Definir la progresión de semitonos según el número de combo encadenado:
   ```javascript
   const ESCALA_COMBO = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // Do, Re, Mi, Sol, La...
   ```
2. **Integración en `main.js`:**
   ```javascript
   const pasoCombo = Math.min((s.combo || 1) - 1, ESCALA_COMBO.length - 1);
   const semitonosTotales = fuerza.semitonos + ESCALA_COMBO[pasoCombo];
   sonido.limpiar(s.cantidad, semitonosTotales, s.combo);
   ```
3. **Evolución Timbrística del Combo:**
   - **Combos 1 a 3:** Onda triangular + seno limpia (tonos cálidos y suaves).
   - **Combos 4 a 6:** Se agrega una quinta armónica y el filtro de ruido se abre (+800 Hz) para dar brillo.
   - **Combos 7 en adelante:** Disparo de un arpegio ascendente ultra-rápido (3 notas en 60 ms) que culmina en un resplandor de alta frecuencia.

---

## 3. Efectos Visuales Faltantes (Ordenados por Impacto / Esfuerzo)

Auditado contra `src/render/effects.js` (`Explosiones`, `Temblor`, `Destello`) y `src/render/theme.js`:

| # | Efecto Visual | Impacto | Esfuerzo | Especificación Técnica (Animación, Duración y Curva) |
|---|---|---|---|---|
| 1 | **Rayo / Haz de Luz de Fila (Line Beam Flash)** | **Muy Alto** | **Bajo** | Dibuja una barra brillante (`Graphics`) sobre la fila/columna limpia. Anima escala Y de $0 \to 1.5\times$ en 40 ms y alfa de $1.0 \to 0.0$ en 160 ms con curva `CURVAS.salidaFirme`. |
| 2 | **Flash Blanco y "Pop Scale" Pre-Explosión** | **Alto** | **Bajo** | En lugar de desaparecer o convertirse al instante en partículas, las celdas a limpiar se tiñen de blanco puro (`tint = 0xffffff`) y escalan a $1.25\times$ durante 45 ms. Al finalizar este impacto inicial, se disparan las partículas de `reventar()`. |
| 3 | **Desintegración en Cascada (Micro-Stagger)** | **Alto** | **Medio** | Secuenciar la llamada de `reventar()` celda por celda a lo largo de la fila limpia con un retraso lineal de $i \times 18\text{ ms}$. La fila "se desabrocha" visualmente de un extremo a otro en 140 ms. |
| 4 | **Onda de Choque Anular (Shockwave Ring)** | **Medio-Alto** | **Medio** | Anillo expansivo (`Graphics.drawCircle` con trazo de 3px) en el centro geométrico de la ruptura. Radio anima de $0 \to 130\text{px}$ en 280 ms con `CURVAS.salida`, alfa $1.0 \to 0.0$. |
| 5 | **Punch de Escala en Texto Flotante de Puntos** | **Medio** | **Bajo** | Modificar `.puntos-flotantes`: `transform: scale(0.4) \to scale(1.3) \to scale(1.0)` en los primeros 100 ms usando curva `cubic-bezier(0.175, 0.885, 0.32, 1.275)` (efecto rebote), seguido de ascenso vertical de 45px y desvanecimiento en 550 ms. |

---

## 4. El Detalle que Más se Nota y Menos Cuesta

### **"Pitch Ascent por Combo + Flash Blanco Pre-Explosión"**

- **Costo de Implementación:** Menos de 15 líneas de código sumadas entre `src/main.js`, `src/audio/sfx.js` y `src/render/effects.js`.
- **Por qué destaca:**
  1. **El tono ascendente por combo** aprovecha el mecanismo de dopamina del cerebro humano: el jugador anticipa la siguiente nota musical y evita a toda costa romper la racha.
  2. **El flash blanco de 45 ms** le da "peso físico" al bloque antes de romperse; sin ese flash, la partícula parece aparecer de la nada. Con el flash, el bloque parece "explotar bajo tensión".
