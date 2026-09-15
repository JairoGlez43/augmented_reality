# CONTEXT.md — La clase completa

> Realidad aumentada desde cero, en TypeScript, sin librerías de visión.
> Este archivo es el temario entero: lo hecho, lo que falta, y cómo se trabaja.
> El estado exacto (dónde estamos ahora) vive en `MEMORY.md`.

---

## Cómo usar este archivo

**Online (con Claude):** Claude lee `MEMORY.md` al empezar, retoma por el punto
exacto, y sigue el método de abajo. Al terminar un paso, actualiza `MEMORY.md`.

**Offline (solo tú):**
1. Mira en `MEMORY.md` el paso en el que estás.
2. Busca ese paso aquí. Lee **Objetivo → Conceptos → Tarea → Pistas**.
3. Intenta implementarlo tú. Compila con `npm run dev` y prueba el criterio ✅.
4. Solo si te atascas, abre el bloque `▶ Solución` de ese paso. Está explicado
   línea a línea. Cópialo, hazlo funcionar, y **después** léelo hasta poder
   explicarlo con tus palabras.
5. Apunta en `MEMORY.md` → "Notas offline" qué hiciste, qué dudas te quedaron y
   dónde te quedaste. Cuando vuelvas online, Claude revisa desde ahí.

**El método (siempre el mismo):**

```
Claude explica el problema y el porqué  →  tú escribes el código
→  pruebas el criterio ✅  →  Claude revisa (bugs, limpieza, rendimiento)
→  commit  →  siguiente paso
```

Si te atascas online: pide **pista 1** (conceptual), **pista 2** (pseudocódigo)
o **pista 3** (snippet mínimo). Si pides "impleméntalo", Claude lo implementa
explicando cada línea y simulando la ejecución.

---

# PARTE I — El proyecto

## Qué construimos

Un sistema de **AR basada en marcadores** que corre en el navegador: apuntas la
cámara a un cuadrado blanco y negro impreso (tipo ArUco) y aparece un objeto 3D
**pegado al papel**, que se mueve con él cuando mueves la cámara.

## El pipeline (60 veces por segundo)

Cada fase del temario es una caja de este diagrama. Memorízalo.

```
[cámara] → frame RGBA
    ↓
[F0] captura → canvas → píxeles          "tengo números"
    ↓
[F1] gris → umbral adaptativo            "tinta o papel, nada intermedio"
    ↓
[F2] contornos → cuadriláteros           "aquí hay un cuadrado"
    ↓
[F3] homografía → unwarp 64×64           "lo veo de frente"
    ↓
[F4] leer bits → ID del marcador         "es el marcador 23, girado 90°"
    ↓
[F5] calibración (K de la cámara)        "así proyecta MI cámara"
    ↓
[F6] pose R|t                            "el papel está AQUÍ en 3D"
    ↓
[F7] render 3D alineado                  "pinto con esa misma cámara"
    ↓
[F8] filtrado / tracking                 "que no tiemble"
    ↓
[F9] rendimiento                         "60 fps en móvil"
    ↓
[F10] markerless (avanzado)              "sin marcador, sobre una foto"
    ↓
[F11] portafolio                         "URL, README, tests"
```

F0–F5 responden **"¿qué veo y dónde está en la imagen?"** (visión 2D).
F6 es el corazón del AR: **"¿dónde está en el mundo 3D?"**.
F7 es la recompensa visual. F8–F11 lo convierten en producto.

## Decisiones técnicas (y por qué)

| Decisión | Motivo |
|---|---|
| **TypeScript + navegador** | Es tu lenguaje fuerte: la dificultad debe estar en la visión y la geometría, no en la sintaxis. El navegador da cámara y GPU gratis. Y el resultado es una **URL**: un reclutador la abre en el móvil y funciona. |
| **Cero librerías de visión** (ni OpenCV.js, ni AR.js) | Esas librerías *son* el proyecto. Usarlas = 40 líneas de pegamento y no aprender nada. |
| **Vanilla DOM, sin React** | La UI es un canvas repintado 60 veces/s y un botón. El ciclo de re-render de React no cabe en 16 ms y no aporta nada. |
| **Vite + `strict: true`** | Plantilla estándar. `strict` obliga a tratar los `null`; `erasableSyntaxOnly` prohíbe `enum`, `namespace` y parameter properties (Vite solo borra tipos, no compila). |
| **Three.js solo al final (F7)** | Primero el render en WebGL a pelo, para entender la matriz de proyección. Three.js después, solo para pintar bonito. |

## Estructura del repo

```
index.html            UI fija: <video> (oculto al final), <canvas>, botón, slider, textos
src/main.ts           estado, renderUI(), el bucle tick(), cableado del DOM
src/camera.ts         startCamera(), stopCamera(), waitForVideoMetadata()
src/cv/               (a partir de F2) módulos de visión: contours, polygon, homography...
CLAUDE.md             cómo trabaja Claude en este repo
CONTEXT.md            este archivo: el temario
MEMORY.md             estado actual: dónde estamos, qué falta, notas
```

---

# PARTE II — Lo hecho

## Fase 0 — Captura y lectura de píxeles ✅

### Qué se construyó
- Botón único que alterna encender/apagar la cámara, con estado `busy`
  mientras espera el permiso.
- `startCamera()` → `MediaStream` → `<video>` → `canvas` → `getImageData()`.
- Bucle con `requestAnimationFrame`, cancelable.
- Lector del brillo del píxel central.

### Conceptos que ya dominas
- **Una imagen es un array plano.** `data` es `Uint8ClampedArray` en orden
  R,G,B,A por píxel. Píxel `(x,y)` → índice `(y * ancho + x) * 4`. Para
  recorrer *todos* no hace falta la fórmula: avanzar de 4 en 4.
- **Un `MediaStream` es el grifo, no el agua.** No tiene píxeles. El `<video>`
  es el único consumidor que decodifica; el canvas es el único puente a los
  números.
- **`srcObject`, no `src`.** `muted` + `playsInline` + `autoplay` obligatorios.
- **Trampa de temporización:** tras asignar `srcObject`, `videoWidth` vale 0
  hasta `loadedmetadata`. Se espera con una promesa, **comprobando antes
  `readyState`** (si el evento ya pasó, no se repite → cuelgue). Y se espera
  **después** de provocar la causa (asignar `srcObject`), nunca antes.
- **Canvas: dos tamaños.** `canvas.width` = búfer de píxeles reales (el que
  importa). `style.width` = tamaño en pantalla. Asignar `canvas.width` borra el
  canvas. Alto derivado del aspect ratio real: `round(640 * vh / vw)`.
- **`getContext("2d", { willReadFrequently: true })`** o cada `getImageData`
  fuerza una copia GPU→CPU.
- **`requestAnimationFrame` se dispara UNA vez.** Es una agenda, no un
  `setInterval`: `tick` se vuelve a apuntar al final. Devuelve un ticket nuevo
  cada vez; `rafId` guarda el último para poder cancelar la única cita viva.
- **`>>`** es desplazar bits a la derecha = dividir entre 2ⁿ truncando.
  `x >> 1` = mitad; `x >> 8` = /256.

### Arquitectura que quedó fijada
- **Estado** (`cameraStream`, `busy`, `statusMessage`, `rafId`) es la única
  verdad. Lo derivable se calcula: "encendida" es `cameraStream !== null`.
- **`renderUI()`** es el único sitio que escribe la UI de control. Solo **lee**
  el estado. Es **idempotente**. Lo que no lo es (`srcObject`) se protege con
  un `if` de igualdad. El canvas es un flujo de datos, no pasa por ahí.
- **Un botón = un `addEventListener`.** El estado se consulta *dentro* del
  handler, nunca para decidir qué handler registrar.
- **Fallar ruidosamente:** `requireElement()` lanza si falta el id. Nada de `?.`
  para tapar cosas que deben existir.
