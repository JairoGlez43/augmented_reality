# Guía offline — Fase 2B: de píxeles sueltos a contornos ordenados

> Material de estudio autocontenido. No hace falta leer nada más para
> implementar el Paso 2B completo y empezar el 2C.
>
> **Cómo está montada:** cada bloque va en este orden fijo
>
> 1. **el problema** contado desde abajo, con números pequeños;
> 2. **la simulación a mano**, paso a paso, sin saltarme ninguna iteración;
> 3. **el pseudocódigo**;
> 4. **el código real**, diciendo en qué archivo y en qué parte va.
>
> Los puntos 3 y 4 están dentro de bloques plegables (`▶`). **Intenta escribirlo
> tú después de leer 1 y 2.** El bloque plegado es para comprobar, no para
> copiar.
>
> **Nota sobre nombres de archivo:** en `CONTEXT.md` el módulo se llama
> `src/cv/contours.ts` (plural) y tú lo creaste como `src/cv/contour.ts`
> (singular). Da igual cuál elijas, pero elige uno y usa el mismo en todos los
> `import`. En esta guía escribo **`src/cv/contour.ts`**, que es el que tienes.

---

## Índice

- [Parte 0 — El terreno: qué hay realmente en memoria](#parte-0)
- [Parte 1 — Etiquetar regiones (flood fill)](#parte-1)
- [Parte 2 — Filtrar por tamaño](#parte-2)
- [Parte 3 — El contorno ordenado (recorrido de Moore)](#parte-3)
- [Parte 4 — Integración completa en main.ts](#parte-4)
- [Parte 5 — Empezando la Fase 2C: Douglas–Peucker](#parte-5)
- [Apéndice A — Checklist de depuración (síntoma → causa)](#apendice-a)
- [Apéndice B — Fórmulas de una línea](#apendice-b)
- [Apéndice C — Glosario](#apendice-c)

---

<a name="parte-0"></a>

# Parte 0 — El terreno: qué hay realmente en memoria

Antes de hablar de manchas y contornos hay que tener clarísimo qué forma tiene
el dato. Todo lo demás son consecuencias de esto.

## 0.1 Qué es `binaryBuffer`

Al final de la pasada 3 tienes esto en `main.ts`:

```ts
let binaryBuffer: Uint8Array = new Uint8Array(0);   // 1 = tinta, 0 = fondo
```

Léelo literal: **un array de enteros de 1 byte, de una sola dimensión**.
No es una matriz. No hay filas. No existe `binary[y][x]`. Es una tira de
números:

```
índice:  0  1  2  3  4  5  6  7  8  9 10 11 ...
valor:   0  0  0  0  0  0  0  0  0  1  1  0 ...
```

La única razón por la que esa tira "es una imagen" es que **tú** decides que
cada `width` valores son una fila. Ese acuerdo se llama *row-major* y es el
mismo que ya usa `getImageData`.

Con `width = 8` y `height = 6`, la tira de 48 valores se lee así:

```
          x=0 x=1 x=2 x=3 x=4 x=5 x=6 x=7
  y=0      0   1   2   3   4   5   6   7
  y=1      8   9  10  11  12  13  14  15
  y=2     16  17  18  19  20  21  22  23
  y=3     24  25  26  27  28  29  30  31
  y=4     32  33  34  35  36  37  38  39
  y=5     40  41  42  43  44  45  46  47
```

Esa tabla **es** toda la Parte 0. Tenla delante mientras lees el resto de la
guía: todas las simulaciones usan esta misma numeración.

### Por qué 1 byte por píxel y no RGBA

En `data` (RGBA) el píxel `(x,y)` ocupa 4 bytes: `i = (y*width + x) * 4`.
En esta fase vas a leer cada píxel entre 8 y 20 veces. Con RGBA eso sería 4
veces más memoria movida, una multiplicación extra en cada lectura, y tres
cuartas partes del dato serían redundantes (R = G = B). Para eso existía el
Paso 2A: separar el dato del algoritmo del dato de la pantalla.

## 0.2 Las dos conversiones: `(x,y) → p` y `p → (x,y)`

### De coordenadas a índice

```
p = y * width + x
```

Se lee: "sáltate `y` filas enteras (cada una mide `width`), y luego avanza `x`".

Comprobaciones contra la tabla de arriba (`width = 8`):

| x | y | cuenta | p | ¿coincide? |
|---|---|---|---|---|
| 0 | 0 | 0·8+0 | 0 | sí |
| 3 | 0 | 0·8+3 | 3 | sí |
| 0 | 1 | 1·8+0 | 8 | sí |
| 5 | 2 | 2·8+5 | 21 | sí |
| 6 | 3 | 3·8+6 | 30 | sí |
| 2 | 4 | 4·8+2 | 34 | sí |
| 7 | 5 | 5·8+7 | 47 | sí |

### De índice a coordenadas (la que te falta escribir)

```
x = p % width
y = (p - x) / width
```

La primera es "el resto de repartir `p` en filas de `width`". La segunda es
"cuántas filas completas cabían".

Simulación con `p = 21`, `width = 8`:

```
21 = 2*8 + 5

x = 21 % 8       → 5
y = (21 - 5) / 8 = 16 / 8   → 2
```

En la tabla, el 21 está en la fila `y=2`, columna `x=5`. ✔

Más casos (tápalos y hazlos tú):

| p | x = p % 8 | y = (p−x)/8 | (x, y) |
|---|---|---|---|
| 0 | 0 | 0 | (0, 0) |
| 7 | 7 | 0 | (7, 0) |
| 8 | 0 | 1 | (0, 1) |
| 30 | 6 | 3 | (6, 3) |
| 34 | 2 | 4 | (2, 4) |
| 47 | 7 | 5 | (7, 5) |

### Por qué `(p - x) / width` y no `Math.floor(p / width)`

Dan el mismo número. La diferencia es de coste:

- `Math.floor(p / width)` → una división en coma flotante **más** una llamada
  que trunca.
- `(p - x) / width` → como ya le has quitado el resto, la división es
  **exacta**; y `x` ya lo habías calculado, así que no es trabajo extra.

En un bucle que corre 300.000 veces por frame, 60 veces por segundo, se nota.
Escribe la versión buena porque no cuesta más escribirla, no porque sea
imprescindible.

## 0.3 Los 8 vecinos

Un píxel tiene 8 vecinos: 4 por los lados y 4 por las esquinas.

**Ojo con el eje Y.** En matemáticas la `y` crece hacia arriba. En una pantalla
(y en `getImageData`) la `y` crece **hacia abajo**: la fila 0 es la de arriba.
Así que "Sur" (abajo) es `y + 1` y "Norte" (arriba) es `y - 1`. Si te olvidas
de esto, el recorrido de la Parte 3 saldrá antihorario y la Fase 2D te dará
todos los cuadriláteros con la orientación invertida.

Las dos tablas que ya tienes escritas:

```ts
//            E   SE  S   SO  O   NO  N   NE
const DX = [ 1,  1,  0, -1, -1, -1,  0,  1];
const DY = [ 0,  1,  1,  1,  0, -1, -1, -1];
```

Dibujadas alrededor del píxel central, con el índice `d` de cada dirección:

```
        5(NO)    6(N)    7(NE)
             \     |     /
              \    |    /
        4(O) ---- (x,y) ---- 0(E)
              /    |    \
             /     |     \
        3(SO)    2(S)    1(SE)
```

**El orden no es decorativo.** `d = 0,1,2,…,7` recorre las direcciones en
**sentido horario visto en pantalla** (E → SE → S → SO → O → NO → N → NE).
En la Parte 1 el orden da igual. En la Parte 3 el orden **es** el algoritmo.
Por eso conviene dejarlo bien colocado desde ahora.

### Simulación: los 8 vecinos de p = 21

`p = 21` → `x = 5`, `y = 2` (width = 8, height = 6).

| d | nombre | DX | DY | nx = 5+DX | ny = 2+DY | ¿dentro? | n = ny·8+nx |
|---|---|---|---|---|---|---|---|
| 0 | E  |  1 |  0 | 6 | 2 | sí | 22 |
| 1 | SE |  1 |  1 | 6 | 3 | sí | 30 |
| 2 | S  |  0 |  1 | 5 | 3 | sí | 29 |
| 3 | SO | -1 |  1 | 4 | 3 | sí | 28 |
| 4 | O  | -1 |  0 | 4 | 2 | sí | 20 |
| 5 | NO | -1 | -1 | 4 | 1 | sí | 12 |
| 6 | N  |  0 | -1 | 5 | 1 | sí | 13 |
| 7 | NE |  1 | -1 | 6 | 1 | sí | 14 |

Busca 22, 30, 29, 28, 20, 12, 13 y 14 en la tabla del apartado 0.1: forman un
anillo perfecto alrededor del 21. ✔

## 0.4 El bug del borde (te va a pasar; mejor entenderlo antes)

Tentación natural: "si el vecino Este es `p+1` y el Oeste es `p-1`, me ahorro
convertir a `(x,y)` y trabajo con índices planos". **No funciona.**

Simulación con `p = 16`, que es `(x=0, y=2)`, pegado al borde izquierdo:

```
vecino Oeste "plano":  p - 1 = 15
```

Mira la tabla: 15 es `(x=7, y=1)`. Está en **la fila de arriba y al otro
extremo de la imagen**. No es el vecino Oeste de nada: es el final de la fila
anterior. Se llama *wrap-around*.

Consecuencia real: una mancha del borde izquierdo se fusionaría con otra del
borde derecho de la fila de arriba. Verías un contorno gigante cruzando la
pantalla y te volverías loco buscando el fallo en el recorrido de Moore,
cuando el fallo estaría aquí.

**La regla, sin excepciones:**

```
comprobar nx y ny POR SEPARADO contra los límites
ANTES de convertirlos a un índice plano
```

```ts
if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
const n = ny * width + nx;
```

El índice plano no sabe nada de bordes: `15` es un índice perfectamente válido
dentro del array. La información "esto se salió por la izquierda" **solo existe
en `nx`**, y la destruyes en el momento en que haces la multiplicación. Por eso
el orden de esas dos líneas es innegociable.

### Ejercicio resuelto

*¿Cuáles de los 8 vecinos de `p = 7` (esquina superior derecha, width=8,
height=6) existen de verdad?*

`p = 7` → `x = 7`, `y = 0`.

| d | nombre | nx | ny | ¿válido? | por qué |
|---|---|---|---|---|---|
| 0 | E  | 8 | 0 | **no** | nx ≥ width |
| 1 | SE | 8 | 1 | **no** | nx ≥ width |
| 2 | S  | 7 | 1 | sí | n = 15 |
| 3 | SO | 6 | 1 | sí | n = 14 |
| 4 | O  | 6 | 0 | sí | n = 6 |
| 5 | NO | 6 | −1 | **no** | ny < 0 |
| 6 | N  | 7 | −1 | **no** | ny < 0 |
| 7 | NE | 8 | −1 | **no** | por partida doble |

Sobreviven 3 de 8. Fíjate en `d=0` (E): el índice plano sería `8`, que existe
como número pero es `(0,1)`, el principio de la fila siguiente.

---

<a name="parte-1"></a>

# Parte 1 — Etiquetar regiones (flood fill)

## 1.1 El problema, en una frase

Tienes 307.200 valores sueltos que valen 0 o 1. Quieres pasar a: *"hay 47
manchas; la mancha 1 son estos 830 píxeles, la mancha 2 estos 12…"*.

Una **mancha** (región conexa) es un grupo de píxeles de tinta que se tocan
entre sí. "Tocarse" hay que definirlo, y hay dos definiciones:

```
  Conectividad-4                 Conectividad-8
  (solo por los lados)           (lados Y esquinas)

       . N .                          NO N NE
       O · E                          O  ·  E
       . S .                          SO S SE
```

Mira esta imagen (width = 6):

```
      x: 0 1 2 3 4 5
 y=0:    0 0 0 0 0 0
 y=1:    0 1 0 0 0 0      ← (1,1) = índice 7
 y=2:    0 0 1 0 0 0      ← (2,2) = índice 14
 y=3:    0 0 0 0 0 0
```

- Con **conectividad-4**: 7 y 14 no se tocan (solo comparten una esquina) →
  **2 regiones**.
- Con **conectividad-8**: sí se tocan → **1 región**.

Nosotros usamos **8**. Motivo práctico: el borde de un cuadrado girado 30° es
una escalera de píxeles en diagonal. Con conectividad-4 ese borde se
rompería en trocitos y en vez de un marcador verías veinte manchitas.

## 1.2 Qué es `labels` y por qué `Int32Array`

`labels` es **otra imagen**, del mismo tamaño que `binary`, pero en vez de
"¿tinta o fondo?" guarda **"¿a qué mancha perteneces?"**:

```
binary                          labels (resultado)
0 0 0 0 0 0                     0 0 0 0 0 0
0 1 1 0 0 0                     0 1 1 0 0 0
0 1 1 0 1 0                     0 1 1 0 2 0
0 0 0 0 0 0                     0 0 0 0 0 0
```

- `0` está **reservado para el fondo**. Por eso las etiquetas empiezan en 1.
  Esto no es capricho: `labels.fill(0)` te deja la imagen entera marcada como
  "sin visitar" de un golpe, gratis.
- `Int32Array` y no `Uint8Array` porque una imagen con ruido puede tener
  **más de 255 regiones** fácilmente (verás miles). Con `Uint8Array`, la
  etiqueta 256 se convertiría en 0 y esa mancha volvería a contarse como fondo,
  para siempre, en bucle.

`labels` hace **dos trabajos a la vez**, y esto es lo importante:

1. es el **resultado** (a qué mancha pertenece cada píxel);
2. es la **marca de visitado** (`labels[p] !== 0` ⇔ "ya lo procesé").

Por eso no hace falta un tercer array `visited`. Un array menos que reservar,
menos que limpiar cada frame y menos que desincronizar.

## 1.3 El intento ingenuo, y por qué falla

Esto es, tal cual, lo que tenías escrito:

```ts
for (let p = 0; p < binary.length; p++) {
  if (binary[p] === 0 || labels[p] !== 0) continue;
  const label = nextLabel++;

  for (let d = 0; d < 8; d++) {        // mirar mis 8 vecinos
    if (esTinta(vecino)) etiquetar(vecino);
  }
}
```

Probémoslo con una mancha en forma de serpiente (width = 8):

```
      x: 0 1 2 3 4 5 6 7
 y=0:    0 0 0 0 0 0 0 0
 y=1:    0 1 1 1 1 0 0 0        índices 9, 10, 11, 12
 y=2:    0 0 0 0 1 0 0 0        índice 20
 y=3:    0 0 0 1 1 1 0 0        índices 27, 28, 29
```

El barrido encuentra el 9. Etiqueta sus vecinos: solo el 10 es tinta. Fin del
bucle de direcciones. **Se acabó.** El 11, el 12, el 20, el 27, el 28 y el 29
se quedan sin etiqueta, aunque son la misma mancha.

Peor: el barrido sigue, llega al 11, ve `labels[11] === 0`, y le da la
**etiqueta 2**. Una sola mancha partida en pedazos.

> **El fallo de fondo:** el vecino de un vecino también es de la mancha, y el
> vecino de ese también… Es una cadena de longitud desconocida, y un `for` de 8
> iteraciones solo puede dar **un paso**.

## 1.4 La idea: la pila es una lista de tareas pendientes

Lo que falta es un sitio donde **apuntar el trabajo que te queda por hacer**.

Piénsalo como limpiar una casa con habitaciones conectadas. Entras en una,
la marcas como "vista" y apuntas en un papel las puertas que salen de ahí.
Luego coges una puerta del papel, la tachas, entras, marcas, y apuntas las
puertas nuevas de esa habitación. Terminas cuando el papel queda vacío. No
cuando "no encuentras más puertas en la habitación actual", sino **cuando el
papel está vacío**.

Ese papel es la **pila**:

```ts
stack[stackSize++] = n;     // apuntar (push)
const p = stack[--stackSize];  // coger y tachar el último (pop)
```

Dos detalles de esas dos líneas, porque son la fuente de la mitad de los bugs:

- `stackSize++` es **post**-incremento: usa el valor actual como índice y
  *después* suma. Con `stackSize = 0`, escribe en `stack[0]` y deja
  `stackSize = 1`. Correcto: "hay 1 elemento".
- `--stackSize` es **pre**-decremento: resta primero y usa el resultado. Con
  `stackSize = 1`, lee `stack[0]` y deja `stackSize = 0`. Correcto.
- Si los confundes (`stack[stackSize--]` o `stack[++stackSize]`) lees basura o
  te saltas el elemento 0. No hay error en consola: solo manchas raras.

Y la clave que responde a tu duda original:

> **`stackSize` NO es "cuántos unos llevo encontrados".** Es "cuántos píxeles
> tengo pendientes de examinar". Sube y baja. Al final del flood fill vale 0,
> siempre. La cuenta de píxeles de la mancha es otra variable (`area`).

## 1.5 Simulación completa del etiquetado

Imagen `width = 8`, `height = 6`. Tres manchas a propósito:

```
      x:  0  1  2  3  4  5  6  7        índices de la fila
 y=0:     0  0  0  0  0  0  0  0         0  1  2  3  4  5  6  7
 y=1:     0  1  1  0  0  0  0  0         8  9 10 11 12 13 14 15
 y=2:     0  1  1  0  0  1  0  0        16 17 18 19 20 21 22 23
 y=3:     0  0  0  0  0  0  1  0        24 25 26 27 28 29 30 31
 y=4:     0  0  1  0  0  0  0  0        32 33 34 35 36 37 38 39
 y=5:     0  0  0  0  0  0  0  0        40 41 42 43 44 45 46 47
```

Tinta en: **9, 10, 17, 18** (cuadrado), **21, 30** (dos píxeles en diagonal),
**34** (píxel suelto).

Estado inicial: `labels` todo a 0, `nextLabel = 1`.

### Barrido, primera parte

`p = 0 … 8`: `binary[p] === 0` → `continue`. Nueve iteraciones, nada más.

`p = 9`: `binary[9] === 1` y `labels[9] === 0` → **mancha nueva**.

```
label = nextLabel++     → label = 1, nextLabel = 2
area = 0
stackSize = 0
stack[0] = 9 ; stackSize = 1        ← meter
labels[9] = 1                       ← ETIQUETAR AL METER
```

### El `while` de la mancha 1, iteración a iteración

**Iteración 1** — `pop` → `p = 9`, `stackSize = 0`, `area = 1`.
`px = 9 % 8 = 1`, `py = (9−1)/8 = 1`.

| d | dir | (nx,ny) | n | binary[n] | labels[n] | acción |
|---|---|---|---|---|---|---|
| 0 | E | (2,1) | 10 | 1 | 0 | `labels[10]=1`, push → `[10]` |
| 1 | SE | (2,2) | 18 | 1 | 0 | `labels[18]=1`, push → `[10,18]` |
| 2 | S | (1,2) | 17 | 1 | 0 | `labels[17]=1`, push → `[10,18,17]` |
| 3 | SO | (0,2) | 16 | 0 | — | nada |
| 4 | O | (0,1) | 8 | 0 | — | nada |
| 5 | NO | (0,0) | 0 | 0 | — | nada |
| 6 | N | (1,0) | 1 | 0 | — | nada |
| 7 | NE | (2,0) | 2 | 0 | — | nada |

Pila: `[10, 18, 17]`, `stackSize = 3`.

**Iteración 2** — `pop` saca **el último**, `p = 17`, `stackSize = 2`,
`area = 2`. `px = 17 % 8 = 1`, `py = (17−1)/8 = 2`.

| d | dir | (nx,ny) | n | binary[n] | labels[n] | acción |
|---|---|---|---|---|---|---|
| 0 | E | (2,2) | 18 | 1 | **1** | ya etiquetado → nada |
| 1 | SE | (2,3) | 26 | 0 | — | nada |
| 2 | S | (1,3) | 25 | 0 | — | nada |
| 3 | SO | (0,3) | 24 | 0 | — | nada |
| 4 | O | (0,2) | 16 | 0 | — | nada |
| 5 | NO | (0,1) | 8 | 0 | — | nada |
| 6 | N | (1,1) | 9 | 1 | **1** | ya etiquetado → nada |
| 7 | NE | (2,1) | 10 | 1 | **1** | ya etiquetado → nada |

Pila: `[10, 18]`. **Aquí ves el mecanismo que te preocupaba**: el 9, el 10 y el
18 se vuelven a mirar, pero cuestan una comparación cada uno. No se re-expanden.

**Iteración 3** — `pop` → `p = 18`, `stackSize = 1`, `area = 3`.
`px = 2`, `py = 2`. Vecinos: 19(0), 27(0), 26(0), 25(0), **17 ya**, **9 ya**,
**10 ya**, 11(0). No mete nada. Pila: `[10]`.

**Iteración 4** — `pop` → `p = 10`, `stackSize = 0`, `area = 4`.
`px = 2`, `py = 1`. Vecinos: 11(0), 19(0), **18 ya**, **17 ya**, **9 ya**,
1(0), 2(0), 3(0). No mete nada. Pila: `[]`.

`stackSize === 0` → **la mancha 1 se ha cerrado sola**, con `area = 4`.

> Contesta a tu frase *"una vez deje de encontrar 1, cierro ese label"*: no lo
> cierras tú. Lo cierra la pila al vaciarse, y eso significa exactamente
> "no queda ningún píxel de esta mancha por examinar". Por eso la condición es
> `while (stackSize > 0)`.

### El barrido continúa

```
p = 10 →  binary=1 pero labels[10]=1  → continue     (1 comparación)
p = 11..16 → binary=0                 → continue
p = 17 →  binary=1 pero labels[17]=1  → continue     (1 comparación)
p = 18 →  binary=1 pero labels[18]=1  → continue     (1 comparación)
p = 19, 20 → binary=0                 → continue
p = 21 →  binary=1 y labels[21]=0     → MANCHA NUEVA
```

**Mancha 2:** `label = 2`, `nextLabel = 3`. push 21, `labels[21] = 2`.

- pop 21, `area = 1`, `px = 21%8 = 5`, `py = (21−5)/8 = 2`.
  El único vecino de tinta es `d=1` (SE) → `(6,3)` = 30 → `labels[30] = 2`,
  push. Pila: `[30]`.
- pop 30, `area = 2`, `px = 6`, `py = 3`. Su único vecino de tinta es
  `d=5` (NO) → `(5,2)` = 21, pero `labels[21] = 2` → nada. Pila: `[]`.

Mancha 2 cerrada, `area = 2`. **Con conectividad-4 habrían sido dos manchas de
1 píxel.** Aquí se ve en concreto para qué sirve el 8.

```
p = 22..29 → 0
p = 30 → labels=2 → continue
p = 31..33 → 0
p = 34 → MANCHA NUEVA
```

**Mancha 3:** `label = 3`. push 34, pop 34, `area = 1`, `px = 2`, `py = 4`.
Los 8 vecinos (25,26,27,33,35,41,42,43) valen 0. Pila vacía. `area = 1`.

Es un píxel aislado — exactamente el tipo de basura que produce el umbral
adaptativo con el ruido de la cámara, y el motivo de la Parte 2.

```
p = 35..47 → 0
return nextLabel - 1 = 3
```

### Resultado final

```
labels
0 0 0 0 0 0 0 0
0 1 1 0 0 0 0 0
0 1 1 0 0 2 0 0
0 0 0 0 0 0 2 0
0 0 3 0 0 0 0 0
0 0 0 0 0 0 0 0
```

Áreas: mancha 1 → 4 px, mancha 2 → 2 px, mancha 3 → 1 px.

### La cuenta de operaciones (por qué no hay trabajo repetido)

| concepto | veces |
|---|---|
| iteraciones del barrido | 48 (una por píxel, ni una más) |
| `pop` totales | 7 (= número de píxeles de tinta) |
| comprobaciones de vecino | 7 × 8 = 56 |

Cada píxel de tinta entra en la pila **exactamente una vez** y sale
**exactamente una vez**. El coste total es proporcional al número de píxeles,
no a su cuadrado: **O(n)**. Tu miedo (*"repito casi todos los binarys"*) sería
cierto si al reencontrar un píxel etiquetado volvieras a expandirlo. La guarda
`labels[p] !== 0` es precisamente lo que convierte ese reencuentro en una
comparación y nada más.

## 1.6 Etiquetar al METER, no al sacar (el bug clásico)

Parece más natural escribir `labels[p] = label` justo después del `pop`. Vamos
a simularlo con la mancha 1 (9, 10, 17, 18) para ver qué pasa:

```
push 9                                  pila [9]
pop 9 → labels[9]=1
        vecinos de tinta SIN etiqueta: 10, 18, 17  → push los tres
                                        pila [10,18,17]
pop 17 → labels[17]=1
        vecino 18: binary=1 y labels[18] SIGUE SIENDO 0 → push otra vez
        vecino 10: binary=1 y labels[10] SIGUE SIENDO 0 → push otra vez
        vecino 9: etiquetado → nada
                                        pila [10,18,18,10]
pop 10 → labels[10]=1
        vecino 18: labels[18] todavía 0 → push otra vez
                                        pila [10,18,18,18]
pop 18 → labels[18]=1 ...
```

Tres consecuencias, de menos a más grave:

1. **`area` sale mal.** Si cuentas al sacar, esta mancha de 4 píxeles cuenta 7.
   El filtro de la Parte 2 decidirá con números falsos.
2. **La pila crece sin control.** Aquí llegó a 4 entradas para 4 píxeles. En una
   mancha real, un píxel puede entrar hasta 8 veces (una por vecino). La pila
   necesitaría `8 × pixelCount`.
3. **Y esto es lo que te va a costar una tarde:** cuando `stackSize` supera
   `stack.length`, `stack[stackSize++] = n` **no lanza ningún error**. Los
   `TypedArray` ignoran en silencio las escrituras fuera de rango. El píxel
   simplemente no se guarda. Resultado: manchas que aparecen partidas, de forma
   aleatoria, solo en imágenes grandes, sin un solo mensaje en consola.

**Regla:** `labels[n] = label` y `stack[stackSize++] = n` van **pegadas,
siempre, en ese orden**. Etiquetar al meter es lo que garantiza la invariante:

> *un píxel entra en la pila como mucho una vez en toda la ejecución.*

De esa invariante salen las dos cosas que necesitas: el coste O(n) y el tamaño
de la pila.

## 1.7 ¿Pila o cola? (DFS vs BFS)

Si en vez de sacar el último (`pop`) sacaras el primero, tendrías una **cola**,
y el algoritmo sería *búsqueda en anchura*: se expandiría en círculos desde el
píxel inicial en vez de irse por un brazo hasta el fondo.

**Para etiquetar, el resultado es idéntico.** Cambia el orden en que visitas
los píxeles, no el conjunto final. Se usa la pila porque:

- `pop` del final es `stack[--stackSize]`, aritmética pura;
- una cola sobre un array plano necesita dos índices (`head` y `tail`) y ocupa
  más, o un `Array.shift()` que es O(n) y te destroza el frame.

## 1.8 Cuánto tiene que medir `stack`

Por la invariante de 1.6, cada píxel entra como mucho una vez. Luego en el peor
caso (imagen entera de tinta) la pila contiene como mucho `width * height`
elementos. Por eso:

```ts
stackBuffer = new Int32Array(pixelCount);
```

Son 4 bytes × 307.200 = 1,2 MB. Reservados **una vez**, como `grayBuffer`.
Nunca dentro de `tick`.

¿Y no sería mejor hacerlo más pequeño para ahorrar? No: si te quedas corto,
vuelve el fallo silencioso del punto 3 de arriba. 1,2 MB es nada; una hora de
depuración, no.

## 1.9 Dónde se cuenta el área

`area++` va **justo después del `pop`**, no en el `push`.

Da el mismo número (cada píxel entra una vez y sale una vez), pero al sacar es
donde ya tienes el píxel "en la mano" y donde el bucle está garantizado que se
ejecuta una vez por píxel de la mancha. Además así `area` cuenta píxeles
*procesados*, que es justo lo que necesitará `traceBorder` en la Parte 3 para
calcular su tope de seguridad.

## 1.10 Pseudocódigo del etiquetado

<details>
<summary>▶ Pseudocódigo</summary>

```
funcion labelRegions(binary, width, height, labels, stack) -> numero de manchas

    labels.fill(0)
    nextLabel = 1

    para start desde 0 hasta binary.length - 1:

        si binary[start] != 1 o labels[start] != 0:
            continuar                       # fondo, o ya visitado

        label = nextLabel
        nextLabel = nextLabel + 1
        area = 0
        stackSize = 0

        stack[stackSize++] = start          # meter
        labels[start] = label               # etiquetar AL METER

        mientras stackSize > 0:
            p = stack[--stackSize]          # sacar
            area = area + 1
            px = p % width
            py = (p - px) / width

            para d desde 0 hasta 7:
                nx = px + DX[d]
                ny = py + DY[d]
                si nx < 0 o ny < 0 o nx >= width o ny >= height:
                    continuar               # fuera de la imagen
                n = ny * width + nx
                si binary[n] == 1 y labels[n] == 0:
                    labels[n] = label
                    stack[stackSize++] = n

    devolver nextLabel - 1
```

**Los tres niveles de anidamiento, que es lo que se te estaba mezclando:**

```
for (start ...)          ← recorre la IMAGEN, busca manchas nuevas
  while (stackSize > 0)  ← recorre UNA MANCHA, hasta agotarla
    for (d = 0..7)       ← recorre los VECINOS de un píxel
```

Tu versión tenía el `for (d)` colgando directamente del `for (start)`: por eso
solo llegabas a los vecinos directos y nunca a los vecinos de los vecinos.

</details>

## 1.11 Código: `src/cv/contour.ts`

<details>
<summary>▶ Código — reemplaza el cuerpo de labelRegions</summary>

Archivo **`src/cv/contour.ts`**, completo tal y como debe quedar en este
sub-paso (luego, en la Parte 3, esta función se convierte en `findContours`):

```ts
/**
 * FASE 2B: agrupar los pixeles de tinta en regiones conexas.
 *
 * Recibe la imagen binaria y RELLENA `labels`: cada mancha recibe un numero
 * distinto, el fondo se queda en 0. Devuelve cuantas manchas ha encontrado.
 *
 * `labels` y `stack` los reserva y los pasa quien llama (main.ts), porque es
 * quien conoce el tamano de la imagen. Este modulo no guarda nada.
 */

// Los 8 vecinos en sentido horario empezando por el Este. En pantalla la `y`
// crece hacia ABAJO, asi que "Sur" es +1.
//            E   SE  S   SO  O   NO  N   NE
const DX = [ 1,  1,  0, -1, -1, -1,  0,  1];
const DY = [ 0,  1,  1,  1,  0, -1, -1, -1];

export function labelRegions(
  binary: Uint8Array,
  width: number,
  height: number,
  labels: Int32Array,
  stack: Int32Array,
): number {
  labels.fill(0);          // borrar las etiquetas del frame anterior
  let nextLabel = 1;       // 0 esta reservado para el fondo

  // EL BARRIDO: busca el primer pixel sin visitar de cada mancha.
  for (let start = 0; start < binary.length; start++) {
    if (binary[start] !== 1 || labels[start] !== 0) continue;

    const label = nextLabel++;
    let stackSize = 0;

    // Meter y etiquetar van juntos: asi un pixel entra en la pila como
    // mucho una vez, y la pila nunca pasa de pixelCount.
    stack[stackSize++] = start;
    labels[start] = label;

    // LA EXPANSION: vaciar la pila. Cada pixel que sale aporta sus vecinos
    // de tinta todavia sin etiquetar. Termina sola cuando no queda nada
    // pendiente, no cuando "deja de haber vecinos".
    while (stackSize > 0) {
      const p = stack[--stackSize];
      const px = p % width;
      const py = (p - px) / width;

      for (let d = 0; d < 8; d++) {
        const nx = px + DX[d];
        const ny = py + DY[d];
        // Los limites se comprueban en 2D: el indice plano p-1 en el borde
        // izquierdo cae al final de la fila anterior (wrap-around).
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

        const n = ny * width + nx;
        if (binary[n] === 1 && labels[n] === 0) {
          labels[n] = label;
          stack[stackSize++] = n;
        }
      }
    }
  }

  return nextLabel - 1;    // cuantas etiquetas se han repartido
}
```

Nota: en esta versión no llevo `area` porque todavía no la usa nadie. Entra en
la Parte 2, donde por fin sirve para algo.

</details>

## 1.12 Cómo verlo funcionando

<details>
<summary>▶ Código — cambios en src/main.ts</summary>

**1. Import**, arriba del todo, junto al de `camera`:

```ts
import { labelRegions } from "./cv/contour";
```

**2. Buffers**, en la sección 1 (ESTADO), justo debajo de `binaryBuffer`:

```ts
/** Etiqueta de region de cada pixel. 0 = fondo. Int32 y no Uint8 porque una
 *  imagen con ruido pasa de 255 regiones sin despeinarse. */
let labelsBuffer = new Int32Array(0);

/** Pila del flood fill: indices de pixeles pendientes de expandir. Cabe la
 *  imagen entera porque cada pixel entra como mucho una vez. */
let stackBuffer = new Int32Array(0);
```

**3. Reserva**, dentro del `if` que ya tienes en `tick`:

```ts
if (grayBuffer.length !== pixelCount) {
  grayBuffer = new Uint8ClampedArray(pixelCount);
  integral = new Uint32Array(pixelCount);
  binaryBuffer = new Uint8Array(pixelCount);
  labelsBuffer = new Int32Array(pixelCount);
  stackBuffer = new Int32Array(pixelCount);
}
```

**4. La llamada**, después del bucle de la pasada 3 y **antes** de
`putImageData`:

```ts
// 5b. PASADA 4 -> agrupar la tinta en regiones conexas.
const regionCount = labelRegions(
  binaryBuffer, width, height, labelsBuffer, stackBuffer,
);
```

**5. Pintar cada región de un color**, justo después. Va antes de
`putImageData` porque escribe en `data`, no en el canvas:

```ts
// Color arbitrario por etiqueta: tres multiplicaciones primas dan colores
// bien repartidos y estables entre frames.
for (let p = 0; p < pixelCount; p++) {
  const label = labelsBuffer[p];
  if (label === 0) continue;            // el fondo se queda como esta
  const i = p * 4;
  data[i]     = (label * 67)  % 256;
  data[i + 1] = (label * 149) % 256;
  data[i + 2] = (label * 211) % 256;
}
```

**6. El contador**, en el bloque del `#probe` que ya tienes:

```ts
probeText.textContent =
  `Margen C: ${margin}  |  regiones: ${regionCount}  |  ` +
  `tick: ${elapsed.toFixed(1)} ms  (presupuesto 16.6 ms)`;
```

</details>

### ✅ Criterio de "esto está bien"

- Cada mancha negra sale de **un color plano distinto** de sus vecinas.
- **Ninguna mancha sale de dos colores.** Si pasa, tu expansión no llega a los
  vecinos de los vecinos.
- **Ningún color cruza** de una mancha a otra separada. Si pasa, mira el
  wrap-around del borde (0.4).
- `regiones:` marcará **entre cientos y miles**. Eso es **correcto** y es todo
  el motivo de la Parte 2: el ruido del umbral adaptativo genera muchísimas
  manchitas de 1-5 píxeles. Primero verlo, luego arreglarlo.
- Los colores **parpadean** entre frames aunque no muevas la cámara: normal.
  La etiqueta de una mancha depende del orden del barrido, y basta que aparezca
  una manchita de ruido antes para que todas las siguientes se desplacen.

---

<a name="parte-2"></a>

# Parte 2 — Filtrar por tamaño

## 2.1 Por qué hay 3.000 regiones

El umbral adaptativo compara cada píxel con la media de su ventana. En una zona
uniforme (una pared) la media es casi igual al píxel, así que el resultado lo
decide el **ruido del sensor**, que es aleatorio. Salen píxeles de tinta
sueltos, repartidos por todas partes, distintos en cada frame.

Un marcador de 200×200 píxeles tiene un área de 40.000. El ruido tiene áreas de
1 a 5. **Separarlos es trivial si tienes el área**, y ya la tienes: la cuenta
del `while`.

## 2.2 Los dos umbrales

```ts
const MIN_AREA = 100;                 // ~10x10 px: menos que eso no es marcador
const MAX_AREA = pixelCount / 4;      // mas de 1/4 de pantalla: es la pared
```

- `MIN_AREA` mata el ruido.
- `MAX_AREA` mata el caso "la habitación está a contraluz y media pantalla se
  ha vuelto tinta": una región de 200.000 píxeles cuyo borde tiene 3.000 puntos
  que luego Douglas–Peucker tendría que simplificar, para nada.

Estos números son **hiperparámetros**: se ajustan mirando. Con 640×480,
`MIN_AREA = 100` es un buen punto de partida.

## 2.3 Por qué el filtro va ANTES de trazar el borde

Coste de etiquetar una mancha de 3 píxeles: 3 `pop`, 24 comprobaciones. Barato,
y además inevitable (hay que etiquetarla para saber que es pequeña).

Coste de trazar su borde y guardarlo: crear un `Point[]`, hacer `push` de
objetos `{x, y}`… **eso son allocations**, y son el enemigo del hot loop. Con
3.000 manchas de ruido serían 3.000 arrays y miles de objetos por frame, todos
basura inmediata para el recolector.

Por eso el orden dentro del barrido es:

```
1. etiquetar la mancha entera  (barato, inevitable)
2. ¿area fuera de rango? → continue, sin crear nada
3. solo si sobrevive: trazar el borde y guardar el contorno
```

## 2.4 Código: añadir `area` y el filtro

<details>
<summary>▶ Código — src/cv/contour.ts</summary>

Cambios sobre lo de la Parte 1: la función pasa a llamarse `findContours`,
devuelve una lista y acepta los dos umbrales. Añade arriba los tipos:

```ts
export interface Point {
  x: number;
  y: number;
}

export interface Contour {
  /** Pixeles del borde exterior, en orden horario. */
  points: Point[];
  /** Pixeles que ocupa la region entera. */
  area: number;
}
```

Y la firma y el cuerpo:

```ts
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

    // --- 3. Recorrer el borde exterior (Parte 3) ---
    contours.push({
      points: traceBorder(labels, width, height, start, label, area),
      area,
    });
  }

  return contours;
}
```

Fíjate en que la mancha descartada **sí se etiqueta**. Tiene que ser así: si no
la etiquetaras, el barrido volvería a encontrarla píxel a píxel y le daría una
etiqueta nueva a cada uno.

</details>

---

<a name="parte-3"></a>

# Parte 3 — El contorno ordenado (recorrido de Moore)

## 3.1 Por qué un conjunto de píxeles no sirve

Sacar "los píxeles del borde" es fácil: son los que tienen algún vecino de
fondo. Un bucle y listo. **Y no sirve de nada.**

Mira este cuadrado de 3×3 (width = 5):

```
      x: 0 1 2 3 4        índices
 y=0:    0 0 0 0 0         0  1  2  3  4
 y=1:    0 1 1 1 0         5  6  7  8  9
 y=2:    0 1 1 1 0        10 11 12 13 14
 y=3:    0 1 1 1 0        15 16 17 18 19
 y=4:    0 0 0 0 0        20 21 22 23 24
```

El **conjunto** del borde es `{6,7,8,11,13,16,17,18}` — o cualquier otro orden,
porque un conjunto no tiene orden. Con eso no puedes:

- medir el perímetro (¿en qué orden sumo las distancias?);
- decir "este tramo es una recta" (¿qué tramo?);
- y sobre todo, **no puedes aplicar Douglas–Peucker**, que necesita una
  *polilínea*: punto 0, punto 1, punto 2…, cada uno al lado del siguiente.

Lo que necesitas es la **lista ordenada**:

```
(1,1) → (2,1) → (3,1) → (3,2) → (3,3) → (2,3) → (1,3) → (1,2) → y vuelta al inicio
```

Eso es un contorno. La palabra clave es **ordenado**, y conseguir ese orden es
todo el algoritmo de esta parte.

## 3.2 La hormiga con la mano en la pared

La imagen mental exacta:

> Eres una hormiga de pie **sobre un píxel de la mancha**, con la mano
> izquierda apoyada en un píxel de **fondo**. Avanzas manteniendo la mano
> siempre tocando la pared. Así das la vuelta al contorno entero y acabas
> volviendo al sitio donde empezaste.

Traducido a algoritmo, en cada paso necesitas dos datos:

1. `(px, py)` — dónde estás (píxel de la mancha);
2. `(bx, by)` — **el punto de apoyo**: el último píxel de fondo que
   comprobaste. Es la "mano en la pared".

Y la regla del paso:

> Mira tus 8 vecinos **en sentido horario, empezando justo después del punto de
> apoyo**. El primero que pertenezca a la mancha es tu siguiente posición.

## 3.3 Por qué el píxel inicial siempre tiene el Oeste libre

El recorrido necesita empezar con una "mano en la pared" **garantizada**. Ese
regalo te lo hace el barrido, y merece la pena entender por qué.

El barrido va fila a fila (`y` creciente) y dentro de cada fila de izquierda a
derecha (`x` creciente). Por tanto, el primer píxel de una mancha que encuentra
es:

- de la fila **más alta** de la mancha (si hubiera uno más arriba, lo habría
  encontrado antes);
- y, dentro de esa fila, el de **`x` más pequeña**.

Llámalo `(sx, sy)`. ¿Qué hay en `(sx−1, sy)`?

- Si fuera de la mancha, tendría `x` menor en la misma fila → contradicción con
  "el de x más pequeña".
- Luego es fondo, o está fuera de la imagen.

**Siempre.** Por eso el punto de apoyo inicial es `(sx−1, sy)`, sin
comprobar nada. Y si `sx = 0`, ese punto está fuera de la imagen: da igual,
nunca se lee su valor, solo se usa **la dirección** en la que está.

## 3.4 Las dos fórmulas con `% 8`

```ts
d = (d + 1) % 8;          // siguiente dirección en sentido horario
const back = (d + 7) % 8; // la dirección ANTERIOR a d
```

- `(d + 1) % 8`: gira un paso horario. De `7` (NE) pasa a `0` (E), que es el
  siguiente en el reloj. El `% 8` es lo que cierra el círculo.
- `(d + 7) % 8` es **`d − 1` sin números negativos**. En JavaScript
  `(-1) % 8 === -1` (el resto conserva el signo del dividendo), lo que daría
  `DX[-1] === undefined` y todo `NaN` a partir de ahí. Sumar 7 en vez de restar
  1 es el mismo giro y nunca sale del rango.

Comprueba: `d = 0` → `(0+7)%8 = 7`. La dirección anterior a E es NE. ✔ en el
reloj del apartado 0.3.

### Por qué el nuevo punto de apoyo es `(d + 7) % 8`

Cuando encuentras la mancha en la dirección `d`, la dirección que comprobaste
**justo antes** fue `d − 1`, y era fondo (si no, te habrías parado ahí). Ese es
tu nuevo punto de apoyo: la mano sigue pegada a la pared, en el último trozo de
pared que tocaste.

Sutileza importante: `bx`, `by` se calculan **desde la posición vieja**
(`px`, `py`), no desde la nueva. Por eso en el código el cálculo del `back` va
**antes** de `px = nx`.

## 3.5 Simulación 1 — cuadrado 3×3 (la simulación importante)

Misma imagen del apartado 3.1. `width = 5`, `height = 5`.
Tinta: (1,1) (2,1) (3,1) (1,2) (2,2) (3,2) (1,3) (2,3) (3,3). `area = 9`.

Estado inicial:

```
start = 6 → (sx, sy) = (1, 1)
px, py  = (1, 1)
bx, by  = (0, 1)        ← el vecino Oeste, fondo garantizado
points  = [ (1,1) ]
maxSteps = 2*9 + 8 = 26
```

En cada paso: `d` de partida = dirección en la que está el apoyo, o sea
`directionIndex(bx − px, by − py)`.

---

**PASO 1** · `p = (1,1)` · apoyo `(0,1)`

```
bx-px, by-py = (0-1, 1-1) = (-1, 0) = Oeste = d 4
```

| k | d = (d+1)%8 | dir | vecino | ¿mancha? |
|---|---|---|---|---|
| 0 | 5 | NO | (0,0) | no |
| 1 | 6 | N  | (1,0) | no |
| 2 | 7 | NE | (2,0) | no |
| 3 | **0** | **E** | **(2,1)** | **SÍ** |

```
back  = (0+7)%8 = 7 (NE)  →  apoyo nuevo = (1,1) + NE = (2,0)
posición nueva = (2,1)
¿es el inicio (1,1)? no → points = [(1,1), (2,1)]
```

---

**PASO 2** · `p = (2,1)` · apoyo `(2,0)`

```
(2-2, 0-1) = (0,-1) = Norte = d 6
```

| k | d | dir | vecino | ¿mancha? |
|---|---|---|---|---|
| 0 | 7 | NE | (3,0) | no |
| 1 | **0** | **E** | **(3,1)** | **SÍ** |

```
back = 7 (NE) → apoyo = (2,1) + NE = (3,0)
posición = (3,1)   →  points = [..., (3,1)]
```

---

**PASO 3** · `p = (3,1)` · apoyo `(3,0)`

```
(3-3, 0-1) = (0,-1) = Norte = d 6
```

| k | d | dir | vecino | ¿mancha? |
|---|---|---|---|---|
| 0 | 7 | NE | (4,0) | no |
| 1 | 0 | E  | (4,1) | no |
| 2 | 1 | SE | (4,2) | no |
| 3 | **2** | **S** | **(3,2)** | **SÍ** |

```
back = (2+7)%8 = 1 (SE) → apoyo = (3,1) + SE = (4,2)
posición = (3,2)
```

Aquí ha doblado la esquina. Fíjate en que ha comprobado 4 direcciones: el
barrido en abanico horario es lo que hace que gire **pegado** a la mancha.

---

**PASO 4** · `p = (3,2)` · apoyo `(4,2)`

```
(4-3, 2-2) = (1,0) = Este = d 0
```

| k | d | dir | vecino | ¿mancha? |
|---|---|---|---|---|
| 0 | 1 | SE | (4,3) | no |
| 1 | **2** | **S** | **(3,3)** | **SÍ** |

```
back = 1 (SE) → apoyo = (3,2) + SE = (4,3)
posición = (3,3)
```

---

**PASO 5** · `p = (3,3)` · apoyo `(4,3)`

```
(1,0) = Este = d 0
```

| k | d | dir | vecino | ¿mancha? |
|---|---|---|---|---|
| 0 | 1 | SE | (4,4) | no |
| 1 | 2 | S  | (3,4) | no |
| 2 | 3 | SO | (2,4) | no |
| 3 | **4** | **O** | **(2,3)** | **SÍ** |

```
back = (4+7)%8 = 3 (SO) → apoyo = (3,3) + SO = (2,4)
posición = (2,3)
```

---

**PASO 6** · `p = (2,3)` · apoyo `(2,4)`

```
(2-2, 4-3) = (0,1) = Sur = d 2
```

| k | d | dir | vecino | ¿mancha? |
|---|---|---|---|---|
| 0 | 3 | SO | (1,4) | no |
| 1 | **4** | **O** | **(1,3)** | **SÍ** |

```
back = 3 (SO) → apoyo = (2,3) + SO = (1,4)
posición = (1,3)
```

---

**PASO 7** · `p = (1,3)` · apoyo `(1,4)`

```
(0,1) = Sur = d 2
```

| k | d | dir | vecino | ¿mancha? |
|---|---|---|---|---|
| 0 | 3 | SO | (0,4) | no |
| 1 | 4 | O  | (0,3) | no |
| 2 | 5 | NO | (0,2) | no |
| 3 | **6** | **N** | **(1,2)** | **SÍ** |

```
back = (6+7)%8 = 5 (NO) → apoyo = (1,3) + NO = (0,2)
posición = (1,2)
```

---

**PASO 8** · `p = (1,2)` · apoyo `(0,2)`

```
(0-1, 2-2) = (-1,0) = Oeste = d 4
```

| k | d | dir | vecino | ¿mancha? |
|---|---|---|---|---|
| 0 | 5 | NO | (0,1) | no |
| 1 | **6** | **N** | **(1,1)** | **SÍ** |

```
posición = (1,1) === (sx, sy)  →  BREAK, sin hacer push
```

---

### Resultado

```
points = [ (1,1), (2,1), (3,1), (3,2), (3,3), (2,3), (1,3), (1,2) ]
           ─────────────────►  ────────►  ◄───────────  ◄────────
              E   E              S   S       O   O        N   N
```

8 puntos, las 8 casillas del borde, **en orden**, y el sentido es
**horario en pantalla** (derecha, abajo, izquierda, arriba). El píxel central
(2,2) no aparece: no es borde. ✔

Dos cosas para fijar:

- El inicio `(1,1)` se mete en `points` **antes** del bucle, y cuando se vuelve
  a él se sale **sin** meterlo otra vez. Si no, el primer punto saldría
  duplicado y Douglas–Peucker vería un segmento de longitud 0.
- Se usaron 8 pasos de los 26 permitidos.

## 3.6 Simulación 2 — una línea de 1 píxel de grosor

Esta explica el `2 * area + 8`. `width = 5`, `height = 3`:

```
      x: 0 1 2 3 4
 y=0:    0 0 0 0 0
 y=1:    0 1 1 1 0          tinta: (1,1) (2,1) (3,1), area = 3
 y=2:    0 0 0 0 0
```

```
start = (1,1), apoyo (0,1) = Oeste = d 4, points = [(1,1)]
maxSteps = 2*3 + 8 = 14
```

**PASO 1** · `p=(1,1)`, apoyo `(0,1)`, d=4 → prueba NO(0,0) no, N(1,0) no,
NE(2,0) no, **E(2,1) sí**. back = NE → apoyo `(2,0)`. `points += (2,1)`.

**PASO 2** · `p=(2,1)`, apoyo `(2,0)`, d=6 (N) → NE(3,0) no, **E(3,1) sí**.
back = NE → apoyo `(3,0)`. `points += (3,1)`.

**PASO 3** · `p=(3,1)`, apoyo `(3,0)`, d=6 (N) → NE(4,0) no, E(4,1) no,
SE(4,2) no, S(3,2) no, SO(2,2) no, **O(2,1) sí**. back = SO → apoyo `(2,2)`.
`points += (2,1)`  ← **otra vez el (2,1)**

**PASO 4** · `p=(2,1)`, apoyo `(2,2)`, d=2 (S) → SO(1,2) no, **O(1,1) sí** =
inicio → BREAK.

```
points = [ (1,1), (2,1), (3,1), (2,1) ]
```

El píxel `(2,1)` aparece **dos veces**: una a la ida y otra a la vuelta. Es
correcto y es inevitable: el contorno de una línea sin interior la recorre por
los dos lados. De ahí sale el tope:

> una figura de área `A` tiene como mucho `2A` pasos de borde (cada píxel se
> pisa una vez por cada "lado"), y el `+8` cubre las figuras minúsculas donde
> `2A` se queda corto.

`maxSteps` es un **cinturón de seguridad**, no parte del algoritmo. Si alguna
vez se agota, es que hay un bug; sin él, tendrías un bucle infinito dentro de
`requestAnimationFrame` y la pestaña se congelaría.

## 3.7 Simulación 3 — píxel aislado

Un píxel de tinta sin ningún vecino de tinta. En el PASO 1 se prueban las 8
direcciones y ninguna es de la mancha: el bucle `k` termina con `found = false`.

```
if (!found) break;   // pixel aislado: no hay borde que recorrer
points = [ (sx, sy) ]
```

Sin ese `if`, `found` se quedaría en falso y la posición no cambiaría: el
`for (step)` daría las 10 vueltas de `maxSteps` sin avanzar. No sería un cuelgue
(por el tope), pero sí trabajo tirado. Con `MIN_AREA = 100` este caso ni
siquiera llega aquí, pero el código tiene que aguantarlo igual.

## 3.8 La condición de parada y su límite conocido

Paramos al volver al píxel inicial. Es simple y funciona para figuras normales.

**Dónde falla:** una región con un "pellizco" de 1 píxel de ancho justo en su
esquina superior-izquierda puede pasar por el píxel inicial **dos veces**
durante una sola vuelta, y saldría un contorno truncado.

La solución estricta (criterio de Jacob) es parar cuando se repite el par
*(píxel, dirección de entrada)*, no solo el píxel. No lo implementamos: esas
formas no son cuadriláteros y el filtro de la Fase 2D las tirará de todas
formas. **Es una limitación asumida y documentada**, que es distinto de un bug.

## 3.9 Por qué se traza sobre `labels` y no sobre `binary`

`traceBorder` pregunta `labels[n] === label`, no `binary[n] === 1`.

Con conectividad-8 las dos preguntas dan lo mismo: dos manchas distintas nunca
pueden tocarse (si se tocaran, el flood fill las habría unido). Se usa `labels`
porque:

1. **Dice lo que quieres decir**: "¿esto es *mi* mancha?", no "¿esto es tinta?".
2. Te protege si algún día pruebas conectividad-4, donde dos etiquetas
   **sí** pueden ser vecinas en diagonal y `binary` te haría saltar a la mancha
   equivocada a mitad del recorrido.

## 3.10 Pseudocódigo del recorrido

<details>
<summary>▶ Pseudocódigo</summary>

```
funcion traceBorder(labels, width, height, start, label, area) -> lista de puntos

    sx = start % width
    sy = (start - sx) / width
    points = [ (sx, sy) ]

    px, py = sx, sy              # donde estoy
    bx, by = sx - 1, sy          # punto de apoyo: el Oeste, fondo garantizado

    maxSteps = 2 * area + 8

    para step desde 0 hasta maxSteps - 1:

        d = indiceDeDireccion(bx - px, by - py)   # hacia donde esta el apoyo
        found = falso

        para k desde 0 hasta 7:
            d = (d + 1) mod 8                     # siguiente, sentido horario
            nx = px + DX[d]
            ny = py + DY[d]

            si (nx,ny) esta dentro y labels[ny*width+nx] == label:
                back = (d + 7) mod 8              # la direccion anterior: fondo
                bx = px + DX[back]                # OJO: desde la posicion VIEJA
                by = py + DY[back]
                px = nx
                py = ny
                found = cierto
                salir del bucle k

        si no found: salir            # pixel aislado
        si (px,py) == (sx,sy): salir  # vuelta completa
        points.push( (px, py) )

    devolver points
```

Y la función auxiliar:

```
funcion indiceDeDireccion(dx, dy) -> 0..7
    para d desde 0 hasta 7:
        si DX[d] == dx y DY[d] == dy: devolver d
    lanzar error("Direccion invalida")
```

El `throw` no es paranoia decorativa: si alguna vez llega un `(dx,dy)` que no
es uno de los 8, significa que el punto de apoyo se ha descolocado. Mejor un
error ruidoso en el sitio exacto que contornos mal en silencio.

</details>

## 3.11 Código: `traceBorder`

<details>
<summary>▶ Código — se añade al final de src/cv/contour.ts</summary>

```ts
/** Indice (0-7) de la direccion (dx,dy). */
function directionIndex(dx: number, dy: number): number {
  for (let d = 0; d < 8; d++) {
    if (DX[d] === dx && DY[d] === dy) return d;
  }
  throw new Error(`Direccion invalida (${dx}, ${dy})`);
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
  // Al empezar es el vecino Oeste, que el barrido garantiza que es fondo.
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
        // nuevo punto de apoyo. Se calcula desde la posicion vieja.
        const back = (d + 7) % 8;
        bx = px + DX[back];
        by = py + DY[back];
        px = nx;
        py = ny;
        found = true;
        break;
      }
    }

    if (!found) break;                 // pixel aislado: no hay borde
    if (px === sx && py === sy) break; // vuelta completa
    points.push({ x: px, y: py });
  }

  return points;
}
```

</details>

### ✅ Criterio de "esto está bien"

Pinta los puntos de cada contorno en rojo sobre el canvas: **el borde de cada
mancha grande debe quedar perfilado con una línea roja de 1 píxel, cerrada**.

- Si sale una línea roja **abierta**, mira la condición de parada / `maxSteps`.
- Si la mancha sale **rellena de rojo**, estás pintando `labels`, no `points`.
- Si el perfilado **se sale** de la mancha, el `inRegion` está comparando mal
  (¿`binary` en vez de `labels`? ¿`label` equivocado?).

---

<a name="parte-4"></a>

# Parte 4 — Integración completa en `main.ts`

<details>
<summary>▶ Código — todo lo que cambia en src/main.ts</summary>

**Import** (arriba):

```ts
import { findContours } from "./cv/contour";
```

Solo eso. **No importes `Contour`**: tu `tsconfig` tiene
`noUnusedLocals: true`, y aquí no necesitas nombrar el tipo en ningún sitio —
`const contours = findContours(...)` y `for (const contour of contours)` lo
infieren solos. Si algún día sí tienes que nombrarlo (por ejemplo para declarar
una variable de estado), tendrá que ser con **`import type { Contour }`**,
porque `verbatimModuleSyntax: true` obliga a marcar como `type` todo lo que
solo existe en tiempo de compilación.

**Constantes** (sección 1, junto a `WINDOW_RADIUS`):

```ts
/** Area minima de una region para que valga la pena mirarla. Por debajo es
 *  ruido del sensor: manchitas de 1-5 px repartidas por toda la imagen. */
const MIN_AREA = 100;
```

**Buffers** (sección 1, debajo de `binaryBuffer`): `labelsBuffer` y
`stackBuffer`, como en la Parte 1.

**Dentro de `tick`**, después de la pasada 3 y **antes** de `putImageData`:

```ts
// 6. PASADA 4 -> regiones conexas y su borde exterior.
const contours = findContours(
  binaryBuffer,
  width,
  height,
  labelsBuffer,
  stackBuffer,
  MIN_AREA,
  pixelCount / 4,
);

// 7. Pintar los bordes encontrados en rojo, sobre los mismos pixeles.
for (const contour of contours) {
  for (const point of contour.points) {
    const i = (point.y * width + point.x) * 4;
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 0;
  }
}

// 8. Devolver los pixeles al canvas.
canvasContext.putImageData(frame, 0, 0);
```

**Probe**:

```ts
probeText.textContent =
  `Margen C: ${margin}  |  contornos: ${contours.length}  |  ` +
  `tick: ${elapsed.toFixed(1)} ms  (presupuesto 16.6 ms)`;
```

</details>

## 4.1 Qué mirar cuando ya funcione

| observación | qué significa |
|---|---|
| `contornos:` baja de miles a decenas | el filtro por área hace su trabajo |
| `tick` sube 2-4 ms | normal: es una pasada más sobre la imagen |
| `tick` sube 20 ms | seguramente estás trazando bordes de ruido: revisa que el `continue` del área esté **antes** del `push` del contorno |
| los números bailan mucho frame a frame | normal con ruido; se estabiliza al bajar el margen del slider |

## 4.2 Sobre el rendimiento (contexto, no tarea de ahora)

`findContours` crea objetos `{x, y}`: uno por punto de borde. Con 30 contornos
de 200 puntos son 6.000 objetos por frame, 360.000 por segundo. Eso es
exactamente lo que dice `CLAUDE.md` que no se hace en el hot loop.

**No lo optimices ahora.** Es una decisión consciente: `Point[]` es mucho más
fácil de razonar y Douglas–Peucker (Parte 5) se escribe en la mitad de líneas.
La Fase 9 existe para esto, y para entonces tendrás medidas de verdad que digan
si hace falta. Optimizar antes de medir es perder tiempo dos veces.

---

<a name="parte-5"></a>

# Parte 5 — Empezando la Fase 2C: Douglas–Peucker

> Esta parte te deja el siguiente paso arrancado. Léela cuando la Parte 3 te
> funcione en pantalla.

## 5.1 El problema

El contorno de un marcador de 200×200 tiene unos **800 puntos**. Tú quieres
**4**: las esquinas. Y no puedes buscar "las esquinas" directamente, porque no
sabes cuántas hay ni dónde están: puede ser un folio (4), una mano (30) o una
moneda (redonda, infinitas).

Lo que sí puedes hacer es **simplificar**: quitar todos los puntos que estén
"casi en línea recta" con sus compañeros. Si al final quedan exactamente 4, es
un cuadrilátero.

## 5.2 La idea de Douglas–Peucker, con un dibujo

```
    A ·······················  B        cuerda A-B (recta entre los extremos)
         ·   ·        ·
           ·    ·  ·  ← el punto M, el MÁS ALEJADO de la cuerda
```

1. Traza la **cuerda** del primer al último punto.
2. Busca el punto intermedio **más alejado** de esa cuerda. Llámalo `M`, y a su
   distancia `dmax`.
3. Si `dmax <= epsilon` → todos los intermedios están "casi en la cuerda":
   **se tiran todos**, el tramo se resume en la recta A-B.
4. Si `dmax > epsilon` → `M` es un vértice de verdad: **se conserva**, y se
   repite el proceso en los dos tramos `A..M` y `M..B`.

`epsilon` es "cuánto me permito equivocarme, en píxeles". Es lo único que
decides tú.

## 5.3 Distancia a la RECTA vs distancia al SEGMENTO

Esta es la trampa del algoritmo. Ejemplo numérico:

```
segmento: A = (0,0) → B = (4,0)
punto:    P = (6,1)

    A────────B      P
    0        4     6,1
```

- Distancia de P a la **recta infinita** que pasa por A y B (el eje X): **1**.
- Distancia de P al **segmento** A-B (que se acaba en x=4):
  `hypot(6−4, 1−0) = hypot(2,1) = 2.236`.

El segundo es el bueno: P está *más allá* del final del segmento, así que lo
que le queda cerca es **el extremo B**, no una recta imaginaria que sigue hasta
el infinito.

La cuenta que arregla esto es la **proyección recortada**:

```
t = ((P−A) · (B−A)) / |B−A|²        ← en qué fracción del segmento cae P
```

- `t = 0` → P se proyecta justo en A
- `t = 1` → P se proyecta justo en B
- `t = 0.5` → en el punto medio
- `t < 0` o `t > 1` → **fuera del segmento**

Con los números del ejemplo:

```
P−A = (6,1)      B−A = (4,0)      |B−A|² = 16
t = (6*4 + 1*0) / 16 = 24/16 = 1.5      → se sale por la derecha
t recortado a [0,1] → 1
punto más cercano Q = A + 1*(B−A) = (4,0) = B
distancia = hypot(6−4, 1−0) = 2.236  ✔
```

Y el caso degenerado: si `A == B`, entonces `|B−A|² = 0` y `t` sería una
división por cero (`NaN`, que envenena todas las comparaciones en silencio,
porque `NaN > epsilon` es `false` y nunca salta un error). Hay que
cortocircuitarlo: si la longitud es 0, la distancia es la distancia a `A`.

## 5.4 Simulación completa de Douglas–Peucker

Polilínea **abierta** de 9 puntos, `epsilon = 1.5`:

```
índice:  0      1      2      3      4      5      6      7      8
punto:  (0,0)  (1,1)  (2,0)  (3,0)  (4,3)  (5,0)  (6,0)  (7,0)  (8,0)

  3 |                      P4
  2 |                     /  \
  1 |    P1              /    \
  0 | P0    P2  P3      /      P5  P6  P7  P8
    +-----------------------------------------
      0  1  2  3  4  5  6  7  8
```

Se conservan siempre los extremos: `keep = {0, 8}`.

---

**LLAMADA 1 — tramo (0, 8)**

Cuerda de (0,0) a (8,0): es horizontal, así que la distancia es directamente
`|y|`.

| i | punto | distancia |
|---|---|---|
| 1 | (1,1) | 1 |
| 2 | (2,0) | 0 |
| 3 | (3,0) | 0 |
| 4 | (4,3) | **3** ← máximo |
| 5 | (5,0) | 0 |
| 6 | (6,0) | 0 |
| 7 | (7,0) | 0 |

`dmax = 3 > 1.5` → **se conserva el índice 4**. Se generan los tramos
`(0,4)` y `(4,8)`.

---

**LLAMADA 2 — tramo (0, 4)**

Cuerda de A=(0,0) a B=(4,3). Aquí ya no vale mirar la `y`: hay que usar la
fórmula. Longitud del segmento = `hypot(4,3) = 5`. Para una cuerda, la
distancia perpendicular es `|cruz| / longitud`, con
`cruz = (B−A).x·(P−A).y − (B−A).y·(P−A).x = 4·Py − 3·Px`.

| i | punto | cruz = 4·y − 3·x | distancia = \|cruz\|/5 |
|---|---|---|---|
| 1 | (1,1) | 4−3 = 1 | 0.2 |
| 2 | (2,0) | 0−6 = −6 | 1.2 |
| 3 | (3,0) | 0−9 = −9 | **1.8** ← máximo |

`dmax = 1.8 > 1.5` → **se conserva el índice 3**. Tramos `(0,3)` y `(3,4)`.

---

**LLAMADA 3 — tramo (0, 3)**

Cuerda de (0,0) a (3,0), horizontal otra vez.

| i | punto | distancia |
|---|---|---|
| 1 | (1,1) | 1 |
| 2 | (2,0) | 0 |

`dmax = 1 <= 1.5` → **no se conserva nada**. Los puntos 1 y 2 desaparecen: el
tramo se aproxima por la recta (0,0)-(3,0).

---

**LLAMADA 4 — tramo (3, 4)**

Índices consecutivos: no hay ningún punto intermedio (`for i = 4; i < 4` no
entra). Nada que hacer.

---

**LLAMADA 5 — tramo (4, 8)**

Cuerda de A=(4,3) a B=(8,0). `B−A = (4,−3)`, longitud 5.
`cruz = 4·(y−3) − (−3)·(x−4) = 3x + 4y − 24`.

| i | punto | cruz | distancia |
|---|---|---|---|
| 5 | (5,0) | 15+0−24 = −9 | **1.8** ← máximo |
| 6 | (6,0) | 18−24 = −6 | 1.2 |
| 7 | (7,0) | 21−24 = −3 | 0.6 |

`dmax = 1.8 > 1.5` → **se conserva el índice 5**. Tramos `(4,5)` y `(5,8)`.

---

**LLAMADA 6 — tramo (4, 5)**: consecutivos, nada.

**LLAMADA 7 — tramo (5, 8)**: cuerda (5,0)-(8,0), horizontal.
Distancias de (6,0) y (7,0) = 0. `dmax = 0 <= 1.5` → se tiran los dos.

---

### Resultado

```
keep = {0, 3, 4, 5, 8}

9 puntos  →  5 vértices:  (0,0) (3,0) (4,3) (5,0) (8,0)
```

El pico se ha conservado entero (con su base a cada lado, que es lo que le da
forma) y el bultito pequeño de `(1,1)` ha desaparecido. Sube `epsilon` a 2 y
verás que el resultado pasa a ser `(0,0) (4,3) (8,0)`: 3 vértices. Ese es el
mando que controla cuánto simplificas.

## 5.5 De recursivo a iterativo (con pila, otra vez)

El algoritmo se describe solo como recursión ("repite el proceso a cada lado"),
pero un contorno con miles de puntos puede anidar mucho, y la pila de llamadas
de JavaScript no es infinita. Misma solución que en el flood fill: **pila
propia**, aquí de **pares** `(a, b)`.

```
pending = [first, last]
mientras pending no esté vacía:
    b = pending.pop()
    a = pending.pop()      ← OJO al orden: LIFO, sale primero el último metido
    ...
    si dmax > epsilon:
        keep[farthest] = cierto
        pending.push(a, farthest, farthest, b)   ← mete los DOS subtramos
```

Fíjate: se mete `(a, farthest)` y `(farthest, b)` como cuatro números seguidos.
Y al sacar, **primero `b` y luego `a`**, porque una pila devuelve en orden
inverso. Si los sacas al revés, procesarás tramos con `a > b` y el bucle
interno no entrará nunca: contornos que se simplifican a dos puntos sin motivo
aparente.

En vez de construir listas nuevas en cada nivel, se marca en un array de
booleanos `keep[]` y al final se recorre una sola vez en orden. Así los vértices
salen **ordenados** sin tener que ordenarlos.

## 5.6 El contorno cerrado

Douglas–Peucker necesita un principio y un final. Tu contorno es un **ciclo**:
el último punto es vecino del primero. Si le pasas `(0, n−1)` tal cual, la
cuerda va del punto inicial al último… que están pegados, y el resultado no
tiene ningún sentido.

**La solución: partirlo en dos polilíneas abiertas.**

1. Busca el punto `far` **más lejano** de `points[0]` (en distancia al cuadrado,
   que te ahorras la raíz: para comparar, `d²` ordena igual que `d`).
2. Eso te da dos mitades: `0..far` y `far..final`.
3. Simplifica cada mitad por separado y une los resultados.

Y un truco para no tratar el cierre como caso especial: añade una copia de
`points[0]` al final del array (índice `n`). Así la segunda mitad es
literalmente el tramo `(far, n)`, sin ninguna aritmética modular.

Elegir el punto más lejano no es casualidad: garantiza que las dos mitades son
tramos largos y bien definidos. Si partieras por un punto cualquiera podrías
cortar justo en mitad de un lado recto, y ese corte se convertiría en un
vértice falso.

## 5.7 `epsilon` proporcional

```ts
const epsilon = 0.03 * contour.points.length;
```

Con un valor fijo (digamos 3 px), un marcador cercano de 800 puntos de
perímetro se simplificaría demasiado poco, y uno lejano de 80 puntos demasiado.
Haciéndolo proporcional al número de puntos (que es aproximadamente el
perímetro), **el mismo marcador da el mismo polígono esté cerca o lejos**. Eso
es lo que quieres: invariancia a la escala.

## 5.8 Pseudocódigo de la Fase 2C

<details>
<summary>▶ Pseudocódigo</summary>

```
funcion distanceToSegment(p, a, b) -> numero
    dx = b.x - a.x
    dy = b.y - a.y
    length2 = dx*dx + dy*dy
    si length2 == 0:                     # a y b son el mismo punto
        devolver hypot(p.x - a.x, p.y - a.y)
    t = ((p.x - a.x)*dx + (p.y - a.y)*dy) / length2
    t = recortar t a [0, 1]
    qx = a.x + t*dx
    qy = a.y + t*dy
    devolver hypot(p.x - qx, p.y - qy)


funcion simplifyRange(points, first, last, epsilon, keep)   # tramo ABIERTO
    pending = [first, last]
    mientras pending no vacia:
        b = pending.pop()
        a = pending.pop()
        maxDistance = 0
        farthest = -1
        para i desde a+1 hasta b-1:
            d = distanceToSegment(points[i], points[a], points[b])
            si d > maxDistance:
                maxDistance = d
                farthest = i
        si maxDistance > epsilon:
            keep[farthest] = cierto
            pending.push(a, farthest, farthest, b)


funcion simplifyClosed(points, epsilon) -> lista de vertices
    n = points.length
    si n < 3: devolver copia de points

    far = indice del punto mas lejano de points[0]     (comparando d^2)

    extended = points + [ points[0] ]     # el cierre, como indice n
    keep = array de n+1 booleanos a falso
    keep[0] = keep[far] = keep[n] = cierto

    simplifyRange(extended, 0,   far, epsilon, keep)
    simplifyRange(extended, far, n,   epsilon, keep)

    devolver [ points[i] para i en 0..n-1 si keep[i] ]
```

</details>

## 5.9 Esqueleto de `src/cv/polygon.ts`

<details>
<summary>▶ Código — archivo nuevo, para empezar</summary>

```ts
/**
 * FASE 2C/2D: de un contorno de cientos de puntos a un poligono de pocos
 * vertices (Douglas-Peucker), y de ahi a "es un cuadrilatero valido o no".
 */
import type { Point } from "./contour";

/** Distancia de `p` al segmento a-b (al segmento, no a la recta infinita). */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  // TODO 1: dx, dy, length2
  // TODO 2: si length2 === 0, distancia a `a` y fuera
  // TODO 3: t = proyeccion, recortada a [0,1]
  // TODO 4: punto q sobre el segmento, y hypot
  return 0;
}

function simplifyRange(
  points: Point[],
  first: number,
  last: number,
  epsilon: number,
  keep: boolean[],
): void {
  // TODO: pila de pares, buscar el mas lejano, partir en dos
}

export function simplifyClosed(points: Point[], epsilon: number): Point[] {
  // TODO: buscar `far`, extender con points[0], dos llamadas, recoger keep
  return points.slice();
}
```

Mientras los `TODO` estén vacíos, `tsc --noEmit` se va a quejar de funciones y
parámetros sin usar (`noUnusedLocals`, `noUnusedParameters`). Es normal y
desaparece al rellenar los cuerpos; el servidor de Vite no se para por eso,
porque esbuild no comprueba tipos.

Y en `tick`, después de `findContours`:

```ts
for (const contour of contours) {
  const polygon = simplifyClosed(contour.points, 0.03 * contour.points.length);
  // de momento: pintar los vertices en verde y ver cuantos salen
}
```

**✅ Criterio del 2C:** un folio o un marcador deben dar **~4 vértices**; una
mano, muchos; un vaso redondo, bastantes. Si todo te da 2 ó 3 vértices, tu
`epsilon` es demasiado grande. Si todo te da 40, demasiado pequeño.

</details>

---

<a name="apendice-a"></a>

# Apéndice A — Checklist de depuración

| síntoma | causa casi segura |
|---|---|
| La pestaña se congela al encender la cámara | falta `maxSteps`, o el `while` del flood fill no decrementa `stackSize` |
| Una mancha sale con dos o más colores | el `for (d)` cuelga del barrido y no del `while`: no llegas a los vecinos de los vecinos |
| Un color salta de una mancha a otra separada | wrap-around: comprueba `nx`/`ny` **antes** de calcular `n` |
| `regionCount` es enorme (miles) **antes** del filtro | correcto, es el ruido |
| `regionCount` es enorme **después** del filtro | `MIN_AREA` demasiado bajo, o `area` no se incrementa |
| Manchas partidas solo en imágenes grandes | desbordaste `stack`: seguro que estás etiquetando al sacar en vez de al meter |
| `NaN` por todas partes, o `DX[d]` es `undefined` | usaste `(d - 1) % 8`; en JS eso da −1. Usa `(d + 7) % 8` |
| El contorno sale antihorario | tienes `DY` invertido: en pantalla Sur es **+1** |
| El primer punto del contorno está duplicado | haces `push` antes de comprobar la vuelta al inicio |
| Error "Direccion invalida (…)" | el punto de apoyo se calculó desde la posición **nueva** en vez de la vieja |
| `tick` se dispara a 30-50 ms | estás trazando bordes de las manchas de ruido: el `continue` del área tiene que ir **antes** |

<a name="apendice-b"></a>

# Apéndice B — Fórmulas de una línea

```
p = y * width + x                     coordenadas → índice
x = p % width                         índice → x
y = (p - x) / width                   índice → y (división exacta)

nx = px + DX[d]                       vecino en la dirección d
if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
n = ny * width + nx                   ← SIEMPRE después de la comprobación

stack[stackSize++] = n                push
p = stack[--stackSize]                pop

(d + 1) % 8                           girar un paso horario
(d + 7) % 8                           girar un paso antihorario (= d−1 seguro)

maxSteps = 2 * area + 8               tope del recorrido de borde
epsilon  = 0.03 * points.length       tolerancia de Douglas-Peucker
t = ((P−A)·(B−A)) / |B−A|²            proyección, recortada a [0,1]
```

<a name="apendice-c"></a>

# Apéndice C — Glosario

**Región conexa.** Grupo maximal de píxeles de tinta que se tocan entre sí.
"Maximal" = no se le puede añadir ninguno más.

**Conectividad-4 / -8.** Definición de "tocarse": solo por los lados, o también
por las esquinas. Usamos 8 para que los bordes en diagonal no se rompan.

**Flood fill.** Rellenar/etiquetar toda una región partiendo de un píxel,
propagándose por los vecinos. El de "el bote de pintura" del Paint.

**Etiqueta (label).** Número entero ≥ 1 que identifica una región. 0 = fondo.

**Barrido (raster scan).** Recorrido fila a fila, izquierda a derecha. Su
propiedad útil: el primer píxel que encuentra de una región es el superior
izquierdo, y su vecino Oeste es fondo garantizado.

**Pila (stack) / LIFO.** Estructura donde lo último que metes es lo primero que
sacas. Aquí guarda "píxeles pendientes de expandir".

**DFS / BFS.** Búsqueda en profundidad (pila) / en anchura (cola). Para
etiquetar dan el mismo resultado, distinto orden de visita.

**Contorno.** Lista **ordenada** de los píxeles del borde exterior de una
región. El orden es lo que lo distingue de un simple conjunto.

**Vecindad de Moore.** Los 8 vecinos. Por extensión, el algoritmo de recorrido
de borde que los examina en círculo.

**Punto de apoyo (backtrack).** El último píxel de fondo comprobado. Es la
"mano en la pared" que le dice al recorrido por dónde seguir.

**Douglas–Peucker.** Algoritmo de simplificación de polilíneas: conserva los
puntos que se alejan de la cuerda más que `epsilon`.

**Epsilon.** Tolerancia en píxeles. Cuanto mayor, menos vértices.

**Hiperparámetro.** Número que no sale de ninguna cuenta: lo eliges mirando el
resultado (`MIN_AREA`, `epsilon`, `WINDOW_RADIUS`, `margin`).
