# Nova Blocks — Sistema de diseño

## Estrategia de color: Committed

El azul noche no es un fondo neutro donde apoyar cosas: **es el material del juego**. Ocupa
más del 60% de la pantalla y todo lo demás se define contra él. Los colores de las piezas son
la única fuente de luz.

Todo en OKLCH. Ningún neutro es puro: todos van tintados hacia el azul del fondo (hue 265),
porque un gris neutro sobre un fondo tintado se ve sucio.

```css
--noche-honda:   oklch(0.13 0.032 265);  /* fondo, el mas oscuro */
--noche:         oklch(0.17 0.034 265);  /* tablero */
--superficie:    oklch(0.21 0.036 265);  /* paneles, tarjetas de pieza */
--celda:         oklch(0.25 0.032 265);  /* celda vacia */
--borde:         oklch(0.33 0.040 265);
--borde-vivo:    oklch(0.46 0.055 265);
--tinta:         oklch(0.96 0.008 265);  /* texto principal, NO es blanco */
--tinta-suave:   oklch(0.70 0.028 265);  /* etiquetas */
```

### Colores de pieza

Seis, calibrados a lightness y chroma casi iguales, variando solo el tono. Esto es lo que los
hace ver como **un sistema** y no como una bolsa de caramelos: ninguno grita más que otro, y
ninguno se pierde contra el fondo.

```css
--p-rosa:    oklch(0.72 0.170 350);
--p-cyan:    oklch(0.78 0.130 200);
--p-ambar:   oklch(0.81 0.150 85);
--p-violeta: oklch(0.68 0.170 292);
--p-verde:   oklch(0.77 0.155 148);
--p-naranja: oklch(0.73 0.160 45);
```

El ámbar y el verde llevan lightness algo más alta a propósito: a igual número, los amarillos
se perciben más apagados que los rosas. La calibración es perceptual, no aritmética.

### Colores de jefe

Cada jefe tiene el suyo, siempre más saturado que cualquier pieza para que se lea como una
amenaza y no como una ficha más.

```css
--jefe-bloqueador: oklch(0.62 0.215 15);   /* rojo */
--jefe-basurero:   oklch(0.58 0.090 75);   /* pardo apagado */
--jefe-tacano:     oklch(0.82 0.170 92);   /* oro */
--jefe-gigante:    oklch(0.64 0.200 295);  /* violeta electrico */
```

## Tipografía

Una sola familia: la del sistema (`-apple-system` en iPhone). Es un juego, no una marca; el
carácter lo ponen el color y el movimiento, no una tipografía display.

- Números grandes (puntaje, nivel): 700, `font-variant-numeric: tabular-nums`. Sin tabular,
  el puntaje **baila** al cambiar de dígito y se ve barato.
- Etiquetas: 11px, 600, `letter-spacing: 0.08em`, en `--tinta-suave`.
- Nombre del jefe: 800, 26px, `letter-spacing: 0.02em`.
- Escala: 1.2 entre pasos.

## Movimiento

Curvas exponenciales de salida. Nada rebota, nada es elástico.

```css
--salida:       cubic-bezier(0.16, 1, 0.30, 1);   /* expo */
--salida-firme: cubic-bezier(0.22, 1, 0.36, 1);   /* quint */
```

### La escala del golpe

El principio central del producto: **una, dos, tres y cuatro líneas tienen que ser cuatro
sensaciones distintas.** Todo escala junto, no solo el número que sube.

| Líneas | Partículas por bloque | Temblor | Duración | Tono del sonido | Destello |
|---|---|---|---|---|---|
| 1 | 14 | 3 px / 180 ms | 320 ms | base | leve |
| 2 | 20 | 6 px / 240 ms | 380 ms | +3 semitonos | medio |
| 3 | 28 | 10 px / 300 ms | 450 ms | +7 semitonos | fuerte |
| 4+ | 38 | 16 px / 400 ms | 550 ms | +12 semitonos | pantalla completa |

### Otros movimientos

- **Soltar la pieza:** la pieza cae de 1.15 a 1.0 de escala en 180 ms con `--salida-firme`.
  Se asienta, no aparece.
- **Vista previa:** las celdas destino suben a 1.06 y las que se van a limpiar pulsan en el
  color del jefe o en ámbar. 120 ms, tiene que sentirse instantáneo.
- **Entrada del jefe:** oscurecer el tablero 400 ms, el nombre entra desde arriba con su
  color, la regla aparece debajo. 900 ms en total. Es la única secuencia larga del juego y
  se gana el derecho porque cambia las reglas.
- **Borde del jefe:** mientras está activo, un borde de su color late a 2 s de ciclo.

### Reducción de movimiento

Con `prefers-reduced-motion`, las partículas bajan a 3 por bloque, el temblor se elimina y
las duraciones se cortan a la mitad. El juego sigue siendo legible; nadie pierde información
por no ver la explosión.

## Bloques

Un bloque no es un cuadrado de color plano. Tiene:

- Esquinas de 22% del lado.
- Una luz interna arriba (blanco al 22%, degradado a transparente en el 45% de la altura).
- Una sombra proyectada corta y dura hacia abajo, en `--noche-honda`.

Eso es lo que les da peso. Es la diferencia entre "cuadritos de colores" y "piezas".

## Rendimiento

Objetivo: 60 fps en el iPhone de Bryan con 300 partículas simultáneas. Las partículas van en
un solo contenedor de PixiJS con la misma textura, para que se dibujen de una sola pasada.
Sin WebGL disponible, PixiJS cae a Canvas 2D y las partículas bajan a 8 por bloque.