- **`camera.ts` no toca la UI ni captura errores.** Los errores suben a
  `main.ts`, que es quien puede mostrarlos (`DOMException.name` → mensaje).
- **`try/finally`** para restaurar `busy` tanto si funcionó como si falló.

### Bugs que cometiste y lo que enseñaron
| Bug | Lección |
|---|---|
| `.tsx` sin React | JSX no es TS: es sintaxis que se traduce a `React.createElement`. |
| `getUserMedia()` sin argumentos | Rechaza siempre. Ir a la definición (F12) antes que loguear. |
| `stream` como `const` dentro de la función | Quien adquiere un recurso conserva la referencia hasta liberarlo. |
| Encender dos veces → stream huérfano | Fuga de recurso: el LED se queda encendido y nadie puede apagarlo. |
| `if (cameraStream === null)` **fuera** del handler (×3) | Tiempo de registro ≠ tiempo de ejecución. La condición sobre estado va dentro del cuerpo. |
| `cameraStream = null` fuera del handler | Ídem. Y toda variable de estado necesita **todas** sus transiciones. |
| `uiButton()` devolvía el texto y nadie lo escribía | En vanilla, calcular ≠ aplicar. |
| `let srcObject` como estado propio | Es una propiedad del `<video>`. Duplicar = desincronizar. |
| Esperar `loadedmetadata` antes de asignar `srcObject` | Deadlock: no puedes esperar el efecto antes de provocar la causa. |
| `waitForVideoMetadata(...)` sin `await` | La promesa se ignora y el `finally` lee `videoWidth = 0`. |
| `renderUI()` escribía `statusMessage` | Render solo lee. Si escribe estado, el flujo se vuelve circular. |
| `requestAnimationFrame(tick)` a nivel de módulo | Arranca el bucle al cargar, antes de que exista cámara. |
| `TS18047` en `function tick()` | Las declaraciones de función se izan; el estrechamiento del `if/throw` no les llega. Solución: helper que devuelve el tipo no-null. |

---

## Fase 1 — Umbralizado adaptativo ✅

### Qué se construyó
- Pasada 1: RGBA → `grayBuffer` (1 byte/píxel).
- Pasada 2: tabla de sumas acumuladas `integral` (`Uint32Array`).
- Pasada 3: cada píxel se compara con la **media de su ventana 31×31** menos un
  margen `C` (slider). Tinta = 0, papel = 255.
- Tiempo: de **300 ms** (versión ingenua) a **10-11 ms**.

### Conceptos que ya dominas
- **Gris ≠ binario.** Gris son 256 valores sin frontera. Binario son 2, y la
  frontera (donde un 0 toca un 255) **existe** y se puede seguir. F2 la necesita.
- **Luma:** `(77R + 150G + 29B) >> 8`. No la media: el ojo ve el verde como
  ~59% del brillo, el azul ~11%. Los coeficientes son 0.299/0.587/0.114 × 256.
- **Umbral global falla por concepto**, no por afinar mal: el brillo "de
  referencia" del papel es distinto en cada zona de la imagen.
- **Umbral adaptativo:** un píxel es tinta si es *claramente* más oscuro que su
  entorno. `gris < media_ventana − C`. La referencia viaja con el píxel.
- **La ventana debe ser mayor que el trazo** (radio 15 → 31×31). Con 3×3, en
  medio de un trazo todos los vecinos son tinta y la media ≈ el propio píxel.
- **El margen C** evita ruido de sal y pimienta en zonas lisas (por azar, la
  mitad de los píxeles caen bajo su media).
- **Dos buffers:** leer de `gray`, escribir en `data`. Si lees y escribes en el
  mismo, promedias contra vecinos ya binarizados y el error se propaga.
- **Reservar buffers una vez** y reutilizarlos. 230 KB × 60/s = el recolector
  no para.

### La tabla de sumas acumuladas (imagen integral)
`T(x,y)` = suma de todos los píxeles del rectángulo `(0,0)..(x,y)` inclusive.
Se construye en una pasada apoyándose en las tres celdas ya calculadas:

```
T(x,y) = gray(x,y) + T(x−1,y) + T(x,y−1) − T(x−1,y−1)
                     izquierda   arriba    contado dos veces
```
Fuera de la imagen vale 0 ("la suma de una fila que no existe").

Cualquier ventana `x0..x1`, `y0..y1` con **4 lecturas**, sea cual sea el radio:

```
suma = T(x1,y1) − T(x0−1,y1) − T(x1,y0−1) + T(x0−1,y0−1)
       todo       franja izq    franja sup   esquina (restada 2 veces)
```
Los cuatro términos salen de combinar `{x0−1, x1}` × `{y0−1, y1}`. **Ningún
término lleva un 0 ni la coordenada del píxel central.**

Ejemplo verificado (imagen 4×4 con valores 1..16, ventana `x` 1..3, `y` 1..3):
`T(3,3) − T(0,3) − T(3,0) + T(0,0) = 136 − 28 − 10 + 1 = 99` ✓ (= 6+7+8+10+11+12+14+15+16).

**Por qué no bastan 2 lecturas en 2D:** en 1D los prefijos son tramos encajados
y su diferencia es un tramo. En 2D son rectángulos anclados al origen, y la
diferencia de dos es una **L**: hay que cortar por dos lados.

### Bugs y lecciones
| Bug | Lección |
|---|---|
| Coeficientes `0.77, 1.5, 0.29` | Eran /256, no /100. Suman 2.56 → satura. |
| `centerPixel.data` dentro del bucle | ~1 M búsquedas de propiedad por frame. Sacar a `const data`. |
| Ventana 3×3 | Demasiado pequeña: te comparas contigo mismo. |
| `T(x+r,y+r) − T(x−r−1,y−r−1)` | Deja una L, no un rectángulo. |
| `T(0, y)` y `T(x, 0)` como franjas | Las franjas llegan hasta el borde lejano de la ventana (`x1`, `y1`), no hasta el píxel central ni hasta 0. |

---

# PARTE III — Lo que falta

> Las Fases 2 y 3 llevan **solución completa verificada** (compilada y probada
> con imágenes sintéticas). De la 4 en adelante llevan objetivo, conceptos,
> pasos, pistas y criterios; la solución completa se añade a este archivo cuando
> lleguemos a la fase anterior, para que se apoye en tu código real y no en
> código sin probar.

---

## Fase 2 — Contornos y cuadriláteros ⬅ SIGUIENTE

### Objetivo
Encontrar en la imagen binaria **todos los cuadriláteros** (regiones de tinta
con 4 esquinas) y dibujarlos en verde sobre el canvas. Un marcador impreso debe
salir enmarcado; una ventana o un folio también (se descartarán en F4).

### Conceptos

**Región conexa.** Un grupo de píxeles de tinta que se tocan. Conectividad-4 =
se tocan por un lado; conectividad-8 = también por las esquinas. Usamos 8.

**Flood fill iterativo.** Para etiquetar una región: pila con el píxel inicial;
sacar uno, marcarlo, meter sus vecinos de tinta no marcados; repetir hasta
vaciar. Iterativo con pila propia, nunca recursivo: 100.000 píxeles de
profundidad reventarían la pila de llamadas.

**Borde exterior ordenado (Moore).** Un contorno no es "el conjunto de píxeles
del borde": es una **lista ordenada** recorriendo el borde en un sentido. Esa
ordenación es lo que permite simplificarlo a polígono. Algoritmo: desde el
píxel superior-izquierdo (cuyo vecino Oeste es fondo seguro), mirar los 8
vecinos en sentido horario empezando justo después del fondo; el primer píxel
de la región es el siguiente. Repetir hasta volver al inicio.

