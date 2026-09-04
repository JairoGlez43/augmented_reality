# Roadmap: Realidad Aumentada desde cero

## Qué vamos a construir

Un sistema de **AR basada en marcadores** que corre en el navegador:

apuntas la cámara a un marcador impreso (un cuadrado blanco y negro tipo ArUco) y
sobre él aparece un objeto 3D **pegado al papel**, que se mueve, gira y cambia de
tamaño de forma correcta cuando mueves la cámara.

Todo el pipeline lo escribimos nosotros. Sin OpenCV.js, sin AR.js, sin ARToolkit.

## El pipeline completo (la foto grande)

Esto es lo que ocurre **60 veces por segundo**. Memorízalo: cada fase del roadmap
es una caja de este diagrama.

```
[cámara] -> frame RGBA
    |
    v
[1] escala de grises            ..... 1 canal en vez de 4
    |
    v
[2] umbralizado adaptativo      ..... blanco/negro puro, robusto a sombras
    |
    v
[3] contornos -> polígonos      ..... "aquí hay un cuadrilátero"
    |
    v
[4] homografía + unwarp         ..... enderezar el cuadrilátero a 64x64 px
    |
    v
[5] decodificar bits            ..... "es el marcador #23, rotado 90 grados"
    |
    v
[6] estimación de pose          ..... R|t: dónde está el papel respecto a la cámara
    |
    v
[7] render 3D                   ..... pintar con esa misma cámara virtual
    |
    v
[8] filtrado temporal           ..... que no tiemble
```

Los pasos 1-5 responden a **"¿qué veo y dónde está en la imagen?"** (visión 2D).
El paso 6 es el corazón del AR: **"¿dónde está en el mundo 3D?"**.
El paso 7 es la recompensa visual.

---

## Fases

Cada fase es una rama/commit, tiene un entregable visible y unos conceptos que
hay que entender de verdad, no copiar.

### Fase 0 — Captura y bucle de proceso ✅
**Entregable:** la cámara en pantalla, con un bucle que lee píxeles cada frame y
un HUD que mide milisegundos y FPS.

**Conceptos:** `getUserMedia`, secure context, `<canvas>` y `ImageData`, una
imagen como `Uint8ClampedArray` plano en orden RGBA, resolución de captura vs
resolución de proceso, `requestAnimationFrame`, presupuesto de 16.6 ms/frame.

### Fase 1 — Procesamiento de imagen
**Entregable:** vista en blanco y negro limpia del marcador con cualquier
iluminación (sombra, contraluz, foco lateral).

**Conceptos:** luma y por qué los coeficientes no son 1/3, histograma, umbral
global vs **umbral adaptativo**, **imagen integral** (summed-area table) para que
el umbral adaptativo sea O(1) por píxel, morfología (erosión/dilatación).

### Fase 2 — Contornos y cuadriláteros
**Entregable:** overlay que dibuja en verde los 4 vértices de todo cuadrilátero
que encuentra en la escena.

**Conceptos:** conectividad 4 vs 8, seguimiento de bordes (border following,
Suzuki–Abe simplificado), **Douglas–Peucker** para aproximar un contorno de 400
puntos a un polígono de 4, convexidad, área con signo (fórmula del cordón /
shoelace), orientación horaria vs antihoraria, filtros de descarte.

### Fase 3 — Homografía
**Entregable:** el cuadrilátero detectado aparece "enderezado" en un recuadro de
64x64 px, como si lo miraras de frente.

**Conceptos:** **coordenadas homogéneas** y por qué el 3x3 con 8 grados de
libertad, **DLT** (Direct Linear Transform), normalización de Hartley, resolver
Ax=0, implementar SVD/Jacobi propio, warp inverso + muestreo bilineal.

> Esta fase es el primer muro matemático real. Es también la más reutilizable:
> la homografía aparece en panorámicas, escáneres de documentos y en la Fase 10.

### Fase 4 — Decodificación del marcador
**Entregable:** el sistema dice "marcador ID 23, rotación 90°" y descarta
cuadriláteros que no son marcadores (ventanas, folios, azulejos).

**Conceptos:** rejilla de bits, borde de quiet zone, diccionario tipo ArUco,
**distancia de Hamming** y corrección de errores, resolución de la ambigüedad de
rotación (4 orientaciones → una sola canónica), generador de marcadores
imprimibles en SVG.

### Fase 5 — Calibración de cámara
**Entregable:** un `calibration.json` con la matriz K de *tu* cámara, obtenido
con un tablero de ajedrez impreso.

**Conceptos:** modelo **pinhole**, distancia focal en píxeles, punto principal,
matriz intrínseca K, distorsión radial y tangencial, método de Zhang,
optimización no lineal. Incluye un atajo pragmático (estimar el FOV) para no
bloquear las fases siguientes.

### Fase 6 — Estimación de pose (el corazón)
**Entregable:** tres ejes XYZ dibujados sobre el marcador que giran con él.

**Conceptos:** sistemas de coordenadas (mundo → cámara → imagen), la relación
`H = K·[r1 r2 t]`, extraer R y t de la homografía, **ortonormalizar** R (matriz
de rotación válida), la ambigüedad de pose planar y cómo desempatarla,
refinamiento por **Gauss–Newton** minimizando el error de reproyección.

### Fase 7 — Render 3D alineado
**Entregable:** un cubo (y luego un modelo glTF) plantado sobre el papel.

**Conceptos:** construir la **matriz de proyección de OpenGL a partir de K**,
convención de ejes (OpenCV mira a +Z, OpenGL a -Z), near/far, matriz de vista
desde R|t, pipeline WebGL a pelo (shaders, buffers, depth test) y después el
mismo resultado con Three.js. Extras: sombra de contacto y oclusión.

### Fase 8 — Estabilidad y tracking
**Entregable:** el objeto deja de vibrar y sobrevive a que el marcador se
oculte parcialmente.

**Conceptos:** refinamiento **subpíxel** de esquinas (intersección de rectas o
gradiente), filtro **One Euro** (por qué es mejor que un promedio móvil), tracking
frame-a-frame en vez de re-detectar todo, histéresis y gestión de pérdida.

### Fase 9 — Rendimiento
**Entregable:** 60 fps estables en móvil, con presupuesto medido por etapa.

**Conceptos:** **Web Workers** y `Transferable`/`SharedArrayBuffer`, evitar
allocations en el hot loop (buffers reutilizados), preprocesado en GPU con
shaders, `WebCodecs`/`requestVideoFrameCallback`, cuándo compensa WASM.

### Fase 10 — Markerless (nivel avanzado)
**Entregable:** AR sobre una **imagen natural** (la portada de un libro) en vez
de un marcador binario.

**Conceptos:** detector de esquinas **FAST**, descriptor **BRIEF/ORB**, matching
por Hamming, **RANSAC** para homografía robusta, y comparación honesta con lo
que hace WebXR / ARCore (SLAM) y por qué eso es otro nivel de complejidad.

### Fase 11 — Producto y portafolio
**Entregable:** demo desplegada con HTTPS, README con GIF, marcadores
descargables, tests, benchmarks y un artículo explicando las matemáticas.

---

## Reglas de trabajo

1. **Nada de copiar sin entender.** Si una fase tiene matemáticas, primero el
   porqué, después el código.
2. **Cada primitiva matemática lleva test.** Homografía, decodificación y pose se
   validan con casos sintéticos donde sabemos la respuesta correcta.
3. **Todo paso intermedio es visualizable.** El depurador de visión por
   computador es *mirar la imagen*. Cada fase añade su vista de debug.
4. **Optimizar al final.** Primero correcto y legible, luego rápido (Fase 9).