**Douglas–Peucker.** Convierte 400 puntos de borde en un polígono de pocos
vértices. Traza la cuerda entre el primer y el último punto; busca el punto
más alejado de la cuerda; si dista más que `epsilon`, es un vértice: se
conserva y se repite a cada lado; si no, todo el tramo se aproxima por la
cuerda. Un contorno cerrado se parte en dos mitades por el punto más lejano
al inicial, porque DP necesita principio y fin.

**Filtros de cuadrilátero.** Exactamente 4 vértices; **convexo** (todos los
giros hacia el mismo lado: producto cruzado con el mismo signo); área mínima;
lado mínimo. **Área con signo** (shoelace): `½ Σ (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)`. En
pantalla (y hacia abajo) positiva = horario. Se normaliza a horario y se
empieza por la esquina superior izquierda (menor `x+y`) para que F3 y F4
puedan dar el orden por hecho.

### Paso 2A — Un buffer binario aparte

Ahora el resultado del umbral solo existe dentro de `data` (RGBA). Los
algoritmos de F2 necesitan una imagen binaria de **1 byte por píxel**.

**Tarea:** crear `binaryBuffer: Uint8Array` (1 = tinta, 0 = fondo), reservado
una vez como `grayBuffer`. En la pasada 3, escribir en él además de en `data`.

✅ La imagen se ve igual que antes.

### Paso 2B — Regiones y bordes

**Tarea:** nuevo módulo `src/cv/contours.ts` con `findContours(...)`: flood fill
por etiquetas + recorrido de Moore. Filtro por área **antes** de recorrer el
borde (barato, descarta ruido). Buffers de trabajo `labels: Int32Array` y
`stack: Int32Array` reservados una vez en `main.ts`.

Pistas:
1. El barrido fila a fila garantiza que el primer píxel de una región es el
   superior-izquierdo, y su vecino Oeste es fondo → punto de apoyo inicial.
2. Al encontrar el siguiente píxel en dirección `d`, el nuevo punto de apoyo
   es el vecino en dirección `d−1` (el último fondo comprobado).
3. Parada: volver al píxel de inicio. Tope de seguridad: `2·área + 8` pasos.

✅ Dibuja los puntos de cada contorno como píxeles rojos sobre el canvas: el
borde de cada mancha negra debe quedar perfilado.

### Paso 2C — De contorno a polígono

**Tarea:** `src/cv/polygon.ts` con `simplifyClosed(points, epsilon)`.
`epsilon ≈ 0.03 × número de puntos del contorno` (proporcional al perímetro).

Pistas:
1. Distancia punto-**segmento**, no punto-recta: recorta `t` a `[0,1]`.
2. DP iterativo con una pila de pares `(a, b)`.
3. Cerrado → partir por el punto más lejano al 0 → dos abiertos → unir.

✅ Dibuja el polígono (líneas entre vértices). Un folio debe salir con ~4
vértices; una mano con muchos.

### Paso 2D — Filtrar cuadriláteros

**Tarea:** `toQuad(polygon, minArea, minSide): Quad | null` en `polygon.ts`.
Normaliza a horario y empieza por la esquina superior-izquierda.

✅ En verde solo los cuadriláteros. Un punto rojo en la esquina 0 para ver la
orientación. Un folio girado debe seguir saliendo.

### Paso 2E — Integración y medida

**Tarea:** en `tick`, tras `putImageData`: `findContours` → por cada contorno
`simplifyClosed` → `toQuad` → dibujar. Mostrar en `#probe` el número de
cuadriláteros y los ms.

✅ Con un marcador impreso (o un cuadrado negro dibujado a mano en un folio):
recuadro verde estable. Tiempo total < 16 ms.

<details>
<summary>▶ Solución Fase 2 (verificada) — abrir solo si te atascas</summary>

#### `src/cv/contours.ts`

```ts
/**
 * FASE 2A/2B: regiones de tinta y su borde exterior.
 *
 * Entrada: imagen binaria de 1 byte por pixel (1 = tinta, 0 = fondo).
 * Salida:  un contorno por region, con los pixeles del borde ORDENADOS en
 *          sentido horario. Ese orden es lo que necesita Douglas-Peucker.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Contour {
  /** Pixeles del borde exterior, en orden. */
  points: Point[];
  /** Pixeles que ocupa la region entera. */
  area: number;
}

// Los 8 vecinos en sentido horario empezando por el Este. En pantalla la `y`
// crece hacia ABAJO, asi que "Sur" es +1.
//            E   SE   S   SW   W   NW   N   NE
const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

/** Indice (0-7) de la direccion (dx,dy). */
function directionIndex(dx: number, dy: number): number {
  for (let d = 0; d < 8; d++) {
    if (DX[d] === dx && DY[d] === dy) return d;
  }
  throw new Error(`Direccion invalida (${dx}, ${dy})`);
}

/**
 * Encuentra las regiones de tinta y devuelve el borde exterior de cada una.
 *
 * `labels` y `stack` son buffers de trabajo de tamano width*height que el
 * llamador reserva una vez y reutiliza (misma regla que grayBuffer).
 */
export function findContours(
  binary: Uint8Array,
  width: number,
  height: number,
  labels: Int32Array,
  stack: Int32Array,
  minArea: number,
  maxArea: number,
): Contour[] {
  labels.fill(0);
  const contours: Contour[] = [];
  let nextLabel = 1;

  // Barrido fila a fila, izquierda a derecha. El primer pixel de una region
  // que aparece asi es SIEMPRE el mas alto y, de los mas altos, el mas a la
  // izquierda. Eso garantiza que su vecino Oeste es fondo: lo usaremos como
  // punto de partida del recorrido del borde.
  for (let start = 0; start < binary.length; start++) {
    if (binary[start] !== 1 || labels[start] !== 0) continue;

    // --- 1. Etiquetar la region completa (flood fill iterativo) ---
    const label = nextLabel++;
    let area = 0;
    let stackSize = 0;
    stack[stackSize++] = start;
    labels[start] = label;

    while (stackSize > 0) {
      const p = stack[--stackSize];
      area++;
      const px = p % width;
      const py = (p - px) / width;

      for (let d = 0; d < 8; d++) {
        const nx = px + DX[d];
        const ny = py + DY[d];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (binary[n] === 1 && labels[n] === 0) {
          labels[n] = label;
          stack[stackSize++] = n;
        }
      }
    }

    // --- 2. Descartar por tamano ANTES de recorrer el borde (barato) ---
    if (area < minArea || area > maxArea) continue;

    // --- 3. Recorrer el borde exterior ---
    contours.push({
      points: traceBorder(labels, width, height, start, label, area),
      area,
    });
  }

  return contours;
}

/**
 * Recorrido de borde por vecindad de Moore.
 *
 * Idea: eres una hormiga sobre el pixel de inicio con la mano izquierda
 * apoyada en el fondo. Miras a tus 8 vecinos en sentido horario empezando
 * justo despues de donde esta el fondo; el primer pixel de la region que
 * encuentres es el siguiente del borde. Repites hasta volver al inicio.
 *
 * Limitacion asumida: para cuando vuelve al pixel de inicio. Una region cuyo
 * borde pase DOS veces por su pixel superior-izquierdo (un "pellizco" de 1 px)
 * saldra truncada. El filtro de cuadrilateros la descartara sin mas.
 */
function traceBorder(
  labels: Int32Array,
  width: number,
  height: number,
  start: number,
  label: number,
  area: number,
): Point[] {
  const sx = start % width;
  const sy = (start - sx) / width;
  const points: Point[] = [{ x: sx, y: sy }];

  const inRegion = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && labels[y * width + x] === label;

  let px = sx;
  let py = sy;
  // Punto de apoyo ("backtrack"): el pixel de fondo desde el que miramos.
  // Al empezar es el vecino Oeste, que sabemos que es fondo.
  let bx = sx - 1;
  let by = sy;

  // Una linea de 1 px de grosor se recorre ida y vuelta: 2*area pasos como
  // mucho. El +8 cubre el caso de regiones minusculas.
  const maxSteps = area * 2 + 8;

  for (let step = 0; step < maxSteps; step++) {
    let d = directionIndex(bx - px, by - py);
    let found = false;

    for (let k = 0; k < 8; k++) {
      d = (d + 1) % 8; // siguiente en sentido horario
      const nx = px + DX[d];
      const ny = py + DY[d];

      if (inRegion(nx, ny)) {
        // El vecino que comprobamos justo ANTES era fondo: pasa a ser el
        // nuevo punto de apoyo.
        const back = (d + 7) % 8;
        bx = px + DX[back];
        by = py + DY[back];
        px = nx;
        py = ny;
        found = true;
        break;
      }
    }

    if (!found) break; // pixel aislado: no hay borde que recorrer
    if (px === sx && py === sy) break; // vuelta completa
    points.push({ x: px, y: py });
  }

  return points;
}
```

**Línea a línea, lo no evidente:**
- `const py = (p - px) / width` — división exacta (ya restamos el resto),
  más barata que `Math.floor(p / width)`.
- `stack[stackSize++] = n` — la pila es un `Int32Array` preasignado con un
  índice manual. Cero allocations en el bucle.
- `labels.fill(0)` cada frame — más rápido que reservar uno nuevo.
- `(d + 7) % 8` — es `d − 1` sin caer en negativos.
- El filtro por área va **antes** del recorrido: el ruido de sal y pimienta
  son cientos de regiones de 1-5 píxeles; recorrer sus bordes sería tirar tiempo.

#### `src/cv/polygon.ts`

```ts
/**
 * FASE 2C/2D: de un contorno de cientos de puntos a un poligono de pocos
 * vertices (Douglas-Peucker), y de ahi a "es un cuadrilatero valido o no".
 */
import type { Point } from "./contours";

export interface Quad {
  /** 4 esquinas en sentido horario (en pantalla), empezando por arriba-izq. */
  corners: [Point, Point, Point, Point];
}

/** Distancia de `p` al segmento a-b (al segmento, no a la recta infinita). */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  // Proyeccion de p sobre la recta, como fraccion t del segmento. Se recorta
  // a [0,1] para que puntos "mas alla" de un extremo midan contra ese extremo.
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2;
  t = Math.max(0, Math.min(1, t));

  const qx = a.x + t * dx;
  const qy = a.y + t * dy;
  return Math.hypot(p.x - qx, p.y - qy);
}

/**
 * Douglas-Peucker sobre el tramo ABIERTO points[first..last].
 * Marca en `keep` los indices que sobreviven. Iterativo con pila propia para
 * no depender de la profundidad de recursion.
 */
function simplifyRange(
  points: Point[],
  first: number,
  last: number,
  epsilon: number,
  keep: boolean[],
): void {
  const pending: number[] = [first, last];

  while (pending.length > 0) {
    const b = pending.pop()!;
    const a = pending.pop()!;

    // El punto intermedio mas alejado de la cuerda a-b.
    let maxDistance = 0;
    let farthest = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distanceToSegment(points[i], points[a], points[b]);
      if (d > maxDistance) {
        maxDistance = d;
        farthest = i;
      }
    }

    // Si se sale del margen, ese punto es un vertice real: se conserva y se
    // repite el proceso a cada lado. Si no, todo el tramo se aproxima por a-b.
    if (maxDistance > epsilon) {
      keep[farthest] = true;
      pending.push(a, farthest, farthest, b);
    }
  }
}

/**
 * Douglas-Peucker para un contorno CERRADO.
 *
 * DP trabaja con una polilinea abierta (tiene un principio y un fin). Un
 * contorno cerrado se parte en dos mitades por el punto mas lejano al
 * primero, se simplifica cada mitad y se vuelven a unir.
 */
export function simplifyClosed(points: Point[], epsilon: number): Point[] {
  const n = points.length;
  if (n < 3) return points.slice();

  let far = 0;
  let maxDistance2 = -1;
  for (let i = 1; i < n; i++) {
    const dx = points[i].x - points[0].x;
    const dy = points[i].y - points[0].y;
    const d2 = dx * dx + dy * dy;
    if (d2 > maxDistance2) {
      maxDistance2 = d2;
      far = i;
    }
  }

  // Segunda mitad: de `far` hasta el final Y de vuelta al punto 0. Para no
  // tratar el cierre como caso especial, se anade points[0] al final como si
  // fuera el indice n.
  const extended = points.concat([points[0]]);
  const keep = new Array<boolean>(n + 1).fill(false);
  keep[0] = true;
  keep[far] = true;
  keep[n] = true;

  simplifyRange(extended, 0, far, epsilon, keep);
  simplifyRange(extended, far, n, epsilon, keep);

  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) out.push(points[i]);
  }
  return out;
}

/**
 * Area con signo (formula del cordon / shoelace).
 * En coordenadas de pantalla (y hacia abajo): positiva = horario.
 */
export function signedArea(polygon: Point[]): number {
  let sum = 0;
  for (let i = 0, n = polygon.length; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * Decide si un poligono es un cuadrilatero valido y lo normaliza:
 * 4 vertices, convexo, area minima, lados minimos, horario, empezando por
 * la esquina superior izquierda. Devuelve null si no pasa algun filtro.
 */
export function toQuad(polygon: Point[], minArea: number, minSide: number): Quad | null {
  if (polygon.length !== 4) return null;

  // Orientacion: si es antihorario, se invierte. Asi todos los cuadrilateros
  // salen en el mismo sentido, algo que las fases siguientes dan por hecho.
  let area = signedArea(polygon);
  let pts = polygon;
  if (area < 0) {
    pts = polygon.slice().reverse();
    area = -area;
  }
  if (area < minArea) return null;

  // Convexidad: en un poligono horario convexo, todos los giros van hacia el
  // mismo lado (producto cruzado > 0). Un giro al otro lado = concavo.
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross <= 0) return null;
  }

  // Lados minimos: descarta cuadrilateros degenerados (casi un triangulo).
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    if (Math.hypot(b.x - a.x, b.y - a.y) < minSide) return null;
  }

  // Empezar por la esquina superior izquierda: la de menor x+y.
  let s = 0;
  for (let i = 1; i < 4; i++) {
    if (pts[i].x + pts[i].y < pts[s].x + pts[s].y) s = i;
  }

  return {
    corners: [pts[s], pts[(s + 1) % 4], pts[(s + 2) % 4], pts[(s + 3) % 4]],
  };
}
```

**Lo no evidente:**
- `pending.pop()!` — el `!` es una aserción de tipo (se borra al compilar, así
  que `erasableSyntaxOnly` lo permite). Sabemos que la pila tiene pares.
- `pending.push(a, farthest, farthest, b)` — mete dos pares de golpe: los dos
  subtramos a cada lado del vértice encontrado.
- `keep[n] = true` con `extended` — el truco para no tratar el cierre como caso
  especial: el punto 0 aparece también como índice `n`.
- El signo del producto cruzado y el del área comparten convención: por eso
  tras forzar área positiva, "convexo" es `cross > 0` en las 4 esquinas.

#### Integración en `src/main.ts`

Estado nuevo (junto a `grayBuffer` e `integral`):

```ts
/** Imagen binaria, 1 byte por pixel: 1 = tinta, 0 = fondo. */
let binaryBuffer = new Uint8Array(0);
/** Buffers de trabajo de findContours (etiquetas y pila del flood fill). */
let labelsBuffer = new Int32Array(0);
let stackBuffer = new Int32Array(0);

/** Filtros de F2. Ajustables: son pixeles a resolucion de analisis (640). */
const MIN_REGION_AREA = 400;
const MIN_QUAD_AREA = 400;
const MIN_QUAD_SIDE = 15;
/** Tolerancia de Douglas-Peucker, como fraccion del numero de puntos del contorno. */
const SIMPLIFY_FACTOR = 0.03;
```

Import:

```ts
import { findContours } from "./cv/contours";
import { simplifyClosed, toQuad, type Quad } from "./cv/polygon";
```

En el bloque de reserva de buffers:

```ts
if (grayBuffer.length !== pixelCount) {
  grayBuffer = new Uint8ClampedArray(pixelCount);
  integral = new Uint32Array(pixelCount);
  binaryBuffer = new Uint8Array(pixelCount);
  labelsBuffer = new Int32Array(pixelCount);
  stackBuffer = new Int32Array(pixelCount);
}
```

En la pasada 3, sustituir la línea del `value`:

```ts
const isInk = grayBuffer[p] < mean - margin;
binaryBuffer[p] = isInk ? 1 : 0;   // para los algoritmos
const value = isInk ? 0 : 255;     // para la pantalla
```

Después de `canvasContext.putImageData(frame, 0, 0)`:

```ts
// 7. Contornos -> poligonos -> cuadrilateros.
const contours = findContours(
  binaryBuffer, width, height, labelsBuffer, stackBuffer,
  MIN_REGION_AREA, pixelCount * 0.5,
);
const quads: Quad[] = [];
for (const contour of contours) {
  const polygon = simplifyClosed(contour.points, contour.points.length * SIMPLIFY_FACTOR);
  const quad = toQuad(polygon, MIN_QUAD_AREA, MIN_QUAD_SIDE);
  if (quad) quads.push(quad);
}

// 8. Dibujar encima del canvas (despues de putImageData, o se borraria).
drawQuads(quads);
```

Y la función de dibujo (fuera de `tick`):

```ts
/** Recuadro verde por cuadrilatero y punto rojo en su esquina 0. */
function drawQuads(quads: Quad[]): void {
  canvasContext.lineWidth = 2;
  canvasContext.strokeStyle = "#00ff00";
  canvasContext.fillStyle = "#ff0000";

  for (const { corners } of quads) {
    canvasContext.beginPath();
    // +0.5: las coordenadas enteras caen entre pixeles; el medio pixel centra
    // la linea y evita que salga borrosa.
    canvasContext.moveTo(corners[0].x + 0.5, corners[0].y + 0.5);
    for (let i = 1; i < 4; i++) {
      canvasContext.lineTo(corners[i].x + 0.5, corners[i].y + 0.5);
    }
    canvasContext.closePath();
    canvasContext.stroke();

    canvasContext.fillRect(corners[0].x - 3, corners[0].y - 3, 6, 6);
  }
}
```

En el `#probe` añade `cuadrilateros: ${quads.length}`.

**Ajustes si algo no cuadra:**
- No detecta el marcador → baja `SIMPLIFY_FACTOR` a 0.02 o sube el margen `C`.
- Detecta cuadriláteros fantasma → sube `MIN_QUAD_AREA` / `MIN_QUAD_SIDE`.
- Muy lento → mira cuántos contornos salen; si son cientos, sube `MIN_REGION_AREA`.

</details>

---

## Fase 3 — Homografía y unwarp

### Objetivo
Coger el cuadrilátero detectado y **enderezarlo** a un cuadrado de 64×64
píxeles, como si lo mirases de frente. Se muestra en un segundo canvas pequeño.

### Conceptos

**Homografía.** La transformación que lleva un plano visto desde un punto de
vista a ese mismo plano visto desde otro. Es una matriz 3×3 con **8 grados de
libertad** (la escala global no importa: `H` y `2H` son la misma
transformación, por eso se fija `h33 = 1`).

**Coordenadas homogéneas.** Un punto `(x,y)` se escribe `(x,y,1)`. Se
multiplica por `H` → `(x',y',w')` → el punto real es `(x'/w', y'/w')`. **Esa
división por `w'` es la perspectiva**: lo lejano se encoge.

**Por qué 4 puntos bastan.** Cada par de puntos (origen ↔ destino) da 2
ecuaciones lineales. 4 pares → 8 ecuaciones → 8 incógnitas. Sistema 8×8,
solución exacta por **eliminación gaussiana con pivote parcial** (elegir en
cada columna la fila con mayor valor absoluto para no dividir por casi-cero).

**Warp inverso.** Para rellenar la imagen de salida se recorre el **destino**
y se pregunta "¿qué punto del origen cae aquí?". Al revés (recorrer el origen)
quedan huecos y solapes.

**Muestreo bilineal.** El punto del origen no cae en un píxel exacto. Se
mezclan los 4 vecinos en proporción a la distancia. Sin esto, el resultado
sale dentado.

> **Nota sobre el roadmap original:** hablaba de DLT normalizado + SVD. Eso es
> para *más de 4 puntos* con ruido (mínimos cuadrados). Con exactamente 4
> esquinas, el sistema 8×8 exacto es más simple y es lo correcto. DLT+SVD
> llegará en F10 con RANSAC.

### Paso 3A — Resolver el sistema
**Tarea:** `src/cv/homography.ts` con `solve8(A, b)` (gaussiana, pivote
parcial, devuelve `null` si singular) y `homographyFromPoints(src, dst)`.

Pistas:
1. Para el par `(u,v) → (x,y)`, las dos filas son
   `[u, v, 1, 0, 0, 0, −u·x, −v·x] · h = x` y
   `[0, 0, 0, u, v, 1, −u·y, −v·y] · h = y`.
2. Matriz 8×8 como `Float64Array(64)`, índice `fila*8 + col`.
3. Tras eliminar, sustitución hacia atrás desde la última fila.

✅ Test mental: `H` de `(0,0),(1,0),(1,1),(0,1)` a esos mismos puntos debe ser
la identidad. Aplicada a las esquinas origen debe devolver las destino exactas.

### Paso 3B — Unwarp
**Tarea:** `unwarpQuad(gray, width, height, quad, 64, out)`. `H` va de las
esquinas canónicas `(0,0),(64,0),(64,64),(0,64)` a `quad.corners`, en el mismo
orden. Recorrer el destino, aplicar `H` al centro de cada píxel `(i+0.5, j+0.5)`,
muestrear bilineal en `grayBuffer`.

✅ Segundo `<canvas id="unwarp" width="64" height="64">` (CSS: 192 px,
`image-rendering: pixelated`). Al apuntar al marcador, se ve **de frente**
aunque la cámara esté inclinada. Gira el papel: la imagen gira a saltos de 90°
(la esquina 0 es siempre la de menor `x+y`, y eso cambia al girar; F4 lo resuelve).

<details>
<summary>▶ Solución Fase 3 (verificada) — abrir solo si te atascas</summary>

#### `src/cv/homography.ts`

```ts
/**
 * FASE 3: homografia exacta a partir de 4 correspondencias, y "unwarp"
 * (enderezar) un cuadrilatero de la imagen a un cuadrado canonico.
 */
import type { Point } from "./contours";
import type { Quad } from "./polygon";

/** Matriz 3x3 por filas: [h11,h12,h13, h21,h22,h23, h31,h32,h33]. */
export type Homography = Float64Array;

function swapRows(A: Float64Array, b: Float64Array, r1: number, r2: number, n: number): void {
  for (let c = 0; c < n; c++) {
    const t = A[r1 * n + c];
    A[r1 * n + c] = A[r2 * n + c];
    A[r2 * n + c] = t;
  }
  const t = b[r1];
  b[r1] = b[r2];
  b[r2] = t;
}

/**
 * Resuelve A*x = b para A de 8x8 por eliminacion gaussiana con pivote
 * parcial. Modifica A y b. Devuelve null si el sistema es singular (los 4
 * puntos no definen una homografia: tres alineados, dos repetidos...).
 */
function solve8(A: Float64Array, b: Float64Array): Float64Array | null {
  const n = 8;

  for (let col = 0; col < n; col++) {
    // Pivote parcial: la fila con mayor |valor| en esta columna. Evita
    // dividir por numeros diminutos y que el error numerico se dispare.
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r * n + col]) > Math.abs(A[pivot * n + col])) pivot = r;
    }
    if (Math.abs(A[pivot * n + col]) < 1e-12) return null;
    if (pivot !== col) swapRows(A, b, pivot, col, n);

    // Anular esta columna en todas las filas de debajo.
    for (let r = col + 1; r < n; r++) {
      const f = A[r * n + col] / A[col * n + col];
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r * n + c] -= f * A[col * n + c];
      b[r] -= f * b[col];
    }
  }

  // Sustitucion hacia atras: la ultima fila tiene una sola incognita.
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= A[r * n + c] * x[c];
    x[r] = s / A[r * n + r];
  }
  return x;
}

/**
 * Homografia H tal que H * src[i] = dst[i] para los 4 pares.
 *
 * Con h33 = 1 quedan 8 incognitas, y cada par de puntos da 2 ecuaciones:
 *
 *   x = (h11 u + h12 v + h13) / (h31 u + h32 v + 1)
 *   y = (h21 u + h22 v + h23) / (h31 u + h32 v + 1)
 *
 * Multiplicando por el denominador y reordenando quedan lineales en h:
 *
 *   [u v 1 0 0 0 -u*x -v*x] . h = x
 *   [0 0 0 u v 1 -u*y -v*y] . h = y
 */
export function homographyFromPoints(src: Point[], dst: Point[]): Homography | null {
  const A = new Float64Array(64);
  const b = new Float64Array(8);

  for (let i = 0; i < 4; i++) {
    const u = src[i].x;
    const v = src[i].y;
    const x = dst[i].x;
    const y = dst[i].y;
    const r1 = 2 * i;
    const r2 = 2 * i + 1;
    A.set([u, v, 1, 0, 0, 0, -u * x, -v * x], r1 * 8);
    A.set([0, 0, 0, u, v, 1, -u * y, -v * y], r2 * 8);
    b[r1] = x;
    b[r2] = y;
  }

  const h = solve8(A, b);
  if (!h) return null;
  return new Float64Array([h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]);
}

/** Aplica H al punto (u,v). La division por w es lo que crea la perspectiva. */
export function applyHomography(H: Homography, u: number, v: number): Point {
  const w = H[6] * u + H[7] * v + H[8];
  return {
    x: (H[0] * u + H[1] * v + H[2]) / w,
    y: (H[3] * u + H[4] * v + H[5]) / w,
  };
}

/**
 * Lee la imagen en una posicion NO entera mezclando los 4 pixeles vecinos
 * en proporcion a la distancia. Sin esto, el unwarp sale "dentado".
 * Convencion: el pixel (i,j) tiene su centro en (i+0.5, j+0.5).
 */
function sampleBilinear(
  img: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const fx = x - 0.5;
  const fy = y - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;

  const at = (px: number, py: number): number =>
    px < 0 || py < 0 || px >= width || py >= height ? 0 : img[py * width + px];

  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
  return Math.round(top * (1 - ty) + bottom * ty);
}

/**
 * Endereza el cuadrilatero `quad` de la imagen `gray` en un cuadrado de
 * size x size pixeles, escrito en `out` (1 byte por pixel).
 *
 * Se recorre el DESTINO y se pregunta "que punto del origen cae aqui?"
 * (warp inverso). Asi cada pixel de salida recibe exactamente un valor y no
 * quedan huecos, que es lo que pasaria recorriendo el origen.
 */
export function unwarpQuad(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  quad: Quad,
  size: number,
  out: Uint8ClampedArray,
): boolean {
  // Esquinas del cuadrado canonico, en el MISMO orden que quad.corners
  // (horario desde arriba-izquierda). Si el orden no coincide, la imagen
  // sale rotada o reflejada.
  const canonical: Point[] = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];

  const H = homographyFromPoints(canonical, quad.corners);
  if (!H) return false;

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const src = applyHomography(H, i + 0.5, j + 0.5);
      out[j * size + i] = sampleBilinear(gray, width, height, src.x, src.y);
    }
  }
  return true;
}
```

**Lo no evidente:**
- `A.set([...], r1 * 8)` — escribe 8 valores seguidos empezando en ese offset:
  una fila entera de golpe.
- `1e-12` como umbral de singularidad — con coordenadas en píxeles (cientos),
  un pivote por debajo de eso significa puntos degenerados.
- `x - 0.5` en `sampleBilinear` — la convención "centro del píxel en +0.5"
  hace que muestrear exactamente en `(i+0.5, j+0.5)` devuelva el píxel `(i,j)`
  sin mezcla. Coherente con el `i + 0.5` del bucle de unwarp.
- Se muestrea `grayBuffer` (gris), **no** el binario: F4 decidirá su propio
  umbral sobre la imagen enderezada, con mejor criterio (es una zona pequeña
  y uniforme).

#### Integración en `main.ts`

HTML:
```html
<canvas id="unwarp" width="64" height="64" style="width:192px;height:192px;image-rendering:pixelated"></canvas>
```

Estado / refs:
```ts
import { unwarpQuad } from "./cv/homography";

const UNWARP_SIZE = 64;
const unwarpBuffer = new Uint8ClampedArray(UNWARP_SIZE * UNWARP_SIZE);

const unwarpCanvas = requireElement<HTMLCanvasElement>("unwarp");
const unwarpContext = require2dContext(unwarpCanvas);
// ImageData reservado una vez; solo se sobrescriben sus bytes.
const unwarpImage = unwarpContext.createImageData(UNWARP_SIZE, UNWARP_SIZE);
```

En `tick`, tras `drawQuads(quads)`:
```ts
// 9. Enderezar el primer cuadrilatero (F4 los recorrera todos).
if (quads.length > 0 && unwarpQuad(grayBuffer, width, height, quads[0], UNWARP_SIZE, unwarpBuffer)) {
  const px = unwarpImage.data;
  for (let i = 0, j = 0; i < unwarpBuffer.length; i++, j += 4) {
    px[j] = px[j + 1] = px[j + 2] = unwarpBuffer[i];
    px[j + 3] = 255;
  }
  unwarpContext.putImageData(unwarpImage, 0, 0);
}
```

</details>

---

## Fase 4 — Decodificación del marcador

### Objetivo
Del cuadrado 64×64 enderezado, leer los bits y decir **"marcador ID 23,
rotación 90°"**. Descartar cuadriláteros que no son marcadores.

### Conceptos
- **Diseño del marcador:** rejilla de `N×N` celdas (usaremos 6×6). Las celdas
  del borde son **siempre negras** (quiet zone / borde): sirven para detectarlo
  y para rechazar impostores. Las `4×4 = 16` interiores llevan los bits.
- **Leer una celda:** el 64×64 se divide en 6×6 celdas de ~10.7 px. Se
  promedia el **centro** de cada celda (evitar los bordes, que están borrosos)
  y se compara con un umbral **propio del 64×64** (la media de todo el cuadrado
  funciona bien: es una zona pequeña e iluminada uniformemente).
- **Comprobaciones:** el borde debe ser todo negro (permitiendo 1-2 fallos). Si
  no, no es un marcador → descartar.
- **Rotación:** el mismo marcador da 4 lecturas distintas según cómo esté
  girado. Se prueban las 4 rotaciones de la matriz 4×4 y se busca cuál coincide
  con el diccionario. La que coincide dice **cuánto está girado**, y eso es un
  dato de pose (F6 lo necesita).
- **Diccionario + Hamming:** un conjunto de IDs (patrones de 16 bits) elegidos
  de forma que (a) cualquier par difiere en muchos bits y (b) ningún patrón es
  una rotación de otro. Se acepta el más cercano si su **distancia de Hamming**
  (bits distintos, `popcount(a XOR b)`) es ≤ 1 o 2 → corrige errores de lectura.
- **Generador:** un script que produce los marcadores en **SVG** para imprimir,
  con margen blanco alrededor (sin margen, el borde negro se funde con lo que
  haya detrás).

### Pasos
- **4A** `src/cv/marker.ts`: `readBits(unwarp, size, gridN) → Uint8Array(16) | null`
  (null si falla el borde). Pista: celda `(cx,cy)` ocupa
  `[cx·size/N, (cx+1)·size/N)`; promedia el tercio central.
  ✅ Imprime los 16 bits en `#probe`; cambian al girar el marcador.
- **4B** `rotate(bits)` 90° y `hamming(a, b)`. Pista: rotar 4×4:
  `nuevo[y][x] = viejo[N−1−x][y]`.
- **4C** Diccionario de 10-20 IDs. Genera candidatos aleatorios y acepta solo
  los que están a distancia ≥ 4 de todos los ya aceptados **y de sus 3
  rotaciones**. Guárdalo como constante.
- **4D** `decode(bits) → { id, rotation } | null`. ✅ `#probe` muestra ID y
  rotación estables; un folio en blanco no decodifica.
- **4E** `scripts/gen-markers.ts` → `public/markers/*.svg`. Imprime dos.

---

## Fase 5 — Calibración de cámara

### Objetivo
Obtener la matriz **K** (intrínsecos) de *tu* cámara: cómo convierte ángulos
en píxeles. Sin K no hay pose 3D correcta.

### Conceptos
- **Modelo pinhole:** un punto 3D `(X,Y,Z)` en coordenadas de cámara se
  proyecta en `x = f·X/Z + cx`, `y = f·Y/Z + cy`. `f` = distancia focal **en
  píxeles**; `(cx,cy)` = punto principal (≈ centro de la imagen).
  ```
  K = | f  0  cx |
      | 0  f  cy |
      | 0  0   1 |
  ```
- **Atajo pragmático (empezar por aquí):** `f = (ancho/2) / tan(FOV_h/2)`. Las
  webcams suelen tener FOV horizontal ≈ 60-70°. Con 640 px y 65°:
  `f ≈ 320 / tan(32.5°) ≈ 502`. Error de un 10% en `f` → el objeto 3D parece
  algo más grande/pequeño, pero sigue pegado al papel. Suficiente para F6-F7.
- **Distorsión radial:** las lentes curvan las rectas cerca de los bordes.
  `k1, k2`. Las webcams modernas la tienen pequeña; se ignora al principio.
- **Método de Zhang (opcional, portafolio):** fotografiar un tablero de
  ajedrez impreso en 10-15 posiciones, detectar esquinas, y resolver K por
  mínimos cuadrados + refinamiento no lineal. Se puede implementar desde cero
  reutilizando la homografía de F3 (cada foto del tablero es una homografía).

### Pasos
- **5A** `src/cv/camera-model.ts`: `intrinsicsFromFov(width, height, fovDeg) → K`.
  Slider de FOV en la UI para ajustarlo a ojo en F7. ✅ K impresa en `#probe`.
- **5B** (opcional, después de F7) Calibración con tablero: detector de
  esquinas de ajedrez (reutiliza contornos: son cuadrados adyacentes),
  homografía por foto, K por el método de Zhang, guardar `calibration.json`.

---

## Fase 6 — Estimación de pose (el corazón)

### Objetivo
Dibujar **tres ejes XYZ** sobre el marcador que se mueven con él en 3D.

### Conceptos
- **Sistemas de coordenadas:** mundo (el marcador: origen en su centro, Z hacia
  arriba del papel, lado = `s` unidades) → cámara (R, t) → imagen (K).
  Proyección: `p_imagen ~ K · [R | t] · P_mundo`.
- **La relación clave:** para puntos del plano `Z=0`, `[R|t]` se reduce a
  `[r1 r2 t]` (columnas 1 y 2 de R, y t) y la proyección es una homografía:
  **`H = λ · K · [r1 r2 t]`**. Y esa H ya la sabes calcular (F3): de las
  esquinas del marcador en unidades de mundo `(±s/2, ±s/2)` a las esquinas en
  píxeles.
- **Extraer la pose:** `K⁻¹ · H = λ [r1 r2 t]`. Se normaliza para que `|r1| ≈
  |r2| ≈ 1` (usar la media de ambas normas), `r3 = r1 × r2`.
- **Ortonormalizar R:** por ruido, r1 y r2 no son exactamente perpendiculares
  ni unitarios. Arreglo simple: Gram-Schmidt (normaliza r1; r2 ← r2 − (r2·r1)r1,
  normaliza; r3 = r1×r2). Mejor: SVD de R y `R ← U·Vᵀ` (F10 traerá SVD).
- **Ambigüedad de signo:** `H` y `−H` son la misma homografía pero dan `t` y
  `−t`. El marcador está **delante** de la cámara → si `t_z < 0`, cambiar el
  signo de todo.
- **Refinamiento (Gauss-Newton):** la pose de la homografía es una
  aproximación. Se mejora minimizando el **error de reproyección**: proyectar
  las 4 esquinas 3D con la pose actual, medir la distancia a las detectadas,
  ajustar los 6 parámetros (3 rotación, 3 traslación) unas pocas iteraciones.
  Necesita derivadas numéricas y resolver un 6×6 (¡el `solve8` generalizado a n!).
- **Orden de esquinas y rotación del marcador (F4):** la rotación decodificada
  dice qué esquina detectada corresponde a qué esquina del mundo. Sin eso, los
  ejes salen girados 90/180/270°.

### Pasos
- **6A** `src/cv/pose.ts`: `poseFromHomography(H, K) → { R, t }` con
  normalización, r3, Gram-Schmidt y corrección de signo.
- **6B** `project(K, R, t, P3d) → Point`. Dibujar ejes: proyectar
  `(0,0,0)`, `(s/2,0,0)` rojo, `(0,s/2,0)` verde, `(0,0,−s/2)` azul.
  ✅ Los ejes se quedan **clavados** al papel al mover la cámara. El azul sale
  perpendicular al papel.
- **6C** Refinamiento Gauss-Newton (3-5 iteraciones). ✅ Ejes más estables,
  sobre todo cuando el marcador está muy inclinado.

---

## Fase 7 — Render 3D alineado

### Objetivo
Un **cubo** plantado sobre el papel, después un modelo glTF.

### Conceptos
- **Dos canvas superpuestos:** el 2D (vídeo/binario) debajo y un canvas WebGL
  transparente encima, mismo tamaño en pantalla, `position: absolute`.
- **Matriz de proyección desde K:** OpenGL no usa K; usa una matriz 4×4 con
  near/far. Se construye a partir de `f, cx, cy, ancho, alto, near, far`.
  Fórmula estándar (búscala como "OpenGL projection from intrinsics").
- **Convención de ejes:** en visión (OpenCV) la cámara mira a **+Z** y la `y`
  va hacia **abajo**; en OpenGL mira a **−Z** y la `y` va hacia **arriba**. Hay
  que voltear Y y Z: multiplicar `[R|t]` por `diag(1, −1, −1, 1)`.
- **Matriz de vista:** es `[R|t]` (mundo → cámara) ya convertida. El modelo se
  coloca en el origen del mundo (el centro del marcador).
- **WebGL a pelo (7A):** shaders mínimos (vértice: `gl_Position = P·V·M·pos`;
  fragmento: color plano), buffer de vértices del cubo, `DEPTH_TEST`. Es más
  código, pero después de esto Three.js deja de ser magia.
- **Three.js (7B):** `PerspectiveCamera` con `projectionMatrix` fijada a mano
  (`camera.projectionMatrix.fromArray`, `matrixAutoUpdate = false`), cámara
  en el origen, y el objeto con `matrix` = pose. `GLTFLoader` para un modelo.

### Pasos
- **7A** `src/gl/`: `projectionFromIntrinsics()`, `viewFromPose()`, cubo
  WebGL. ✅ El cubo se sienta sobre el marcador; al inclinar la cámara, la
  perspectiva del cubo y la del papel coinciden.
- **7B** Three.js: mismo resultado, luego un glTF con luz. Sombra de contacto
  (plano transparente que recibe sombra) como extra.

---

## Fase 8 — Estabilidad y tracking

### Objetivo
Que el objeto **no vibre** y sobreviva a oclusiones parciales breves.

### Conceptos
- **Esquinas subpíxel:** las esquinas de F2 son píxeles enteros del borde.
  Mejor: ajustar una **recta** por mínimos cuadrados a los puntos del contorno
  de cada lado (entre vértice y vértice, descartando los extremos) e
  **intersectar** las rectas adyacentes. Precisión de décimas de píxel → pose
  mucho más estable. Esto reutiliza los contornos que ya tienes.
- **Filtro One Euro:** suaviza mucho cuando el movimiento es lento (mata el
  temblor) y poco cuando es rápido (no añade retraso). Dos parámetros:
  `minCutoff` y `beta`. Se aplica a cada esquina (8 valores) o a la pose.
  Mejor que una media móvil, que retrasa siempre.
- **Tracking:** en vez de detectar desde cero cada frame, buscar el marcador
  **cerca de donde estaba**. Recorta la región de interés → menos trabajo,
  menos falsos positivos.
- **Histéresis de pérdida:** si un frame no detecta, no borrar el objeto de
  golpe: mantener la última pose N frames (~10) antes de darlo por perdido.

### Pasos
- **8A** `refineCorners(contour, quad) → Quad` con rectas + intersección.
- **8B** `OneEuroFilter` clase (sin parameter properties, recuerda). Aplicar a
  las 8 coordenadas. ✅ Marcador quieto → objeto quieto del todo.
- **8C** Región de interés y histéresis.

---

## Fase 9 — Rendimiento

### Objetivo
**60 fps estables en móvil**, con presupuesto medido por etapa.

### Conceptos
- **Medir primero.** `performance.now()` por etapa (captura, gris, integral,
  umbral, contornos, pose, render). Tabla en pantalla. Optimizar solo lo que
  pesa.
- **Web Worker:** todo el pipeline de visión fuera del hilo principal. La
  UI nunca se congela. El `ImageData.data.buffer` se envía como
  **Transferable** (cero copia). El worker devuelve solo la pose (unos floats).
- **Evitar allocations:** `Point[]` de los contornos → arrays planos
  `Int32Array` con índice manual. `quads` → buffer reutilizado.
- **`requestVideoFrameCallback`:** se dispara cuando llega un frame **nuevo**
  del vídeo (30/s), no 60/s. Ahorra la mitad del trabajo.
- **No pasar por RGBA:** ahora dibujas el vídeo en el canvas, lo lees, lo
  procesas y lo vuelves a escribir. Lo eficiente: mostrar el `<video>` (o el
  canvas del vídeo) directamente, y **solo leer** para procesar. La vista
  binaria pasa a ser una opción de debug.
- **Reducir resolución de análisis** (480 o 320) si el marcador es grande.
- **WASM / SIMD:** solo si tras todo lo anterior sigue faltando. Casi nunca.

### Pasos
- **9A** Profiler por etapas. **9B** Worker + transferables. **9C** Sin
  allocations en el hot loop. **9D** Probar en el móvil con `npm run dev:lan`
  (necesita HTTPS: plugin `@vitejs/plugin-basic-ssl` en modo `lan`).

---

## Fase 10 — Markerless (avanzado)

### Objetivo
AR sobre una **imagen natural** (la portada de un libro) en vez de un marcador.

### Conceptos
- **FAST:** detector de esquinas. Un píxel es esquina si en un círculo de 16
  píxeles a su alrededor hay un arco de ≥ 9 seguidos todos más claros (o
  todos más oscuros) que él ± umbral. Rapidísimo.
- **BRIEF / ORB:** descriptor binario de 256 bits: compara pares de píxeles
  en un parche alrededor de la esquina (`p[a] < p[b] → 1`). Dos esquinas se
  parecen si sus descriptores tienen **poca distancia de Hamming** (¡F4!).
  ORB añade orientación para tolerar rotación.
- **Matching:** para cada esquina del frame, la más parecida en la imagen de
  referencia. Filtro de ratio (la mejor debe ser bastante mejor que la
  segunda) para quitar ambiguas.
- **RANSAC:** con muchos pares, algunos son falsos. Elegir 4 al azar → H (¡F3!)
  → contar cuántos pares están de acuerdo (inliers). Repetir N veces, quedarse
  con la H de más inliers, recalcularla con todos ellos por **DLT normalizado
  + SVD** (aquí sí hace falta). Con H → pose (¡F6!) → render (¡F7!).
- **Honestidad técnica:** esto es "AR sobre un plano conocido". Lo que hace
  ARCore/ARKit/WebXR (SLAM: mapear el entorno sin referencia) es otro nivel.
  El README debe decirlo tal cual; es señal de madurez, no de debilidad.

### Pasos
- **10A** FAST. ✅ Puntos verdes en las esquinas de la escena.
- **10B** BRIEF + matching. ✅ Líneas entre frame y referencia.
- **10C** RANSAC + DLT/SVD (implementar SVD de Jacobi para 9×9).
- **10D** Enganchar a F6-F7. ✅ El cubo sobre la portada del libro.

---

## Fase 11 — Producto y portafolio

- **Deploy** en GitHub Pages / Vercel (HTTPS obligatorio para la cámara).
- **README** con GIF del resultado, diagrama del pipeline, y una sección
  "qué implementé desde cero y qué no" (honesta).
- **Marcadores descargables** (los SVG de F4) en la propia página.
- **Tests con Vitest:** homografía (identidad, ida y vuelta), decodificación
  (todas las rotaciones), pose sintética (proyectar un cubo conocido y
  recuperarlo), Douglas-Peucker con polígonos conocidos.
- **Benchmarks:** tabla de ms por etapa en PC y móvil.
- **Artículo** explicando la tabla integral, la homografía y la pose con los
  mismos ejemplos de este documento. Es el mejor material de entrevista posible.

---

# APÉNDICE — Principios que ya aplicamos (glosario de repaso)

- **Una abstracción se gana cuando aparece el segundo caso de uso.** No antes.
- **Regla de las opciones:** ≥3 parámetros o alguno opcional → objeto de opciones.
- **Estado de control vs derivado.** El derivado se calcula, nunca se almacena.
- **Toda variable de estado necesita todas sus transiciones.**
- **Tiempo de registro ≠ tiempo de ejecución.** El estado se consulta dentro del handler.
- **Captura un error solo si puedes hacer algo con él.** Si no, deja que suba.
- **Guard clause:** valida en la frontera, falla con mensaje para quien puede arreglarlo.
- **No puedes esperar un efecto antes de provocar su causa.**
- **Antes de esperar un evento, comprueba si ya estás en ese estado.**
- **Render idempotente y de solo lectura.**
- **Reservar buffers una vez.** Nada de `new` en el hot loop.
- **Leer de un buffer, escribir en otro** cuando cada salida depende de varias entradas.
- **La ventana debe ser mayor que el detalle** que quieres detectar.
- **Prefijos acumulados → sumas de rangos en O(1).** En 2D, 4 esquinas.
- **Medir antes de optimizar.** Y optimizar al final.
- **El depurador de visión es mirar la imagen.** Cada paso intermedio, visualizable.
