# Guía offline — Fase 2C: de 800 puntos de borde a 4 esquinas

> Material de estudio autocontenido. Está escrito para leerse a trozos, con
> semanas de por medio, sin nadie a quien preguntar. Por eso:
>
> - **Cada concepto se introduce donde se usa**, diciendo de dónde sale, por
>   qué hace falta y cómo encaja con lo que ya tienes. Nada se da por sabido,
>   tampoco de las fases anteriores: lo que necesites de ellas se repite aquí
>   en dos líneas.
> - **Cada idea se prueba con números pequeños** (cuadrados de 4×4, listas de
>   8 puntos) antes de generalizarla. Si un número te sale distinto al mío,
>   párate ahí: o me he equivocado yo o hay algo que no has entendido, y las
>   dos cosas merecen la pena.
> - **El camino es el de verdad, con los callejones sin salida.** Primero la
>   idea que se le ocurre a cualquiera, después por qué falla con esos
>   números, después el parche, después por qué el parche tampoco basta, y
>   solo entonces la solución. Si te saltas los fallos, la solución parece
>   arbitraria. No lo es.
>
> El pseudocódigo y el código real están en bloques plegables (`▶`).
> **Intenta escribirlo tú antes de abrirlos.** El bloque plegado es para
> comprobar, no para copiar.
>
> Si en algún punto pierdes el hilo, vuelve al **mapa** de la Parte 1: §1.1
> dice en una frase qué se busca y §1.5 tiene el algoritmo entero en una
> página, en pasos numerados.

---

## Índice

- [Parte 0 — De dónde partes: lo que hay en memoria](#parte-0)
- [Parte 1 — A dónde hay que llegar, y por qué exactamente ahí](#parte-1)
  (1.5: **el plan entero en una página** — el mapa)
- [Parte 2 — Vectores desde cero (la herramienta de toda la fase)](#parte-2)
- [Parte 3 — Idea raw: "una esquina es donde el borde gira"](#parte-3)
- [Parte 4 — El parche: mirar más lejos con `k`, y por qué tampoco](#parte-4)
- [Parte 5 — El cambio de pregunta: tramos y tolerancia `ε`](#parte-5)
  (5.3: de dónde sale la idea de medir distancias)
- [Parte 6 — Medir la distancia de un punto a una recta](#parte-6)
  (6.5: de dónde sale `ux·vy − uy·vx`, deducida)
- [Parte 7 — Recta infinita vs segmento: la proyección](#parte-7)
- [Parte 8 — Primer intento de simplificar: el barrido hacia delante](#parte-8)
- [Parte 9 — Douglas–Peucker](#parte-9)
- [Parte 10 — De recursivo a iterativo: la pila de tramos](#parte-10)
- [Parte 11 — El contorno es cerrado](#parte-11)
- [Parte 12 — `ε` proporcional al tamaño](#parte-12)
- [Parte 13 — Pseudocódigo, código e integración](#parte-13)
- [Apéndice A — Checklist de depuración (síntoma → causa)](#apendice-a)
- [Apéndice B — Fórmulas de una línea](#apendice-b)
- [Apéndice C — Glosario](#apendice-c)

---

<a name="parte-0"></a>

# Parte 0 — De dónde partes: lo que hay en memoria

## 0.1 Lo que devuelve `findContours`

Al final de la Fase 2B, `findContours` (en `src/cv/contour.ts`) devuelve
esto:

```ts
contours = [
  { area: 4213, points: [ {x:102,y:55}, {x:103,y:55}, {x:104,y:56}, ... ] },
  { area: 890,  points: [ ... ] },
  ...
]
```

Una lista de **manchas** (regiones de píxeles de tinta que se tocan). De cada
mancha tienes dos cosas:

- `area`: cuántos píxeles ocupa la mancha entera.
- `points`: la lista de píxeles **de su borde**, en un orden concreto.

Lo único que importa en esta fase es `points`. Estas son sus propiedades, que
vienen de cómo se construyó en la 2B (el recorrido de Moore). Las repito aquí
porque las voy a usar todas:

1. **Un punto por píxel del borde.** Una mancha de 200×200 píxeles tiene un
   borde de unos 800 píxeles → `points.length ≈ 800`.
2. **Están ordenados**: cada punto es vecino (uno de los 8 vecinos) del
   anterior y del siguiente. Es un *paseo* por el borde, no un saco de puntos.
3. **El paseo va en sentido horario** (tal como se ve en pantalla).
4. **Es un ciclo**: el último punto es vecino del primero. La lista no tiene
   principio ni fin "de verdad"; el índice 0 es simplemente por dónde empezó
   el recorrido.
5. **El índice 0 es el píxel más alto de la mancha**, y de los más altos, el
   que está más a la izquierda. Esto viene de que el barrido de la 2B va fila
   a fila, de izquierda a derecha, y arranca el recorrido en el primer píxel
   que encuentra de cada mancha.

Cada punto es un objeto `Point`:

```ts
interface Point {
  x: number;   // columna, crece hacia la DERECHA
  y: number;   // fila,    crece hacia ABAJO   (coordenadas de pantalla)
}
```

> **Detalle práctico:** en tu `contour.ts` la interfaz `Point` está declarada
> pero **no exportada**. El módulo nuevo de esta fase la importa, así que
> tendrás que ponerle `export` delante. `tsc` te lo dirá si se te olvida.

## 0.2 El ejemplo que se repite en toda la guía

Un cuadrado de 4×4 píxeles, en una imagen donde `(0,0)` es la esquina superior
izquierda. Su borde son 12 puntos, y son estos, con su índice en la lista:

```
índice:  0     1     2     3     4     5     6     7     8     9    10    11
punto: (0,0) (1,0) (2,0) (3,0) (3,1) (3,2) (3,3) (2,3) (1,3) (0,3) (0,2) (0,1)

      x→  0  1  2  3
  y  0 | ██ ██ ██ ██          índice 0 = (0,0), arriba-izquierda
  ↓  1 | ██       ██          va en horario: derecha, abajo, izquierda, arriba
     2 | ██       ██
     3 | ██ ██ ██ ██
```

Comprueba las cinco propiedades de arriba sobre esta lista. Sobre todo la 4:
el índice 11, `(0,1)`, es vecino del índice 0, `(0,0)`.

Este cuadrado tiene **4 esquinas**: los índices 0, 3, 6 y 9. Los otros 8
puntos están en mitad de un lado. Todo lo que sigue es cómo encontrar esos
cuatro índices sin saber de antemano cuáles son.

---

<a name="parte-1"></a>

# Parte 1 — A dónde hay que llegar, y por qué exactamente ahí

## 1.1 El mapa

> **De cada contorno (una tira de cientos de puntos) hay que sacar los pocos
> puntos que son esquinas de verdad, en orden. Si salen exactamente 4, es un
> cuadrilátero. Si no, se descarta.**

Eso es la Fase 2C entera. Si en algún momento te pierdes en la guía, vuelve a
esta frase.

## 1.2 Por qué 4, y por qué en orden

La Fase 3 calcula la **homografía**: la operación que traduce "un punto del
marcador ideal, tal como está impreso" a "dónde cae ese punto en la pantalla".
No hace falta saber todavía cómo funciona, solo esto: esa operación tiene **8
números desconocidos**, y cada esquina que conoces (dónde está en el marcador
ideal y dónde está en pantalla) da **2 ecuaciones**. `8 / 2 = 4`. Con 3
esquinas no se puede resolver; con 800 puntos de borde no hay nada que
resolver, porque no sabes a qué punto del marcador ideal corresponde cada uno.

Y las 4 tienen que venir **en orden** (por ejemplo, horario empezando por
arriba-izquierda), porque hay que emparejar "esquina 0 en pantalla" con
"esquina 0 del marcador". Si las emparejas mal, el dibujo sale girado 90°.

## 1.3 Por qué "o descártalo" es la mitad del trabajo

El filtro por área de la 2B deja pasar unas decenas de contornos por frame:
el marcador, sí, pero también letras grandes, sombras, el marco de la ventana,
tu mano. La mayoría no son cuadriláteros. Necesitas un método que diga **no**
a la mano y **sí** al folio, y que lo diga por sí mismo, sin que tú tengas que
ajustar nada frame a frame.

## 1.4 Ojo: un cuadrado en pantalla no tiene ángulos rectos

Antes de empezar, quítate una idea de encima, porque si no te va a estorbar
en todo lo que sigue: **"cuadrilátero" no quiere decir "cuatro ángulos de
90°"**. Un marcador cuadrado inclinado sobre la mesa se ve así:

```
       A(4,0)━━━━B(8,0)        lado lejano, corto
        ╱              ╲
    D(0,6)━━━━━━━━━━━━C(12,6)  lado cercano, largo
```

Los cuatro ángulos, medidos en pantalla: **A = 124°, B = 124°, C = 56°,
D = 56°**. Es un cuadrado perfecto en el mundo real y no tiene un solo ángulo
recto en la imagen. La perspectiva no conserva los ángulos (ni las
longitudes: arriba mide 4 px y abajo 12). Lo único que conserva es que **una
recta se sigue viendo recta**, y que cuatro lados siguen siendo cuatro lados.

Por eso el criterio de esta fase es contar: **4 vértices**. No medir ángulos.

## 1.5 El plan entero, en una página

Esto es lo que vas a construir. Guárdalo como mapa; el resto de la guía
explica de dónde sale cada paso y por qué no se hace de otra manera.

```
1. Tengo el borde de una mancha: ~800 puntos en orden, dando la vuelta.

2. Elijo dos puntos que seguro son esquinas, sin calcular nada raro:
   - el punto 0 (el más alto y a la izquierda: el barrido me lo dio así)
   - el más lejano a él
   Eso parte el anillo en dos tiras abiertas, cada una con principio y fin.
   (Parte 11)

3. Cojo una tira. Trazo la CUERDA entre sus dos extremos. (Parte 5)

4. Mido la distancia a esa cuerda de TODOS los puntos de en medio.
   Me quedo con el mayor. (Partes 6 y 7)

5.a  Si el mayor <= epsilon
     -> ningún punto se aparta lo suficiente: todos los de en medio
        sobran, los borro. Este trozo es un lado recto. Terminado.

5.b  Si el mayor > epsilon
     -> ese punto ES un vértice: lo guardo.
        Ahora tengo dos tiras nuevas (de un extremo al vértice, y del
        vértice al otro extremo). Vuelvo al paso 3 con cada una.
     (Partes 9 y 10)

6. Cuando no quedan tiras por mirar, los puntos guardados son el polígono,
   y ya salen en orden.

7. AHORA decido: ¿cuántos vértices tiene?
   - 4  -> candidato a cuadrilátero, sigue al Paso 2D y a la Fase 3
   - otro número -> no me sirve, descarto esta mancha
```

Dos cosas que conviene tener claras desde el principio, porque es fácil
entenderlas al revés:

- **Que un punto se pase de `epsilon` es una buena noticia, no un descarte.**
  Significa "he encontrado una esquina". Un cuadrilátero *necesita* que
  cuatro puntos se pasen; si no se pasara ninguno, el contorno se resumiría
  en una línea y no habría polígono.
- **La mancha no se descarta nunca en medio del proceso**, solo en el paso 7,
  contando vértices.

Y fíjate en lo que **no** aparece en ningún paso: ángulos, grados, y ninguna
decisión de "cuántos puntos miro alrededor". Nada de eso hace falta, y las
Partes 3 y 4 explican por qué no puede hacerse así.

---

<a name="parte-2"></a>

# Parte 2 — Vectores desde cero (la herramienta de toda la fase)

Todo lo que viene después se hace con vectores. Si los viste en la
universidad, esto es un repaso; si no te acuerdas, esto es todo lo que hace
falta. Son tres ideas.

## 2.1 Un vector es una flecha, y sale de restar dos puntos

Un **punto** es una posición: `(3,1)` es "columna 3, fila 1".

Un **vector** es un desplazamiento: `(2,1)` es "avanza 2 a la derecha y baja
1". No está en ningún sitio; es un movimiento.

Se escriben igual, dos números, y eso confunde. La forma de no liarse: un
vector siempre sale de **restar dos puntos**, destino menos origen:

```
de A = (2,1)  a  B = (4,2):    B − A = (4−2, 2−1) = (2, 1)
```

"Para ir de A a B, avanza 2 y baja 1". Escribiré los vectores con letras
minúsculas (`u`, `v`) y los puntos con mayúsculas (`A`, `B`, `P`).

Los 8 vecinos de la 2B (`DX`, `DY`) son exactamente esto: 8 vectores de un
paso. `(1,0)` es "un paso al Este", `(1,1)` "un paso al Sureste".

## 2.2 Longitud de un vector: Pitágoras

Una flecha `(dx, dy)` es la hipotenusa de un triángulo cuyos catetos son `dx`
y `dy`. Su longitud:

```
|(dx, dy)| = √(dx² + dy²)
```

```
|(3, 4)| = √(9 + 16) = √25 = 5
|(4, 4)| = √(16 + 16) = √32 = 5.657
|(2, 2)| = √8  = 2.828
|(3, 1)| = √10 = 3.162
|(1, 0)| = 1
```

En JavaScript es `Math.hypot(dx, dy)`, que calcula exactamente `√(dx² + dy²)`.
Cada vez que veas `hypot` en esta guía, es "la longitud de una flecha".

Se escribe `|u|` (barras verticales) para "longitud de `u`". Y a `|u|²` se
le llama a veces `length2` en el código: es `dx² + dy²` **sin la raíz**, que
sale más barato y a veces es lo que hace falta.

## 2.3 Dirección de un vector: el ángulo

Una flecha apunta hacia algún lado. Se mide como un ángulo respecto a la
horizontal, y la forma de calcularlo es por la **pendiente**: cuánto baja por
cada unidad que avanza, `dy / dx`.

```
(1, 0)  →  baja 0 por cada 1 que avanza    →  pendiente 0     →   0°
(1, 1)  →  baja 1 por cada 1               →  pendiente 1     →  45°
(0, 1)  →  no avanza, solo baja                                →  90°
(3, 1)  →  baja 1/3 = 0.333 por unidad     →  pendiente 0.333 →  18.4°
(3, 2)  →  baja 2/3 = 0.667 por unidad     →  pendiente 0.667 →  33.7°
```

El paso de pendiente a grados es la función arcotangente: `atan(0.333) =
18.4°`. En JavaScript se usa `Math.atan2(dy, dx)` (fíjate: **primero `dy`**),
que es `atan(dy/dx)` pero sin romperse cuando `dx = 0` y sabiendo en qué
cuadrante está la flecha. Devuelve radianes; para grados, `× 180 / Math.PI`.

Anclaje de sentido común: una pendiente de `1/3` está bastante menos inclinada
que la diagonal, así que tiene que dar bastante menos de 45°. Da 18°. Cuadra.

> Como en pantalla `y` crece hacia **abajo**, un ángulo positivo aquí es "hacia
> abajo". Para lo que vamos a hacer da igual, porque solo compararemos ángulos
> entre sí.

Solo se usan ángulos en las Partes 3 y 4, para ver por qué **no** sirven.
Después no vuelven a aparecer.

---

<a name="parte-3"></a>

# Parte 3 — Idea raw: "una esquina es donde el borde gira"

## 3.1 La idea

Es la que se le ocurre a cualquiera, y es razonable: tienes los puntos en
orden, así que en cada punto mira con qué flecha **llegas** y con qué flecha
**te vas**. Si las dos flechas son iguales, vas en línea recta. Si son
distintas, ahí has girado: es una esquina.

Con nombres:

- **entrada** = flecha desde el punto anterior hasta este: `P[i] − P[i−1]`.
- **salida** = flecha desde este hasta el siguiente: `P[i+1] − P[i]`.
- **giro** = diferencia entre el ángulo de salida y el de entrada.

## 3.2 Ejecutándola donde debería funcionar

En el cuadrado de 4×4, índice 3 = `(3,0)`, que es una esquina de verdad:

```
entrada = P[3] − P[2] = (3,0) − (2,0) = (1, 0)   →  0°
salida  = P[4] − P[3] = (3,1) − (3,0) = (0, 1)   → 90°
giro = 90°                                       → esquina ✔
```

Y en el índice 4 = `(3,1)`, en mitad de un lado:

```
entrada = P[4] − P[3] = (3,1) − (3,0) = (0, 1)   → 90°
salida  = P[5] − P[4] = (3,2) − (3,1) = (0, 1)   → 90°
giro = 0°                                        → lado recto ✔
```

Funciona. Pero este cuadrado está perfectamente alineado con la rejilla de
píxeles, y eso en una cámara no pasa nunca.

## 3.3 Ejecutándola donde falla

Un lado **recto** de un marcador que en pantalla cae con una pendiente suave,
bajando 1 píxel cada 2. Los píxeles que devuelve `traceBorder` para ese lado:

```
índice:   0      1      2      3      4      5      6      7
punto:  (0,0)  (1,0)  (2,1)  (3,1)  (4,2)  (5,2)  (6,3)  (7,3)

  0 | ██ ██
  1 |       ██ ██
  2 |             ██ ██
  3 |                   ██ ██
    +------------------------
      0  1  2  3  4  5  6  7
```

Flechas entre consecutivos:

```
P[1]−P[0] = (1, 0)  = E
P[2]−P[1] = (1, 1)  = SE      ← giro de 45° en el índice 1
P[3]−P[2] = (1, 0)  = E       ← giro de 45° en el índice 2
P[4]−P[3] = (1, 1)  = SE      ← giro de 45° en el índice 3
P[5]−P[4] = (1, 0)  = E       ← giro de 45° en el índice 4
P[6]−P[5] = (1, 1)  = SE      ← giro de 45° en el índice 5
P[7]−P[6] = (1, 0)  = E       ← giro de 45° en el índice 6
```

**Un lado perfectamente recto, y el detector encuentra 6 esquinas en 8
píxeles.** En un marcador real, unas 200 por lado.

## 3.4 Por qué falla (la razón de fondo, no el síntoma)

Entre dos píxeles vecinos solo hay **8 direcciones posibles**. La resolución
angular de tu medida es de **45°**, y no puede ser mejor: es lo que hay en una
rejilla. Un lado inclinado 27° no se puede dibujar a 27°; se dibuja como
escalones de 0° y 45° alternados, y cada escalón es un "giro".

Ahora compara lo que quieres distinguir:

| qué es | giro medido con vecinos inmediatos |
|---|---|
| escalón de un lado recto (ruido de la rejilla) | 45° |
| un píxel de más que dejó el umbral de la Fase 1: `(2,0) (3,1) (4,0)` | 90° (SE y luego NE) |
| esquina real del cuadrado alineado | 90° |
| esquina real de un cuadrado girado o en perspectiva | 45°, 90° o 135° |

**El ruido tiene el mismo tamaño que la señal.** No existe un umbral que los
separe: cualquier valor que deje pasar las esquinas deja pasar los escalones.

Diagnóstico: mirando **un vecindario de 1 píxel**, la información necesaria
para decidir **no está ahí**. No es que el algoritmo esté mal escrito; es que
la pregunta no se puede responder con esos datos.

---

<a name="parte-4"></a>

# Parte 4 — El parche: mirar más lejos con `k`, y por qué tampoco

## 4.1 La idea

Si el problema es que un píxel de vecindario es poco, mira más lejos: compara
el punto `i` con el `i−k` y el `i+k`, para un `k` de varios píxeles. Los
escalones de 1 píxel se diluyen en flechas largas, y solo sobreviven los giros
grandes.

```
entrada = P[i] − P[i−k]
salida  = P[i+k] − P[i]
```

Con `k = 1` es exactamente la Parte 3. Lo único que hace `k` es decir cuánto
atrás y cuánto adelante se mira.

## 4.2 Ejecutándola: mismo lado inclinado, `k = 3`

Miro el índice 3 = `(3,1)`. Tres atrás es el índice 0 = `(0,0)`; tres
adelante, el índice 6 = `(6,3)`.

```
entrada = P[3] − P[0] = (3,1) − (0,0) = (3, 1)   → pendiente 1/3 → 18.4°
salida  = P[6] − P[3] = (6,3) − (3,1) = (3, 2)   → pendiente 2/3 → 33.7°
giro = 33.7° − 18.4° = 15.3°
```

Mismo punto, misma lista, solo cambia `k`:

| | entrada | salida | giro | con umbral de 40° |
|---|---|---|---|---|
| `k = 1` | `(1,0)` → 0° | `(1,1)` → 45° | **45°** | "esquina" ✘ falso |
| `k = 3` | `(3,1)` → 18.4° | `(3,2)` → 33.7° | **15.3°** | "lado recto" ✔ |

Funciona: el escalón de 1 píxel, repartido en 3 de avance, ya no domina la
flecha. El "umbral de 40°" es un número que he elegido a ojo. Apúntalo, porque
es el tipo de número que después da problemas.

## 4.3 `k` tiene que caber entre dos límites

De lo que acabas de ver, `k` está atrapado:

- **Por abajo:** si `k` es pequeño, la flecha la domina el escalón → giros de
  45° en lados rectos. **`k` tiene que ser mayor que un escalón** (2-3 px).
- **Por arriba:** la flecha de entrada tiene que quedarse *dentro del lado
  anterior*. Si `k` es tan grande que salta por encima de la esquina anterior,
  la flecha ya no mide ese lado, mide una mezcla de dos. **`k` tiene que ser
  menor que la longitud del lado.**

O sea: `escalón < k < lado`. Vamos a ver qué pasa cuando no se cumple.

## 4.4 Ejecutándola donde falla: el cuadrado de 12 puntos con `k = 5`

El marcador visto de lejos es el cuadrado de 4×4 de la Parte 0: 12 puntos,
lados de 4. Aplico `k = 5`. La lista es circular, así que `3 − 5 = −2` da la
vuelta y cae en el índice 10.

**En la esquina de verdad, índice 3 = `(3,0)`:**

```
entrada = P[3] − P[10] = (3,0) − (0,2) = ( 3, −2)   → −33.7°
salida  = P[8] − P[3]  = (1,3) − (3,0) = (−2,  3)   → 123.7°
giro = 123.7 − (−33.7) = 157.4°                     → "esquina" ✔
```

(`123.7°`: la flecha `(−2,3)` apunta a la izquierda y abajo; `atan2(3, −2)`
lo sabe y devuelve un ángulo del segundo cuadrante, `180 − 56.3`.)

**En el índice 4 = `(3,1)`, en mitad de un lado recto:**

```
entrada = P[4] − P[11] = (3,1) − (0,1) = ( 3, 0)   →   0°
salida  = P[9] − P[4]  = (0,3) − (3,1) = (−3, 2)   → 146.3°
giro = 146.3°                                       → "esquina" ✘ FALSO
```

157° contra 146°. **Un punto en mitad de un lado da casi lo mismo que la
esquina.** Y no es mala suerte: con `k = 5` en un contorno de 12, *todas* las
flechas atraviesan una esquina, así que todos los puntos dan giros enormes.
Con `k` demasiado grande, todo es esquina. Con `k = 1`, todo es esquina. Para
este contorno el rango válido es `2 < k < 4`, y ahí no cabe casi nada.

Compara con el mismo marcador de cerca, lado de 200 píxeles: el rango es
`2 < k < 200`. Enorme. `k = 10` va perfecto.

**El rango válido de `k` se encoge conforme el marcador se aleja, hasta
vaciarse.** Y la distancia cambia en cada frame: lo que calibras sentado a
30 cm se rompe al levantarte de la silla.

## 4.5 El golpe definitivo: la perspectiva

Podrías pensar en calcular `k` por contorno, proporcional a sus puntos. Pero
mira un marcador inclinado sobre la mesa:

```
        ┌──────────────┐        lado de arriba (lejos):   30 px
       /                \
      /                  \      laterales:                120 px
     /                    \
    └──────────────────────┘     lado de abajo (cerca):   210 px
```

Los cuatro lados son iguales en el mundo real y **miden distinto en
pantalla**. Un `k = 40` es demasiado grande para el lado de arriba (se salta
sus dos esquinas: el caso de 4.4) y está bien para el de abajo.

**Ni siquiera existe un `k` bueno dentro de un mismo contorno.** No es un
problema de calibrar mejor: un número fijo no puede describir algo que tiene
varias escalas a la vez. Y la perspectiva es justo lo que vas a manejar en la
Fase 3, o sea que no es un caso raro: es el caso normal.

## 4.6 Lo que hace falta

La conclusión no es "busca mejor `k`". Es:

> El algoritmo tiene que **descubrir la escala él solo**, tramo a tramo, en
> vez de que tú se la digas con un número.

---

<a name="parte-5"></a>

# Parte 5 — El cambio de pregunta: tramos y tolerancia `ε`

## 5.1 La pregunta vieja y la nueva

Las Partes 3 y 4 preguntan lo mismo: **«¿este punto es una esquina?»** Una
pregunta *local*, sobre un punto, que se responde mirando a su alrededor. Y
"alrededor" es la palabra que lo rompe todo: ¿cuánto alrededor?

Cámbiala por una pregunta sobre **tramos**, con un error medible:

> **«¿Puedo sustituir este tramo de borde por UNA SOLA RECTA sin que ningún
> punto del tramo quede a más de `ε` píxeles de ella?»**

`ε` (épsilon) es un número que eliges tú: "cuántos píxeles me permito
equivocarme". Con `ε = 2`, un tramo se puede resumir en una recta si todos sus
puntos quedan a 2 píxeles o menos de esa recta.

## 5.2 Por qué esta pregunta sí funciona

- La respuesta es **sí/no**, con un criterio medible en píxeles, no una
  puntuación con un umbral de grados puesto a ojo.
- Los escalones de la Parte 3 desaparecen solos: un lado recto escalonado se
  aparta de su propia recta **medio píxel**. Con `ε = 2` no hay discusión.
- **Las esquinas ya no se buscan.** Salen como consecuencia: son los puntos
  donde una sola recta no basta y hay que partir el tramo en dos.
- El criterio de descarte viene gratis: si el contorno entero se resume en 4
  rectas → cuadrilátero. Si en 30 → la mano. Si en 60 → la moneda.

Y lo más importante, la comparación con `k`:

| | qué le das tú | si el tamaño cambia |
|---|---|---|
| giro con `k` | una **longitud** (cuántos puntos mirar) | se rompe: la longitud buena depende del tamaño |
| error ≤ `ε` | una **tolerancia** (cuánto puedo equivocarme) | aguanta: un lado recto se desvía medio píxel, mida 30 px o 210 |

El lado de 210 px y el de 30 se comprueban con **la misma** `ε`, sin tocar
nada. Eso es lo que resuelve la perspectiva.

(`ε` tampoco es perfecta: con el marcador muy lejos vuelve a molestar. Eso se
arregla en la Parte 12, y es un ajuste al final, no un agujero en el centro.)

## 5.3 De la frase en español a algo que se pueda calcular

La pregunta de 5.1 está en español. Para convertirla en código hay que tomar
tres decisiones, y ninguna es obvia. De aquí sale todo lo que viene después,
así que vale la pena verlas una a una.

### Decisión A: qué es "equivocarse" — y de dónde sale la distancia

Simplificar un tramo es literalmente **borrar puntos de la lista**. Tres
puntos:

```
P1 = (0,0)    P2 = (2,3)    P3 = (4,0)

  3 |       P2
  2 |      /  \
  1 |     /    \
  0 |  P1        P3
    +---------------
      0  1  2  3  4
```

Borra `P2`. La lista queda `[P1, P3]`, y quien la lea (la Fase 3, o tú
dibujando el polígono) entenderá "de `P1` a `P3` en línea recta".

Compara las dos figuras: la de antes subía hasta `y = 3` y volvía a bajar; la
de después es plana. **La figura se ha movido 3 píxeles.** Y ese 3 es
exactamente la distancia de `P2` a la recta `P1-P3`.

Prueba con otro `P2 = (2, 0.3)`: al borrarlo, la figura se mueve `0.3`
píxeles. En una pantalla no se nota.

> **La distancia de un punto a la cuerda es cuánto se deforma la figura si
> borras ese punto.**

Por eso aparece la distancia, y por eso `ε` se mide en píxeles: `ε = 2`
significa "acepto que la figura se mueva hasta 2 píxeles". No es una medida
elegida por elegancia matemática, es la traducción directa de "cuánto me
permito equivocarme".

### Decisión B: respecto a qué recta

Hay infinitas rectas que podrían representar un tramo. La candidata natural,
si has visto algo de estadística, es la **recta de mejor ajuste** (mínimos
cuadrados): la que pasa lo más cerca posible de **todos** los puntos a la
vez, sin obligarla a pasar por ninguno.

Se usa la **cuerda** —la que une el primer punto con el último— y no esa. Hay
tres razones, y la tercera es la decisiva.

**1. La recta de ajuste no toca los extremos.** Con un lado recto de 5 puntos
y un poco de ruido:

```
(0,0)  (1,0)  (2,1)  (3,0)  (4,0)

  1 |             ██
  0 |  ██  ██         ██  ██
    +---------------------------
       0   1   2   3   4
```

La recta de ajuste de esos 5 puntos sale `y = 0.2`: una horizontal levantada
un poco por culpa de `(2,1)`. **No pasa por `(0,0)` ni por `(4,0)`**, pasa
0.2 por encima de los dos.

**2. Entonces el vértice deja de existir.** Pon dos lados seguidos, el de
arriba y el de la derecha, cada uno con su recta:

```
lado de arriba →  y = 0.2      (no llega a tocar x=4)
lado derecho   →  x = 4.2      (no llega a tocar y=0)
```

El de arriba "termina" en `(4, 0.2)`; el de la derecha "empieza" en
`(4.2, 0)`. Son dos puntos distintos, y la esquina no es ninguno de los dos:
está donde se cortarían las rectas si las prolongaras, `(4.2, 0.2)`, un punto
con decimales que **no existe en tu imagen**.

```
con la cuerda:              con rectas de mejor ajuste:

  A━━━━━━━M━━━━━━━B           A─────·  ·─────B
          ↑                        ↑ ↑
   comparten el vértice         ni se tocan: el vértice hay que fabricarlo
   y es un pixel real           cortando las dos rectas
```

La Fase 3 necesita 4 **puntos**, no 4 rectas. Con la cuerda ya los tienes;
con el ajuste habría que intersecar lados de dos en dos, con sus casos
degenerados (dos lados casi paralelos → la intersección se dispara a las
afueras de la pantalla).

**3. Y la razón decisiva: sería circular.** Para ajustar una recta "al lado
de arriba" tienes que saber qué puntos forman el lado de arriba. O sea, dónde
termina. O sea, **dónde está la esquina, que es justo lo que estás
buscando**.

> Para usar mínimos cuadrados necesitarías saber ya dónde están las esquinas.

La cuerda no tiene ese problema: **se puede trazar sin saber nada**. Coges el
primer punto de la tira y el último, sean los que sean, y ya tienes tu recta.
No hay que decidir nada de antemano, y la esquina aparece sola como el punto
que más se aparta. Eso es lo que rompe la circularidad, y es la idea central
de todo el algoritmo.

(Que las rectas de ajuste no sean buenas para *encontrar* las esquinas no
significa que sean inútiles: ajustar una recta a cada lado **ya conocido** es
una técnica real para afinar las esquinas con precisión de subpíxel. Es un
refinamiento posterior, no un método de búsqueda.)

### Decisión C: cómo se resume el tramo en un número

Tendrás una distancia por cada punto intermedio. Para decidir sobre el tramo
entero hay que combinarlas. Tres candidatos, con datos:

| tramo | qué es | distancias | suma | media | **máximo** |
|---|---|---|---|---|---|
| A | lado recto escalonado, 100 puntos | 100 valores de ~0.5 | **50** | 0.5 | **0.5** |
| B | 200 puntos rectos con **una** esquina afilada | 199 ceros y un 50 | 50 | **0.25** | **50** |

- **La suma** dice que A es tan malo como B. Falso: A es recto. La suma crece
  con la longitud del tramo, o sea que castiga a los tramos largos por ser
  largos — el mismo defecto que tenía `k`.
- **La media** dice que B es casi plano (0.25). Falso: B tiene una esquina de
  50 píxeles, diluida entre 199 puntos buenos.
- **El máximo** da 0.5 y 50. Acierta las dos veces.

La razón de fondo: la pregunta era «¿caben **todos** los puntos dentro de
`ε`?». Para comprobar un "todos" de un tirón basta con mirar al peor: si el
peor cabe, caben todos. El máximo no es una heurística, es la traducción
exacta de la pregunta. Y de propina dice **cuál** es el peor, que resultará
ser justo el sitio por donde hay que partir (Partes 8 y 9).

## 5.4 Lo que hace falta ahora

Con las tres decisiones tomadas, la pregunta ya es calculable:

> **«De los puntos intermedios de este tramo, ¿el más alejado de la cuerda
> está a más de `ε` píxeles?»**

Falta una sola pieza: **medir la distancia de un punto a una recta**. Eso es
la Parte 6.

---

<a name="parte-6"></a>

# Parte 6 — Medir la distancia de un punto a una recta

## 6.1 Lo que hay

Tres puntos. `A` y `B` son los extremos del tramo; la recta que pasa por los
dos se llama **cuerda**. `P` es un punto intermedio del tramo. Quiero saber a
cuántos píxeles queda `P` de la cuerda.

```
A = (0,0)    B = (4,4)    P = (0,4)

  4 | P           B
  3 |          ·
  2 |       ·
  1 |    ·
  0 | A
    +---------------
      0  1  2  3  4
```

"Distancia a la recta" quiere decir **la más corta posible**: la que se mide
en perpendicular. Si desde `P` vas hacia la diagonal por el camino más corto,
chocas con ella en `(2,2)`. Ese camino es la flecha `(2,2) − (0,4) = (2, −2)`,
y su longitud es `hypot(2, −2) = √8 = 2.828`.

**Ese es el número que busco: 2.828.** Lo sé porque en este dibujo veo dónde
está el punto de choque. El algoritmo no lo ve; tiene que llegar al mismo
número solo con las seis coordenadas.

## 6.2 Idea raw: "resto las `y`"

Con una recta horizontal es trivial: `A = (0,0)`, `B = (8,0)`, `P = (3,2)` →
distancia `Py − Ay = 2 − 0 = 2`. Correcto.

Con la diagonal de arriba: `Py − Ay = 4 − 0 = 4`. Pero acabamos de ver que la
respuesta es `2.828`. **Falla en cuanto la recta se inclina.** Y todas las
cuerdas de un contorno están inclinadas.

## 6.3 La idea buena: el área del triángulo

`A`, `B` y `P` forman un triángulo. Y en un triángulo:

```
área = base × altura / 2
```

Si tomo como **base** la cuerda `A→B`, la **altura** es exactamente la
distancia perpendicular de `P` a la recta: justo lo que busco. Le doy la
vuelta:

```
altura = 2 × área / base
```

La base la sé calcular: es `|B − A|`, con `hypot`. Si consigo el área **por
otro camino**, sin usar la altura, tengo la distancia. Esa es toda la jugada.

## 6.4 El área a partir de las coordenadas: el producto cruzado

Coloco `A` como origen y miro las dos flechas que salen de él:

```
u = B − A = (4,4) − (0,0) = (4, 4)      la cuerda
v = P − A = (0,4) − (0,0) = (0, 4)      hasta el punto
```

Dos flechas que salen del mismo sitio definen un **paralelogramo** (el
triángulo `A`,`B`,`P` es exactamente la mitad de él). El área del
paralelogramo tiene una fórmula que solo usa los cuatro números:

```
área del paralelogramo = ux·vy − uy·vx
```

A esta cuenta se la llama **producto cruzado** (en 2D). Si te suena el
"producto vectorial" de la universidad, con determinantes de 3×3, es esto
mismo con una dimensión menos.

De dónde sale esa fórmula lo verás en 6.5, deducida paso a paso. Antes de
deducirla la compruebo con tres casos que puedo verificar a mano, para saber
que persigo algo cierto.

**Rectángulo.** `u = (4,0)`, `v = (0,3)`:

```
4·3 − 0·0 = 12          un rectángulo de 4×3 tiene área 12  ✔
```

**Rectángulo inclinado (paralelogramo).** `u = (4,0)`, `v = (2,3)`:

```
4·3 − 0·2 = 12          base 4, altura 3 → 12  ✔
```

Fíjate: `v` se ha desplazado 2 a la derecha y el área no cambia (un
paralelogramo inclinado tiene la misma área que el rectángulo de su base y su
altura). Y la fórmula lo sabe: ese `2` se multiplica por `uy = 0` y
desaparece.

**Nuestro caso.** `u = (4,4)`, `v = (0,4)`:

```
4·4 − 4·0 = 16
```

Compruebo por el otro lado: base `|u| = 5.657`, altura la que ya sabía,
`2.828` → `5.657 × 2.828 = 16`. ✔

## 6.5 De dónde sale la fórmula

Nada de actos de fe: la fórmula sale de recortar un rectángulo, y se puede
deducir entera. Primero con números y luego con letras, que es donde aparece.

### Las seis piezas

`u = (ux, uy)` y `v = (vx, vy)`, las dos flechas saliendo del origen. El
paralelogramo tiene cuatro vértices:

```
O = (0, 0)                V = (vx, vy)
U = (ux, uy)              W = u + v = (ux+vx, uy+vy)
```

Con `u = (4,1)` y `v = (1,3)`:

```
O = (0,0)    U = (4,1)    W = (5,4)    V = (1,3)
```

El rectángulo más pequeño que lo encierra va de `(0,0)` a `(5,4)`: mide
`(ux+vx) × (uy+vy) = 5 × 4 = 20`. Fíjate en que `O` cae en su esquina
superior izquierda y `W` en la inferior derecha, mientras que `U` y `V`
quedan dentro.

**Dibújalo en papel cuadriculado** (5 de ancho, 4 de alto) y marca los cuatro
vértices. Lo que sobra alrededor del paralelogramo son estas seis piezas:

| pieza | vértices | forma | área con letras | con números |
|---|---|---|---|---|
| T1 | `O`, `(4,0)`, `U` | triángulo | `ux·uy / 2` | 2 |
| R1 | `(4,0)`, `(5,0)`, `(5,1)`, `U` | rectángulo | `vx·uy` | 1 |
| T2 | `U`, `(5,1)`, `W` | triángulo | `vx·vy / 2` | 1.5 |
| T3 | `O`, `(0,3)`, `V` | triángulo | `vx·vy / 2` | 1.5 |
| R2 | `(0,3)`, `V`, `(1,4)`, `(0,4)` | rectángulo | `vx·uy` | 1 |
| T4 | `V`, `(1,4)`, `W` | triángulo | `ux·uy / 2` | 2 |

Las tres de arriba y las tres de abajo son iguales dos a dos: el
paralelogramo es simétrico respecto de su centro, así que todo va de dos en
dos. El sobrante total:

```
2·(ux·uy/2) + 2·(vx·vy/2) + 2·(vx·uy)  =  ux·uy + vx·vy + 2·vx·uy
```

Con números: `4 + 3 + 2 = 9`. Y `20 − 9 = 11`.

### El álgebra

Lo mismo, pero con letras:

```
área = rectángulo − sobrante
     = (ux+vx)·(uy+vy) − ux·uy − vx·vy − 2·vx·uy
```

Desarrollo el producto del rectángulo:

```
(ux+vx)·(uy+vy) = ux·uy + ux·vy + vx·uy + vx·vy
```

Y voy quitando piezas:

```
  ux·uy + ux·vy + vx·uy + vx·vy      ← el rectángulo, desarrollado
− ux·uy                              ← los dos triángulos de u
= ux·vy + vx·uy + vx·vy
− vx·vy                              ← los dos triángulos de v
= ux·vy + vx·uy
− 2·vx·uy                            ← los dos rectángulos
= ux·vy − vx·uy
```

**`área = ux·vy − uy·vx`.** Los cuatro términos del rectángulo se cancelan
contra los recortes menos dos, y lo que sobrevive es la fórmula. No hay
ningún paso mágico: es el mismo recorte de arriba, hecho con letras en vez de
con números.

### Dos comprobaciones de sanidad

**Base horizontal.** `u = (b, 0)`. La fórmula da `b·vy − 0·vx = b·vy`, que es
"base por altura" de toda la vida. El término `−uy·vx` es exactamente la
corrección por tener la base inclinada.

**Vectores paralelos.** Si `v` apunta en la misma dirección que `u` (por
ejemplo `v = 2u`), no hay paralelogramo: es una línea plana, área 0.
`ux·(2uy) − uy·(2ux) = 0`. ✔ Y encaja con la distancia: un punto que está
sobre la recta dista 0 de ella.

## 6.6 Juntándolo: la distancia

```
u = B − A
v = P − A
cruz = ux·vy − uy·vx          ← área del paralelogramo
base = hypot(ux, uy)          ← longitud de la cuerda
distancia = |cruz| / base
```

El `/ 2` del triángulo se cancela: el paralelogramo son dos triángulos con la
misma altura, así que `paralelogramo / base = altura` directamente.

Con nuestro caso: `16 / 5.657 = 2.828`. ✔ Y sin haber necesitado saber que el
punto de choque era `(2,2)`.

## 6.7 El valor absoluto: el signo dice de qué lado está `P`

`cruz` sale **negativo** si `P` queda al otro lado de la recta. Tiene sentido
con la derivación de 6.5: aquel dibujo suponía que `v` caía a un lado
concreto de `u`; si cae al otro, el paralelogramo es el mismo pero las piezas
que se recortan son otras, y el álgebra sale con el signo cambiado.

Pruébalo con `P = (4,0)`, que está debajo de la diagonal:

```
v = (4,0) − (0,0) = (4, 0)
cruz = 4·0 − 4·4 = −16          misma distancia (16/5.657), signo contrario
```

Para la distancia me da igual el lado, así que `Math.abs`. Que el signo diga
*de qué lado* está `P` es una propiedad que se usa en el Paso 2D (convexidad,
orientación). No ahora.

---

<a name="parte-7"></a>

# Parte 7 — Recta infinita vs segmento: la proyección

## 7.1 La trampa

La fórmula de la Parte 6 mide la distancia a la **recta infinita** que pasa
por `A` y `B`. Pero la cuerda es un **segmento**: empieza en `A` y termina en
`B`. Casi siempre da igual. Cuando no, miente.

```
A = (0,0)    B = (4,0)    P = (6,1)

  1 |                    P
  0 | A━━━━━━━━━━━━B
    +----------------------
      0  1  2  3  4  5  6
```

- Distancia de `P` a la **recta infinita** (el eje horizontal): `1`.
- Distancia de `P` al **segmento** `A-B`, que se acaba en `x = 4`: lo más
  cercano de la cuerda que existe es su extremo `B`, y de `P` a `B` hay
  `hypot(6−4, 1−0) = hypot(2,1) = 2.236`.

El segundo es el bueno. `P` está *más allá* del final del segmento; lo que le
queda cerca es el extremo, no una recta imaginaria que sigue hasta el
infinito.

## 7.2 Cuándo pasa esto en un contorno

En un tramo que va "derecho" nunca: todos los intermedios se proyectan entre
`A` y `B`. Pasa cuando el tramo **se dobla hacia atrás**: la mitad de un
contorno cerrado (Parte 11), un dedo de la mano, una muesca. Ejemplo con
números:

```
tramo:  (0,0) (2,0) (4,0) (6,0) (6,1) (4,1)       una tira que va y vuelve
cuerda: A = (0,0)  →  B = (4,1)
punto intermedio: P = (6,0)
```

- A la recta infinita: `u = (4,1)`, `v = (6,0)`, `cruz = 4·0 − 1·6 = −6`,
  `|u| = 4.123` → `1.46`. Con `ε = 1.5` diría "cabe en la recta, tíralo".
- Al segmento: `P` está más allá de `B`; distancia a `B` = `hypot(2, −1)` =
  `2.236`. Con `ε = 1.5` dice "no cabe, es un vértice".

**Un vértice real descartado en silencio.** Por eso el código mide al
segmento, y para eso hay que saber si `P` cae *dentro* o *fuera* de `A-B`.

## 7.3 La sombra de un vector sobre otro: el producto escalar

Necesito responder: «si dejo caer `P` en perpendicular sobre la cuerda, ¿en
qué punto de ella cae?». Eso se llama **proyectar** `P` sobre la cuerda, y el
punto donde cae, `Q`, es el pie de la perpendicular.

La herramienta es la segunda operación entre vectores. Con las flechas de
antes, `u = B − A` y `v = P − A`:

```
producto escalar:  u · v = ux·vx + uy·vy
```

(Producto **escalar** porque el resultado es un número, no una flecha. El
producto **cruzado** de la Parte 6 restaba en cruz; este multiplica
componente a componente y suma.)

Lo que mide: **cuánto de `v` avanza en la dirección de `u`**. Concretamente,
la longitud de la *sombra* de `v` sobre `u` es `(u · v) / |u|`. Compruébalo
con una cuerda horizontal, donde la sombra se ve a simple vista:

```
u = (4,0)   v = (3,2)
u · v = 4·3 + 0·2 = 12
sombra = 12 / |u| = 12 / 4 = 3
```

`v = (3,2)` cae en perpendicular sobre la horizontal en `(3,0)`: a 3 de `A`.
✔ Con `u` horizontal el producto escalar es simplemente `4·vx`, y dividir por
4 devuelve `vx`. Con `u` inclinada la fórmula mezcla las dos componentes en la
proporción correcta. Compruébalo con la diagonal de la Parte 6:

```
u = (4,4)   v = (0,4)
u · v = 4·0 + 4·4 = 16
sombra = 16 / |u| = 16 / 5.657 = 2.828
```

Y la sombra de `P = (0,4)` sobre la diagonal debía llegar hasta `(2,2)`, que
está a `hypot(2,2) = 2.828` de `A`. ✔ Dos caminos, mismo número.

## 7.4 La fracción `t`

La sombra en píxeles no es lo cómodo. Lo cómodo es **qué fracción de la cuerda
recorre**: si divido la sombra por la longitud de la cuerda, obtengo un número
`t` que vale `0` en `A` y `1` en `B`:

```
t = sombra / |u| = (u · v) / |u|²
```

`|u|²` es `ux² + uy²`, el `length2` del código: sin raíz. Por eso en la
fórmula no aparece ningún `hypot`.

```
t = 0     → P se proyecta justo en A
t = 0.5   → en el punto medio de la cuerda
t = 1     → justo en B
t < 0     → ANTES de A: fuera del segmento
t > 1     → DESPUÉS de B: fuera del segmento
```

Y el punto de la cuerda donde cae la proyección es:

```
Q = A + t·u = (Ax + t·ux, Ay + t·uy)
```

Números, con los tres casos que ya conoces:

```
diagonal:  u = (4,4)  v = (0,4)   t = 16/32 = 0.5    Q = (0+2, 0+2) = (2,2) ✔
horizontal: u = (4,0) v = (3,2)   t = 12/16 = 0.75   Q = (3, 0)             ✔
la trampa: u = (4,0)  v = (6,1)   t = 24/16 = 1.5    → se sale por B
```

## 7.5 El recorte

Si `t` se sale de `[0, 1]`, el punto más cercano del **segmento** no es la
proyección: es el extremo por el que se ha salido. Se arregla **recortando**
`t` a ese rango:

```
t = max(0, min(1, t))
```

Con la trampa: `t = 1.5 → 1`, `Q = A + 1·u = (4,0) = B`, distancia `=
hypot(6−4, 1−0) = 2.236`. ✔ Justo lo que queríamos.

Y la distancia final, con `Q` ya calculado, es simplemente la longitud de la
flecha de `Q` a `P`:

```
distancia = hypot(Px − Qx, Py − Qy)
```

Fíjate: por este camino **no hace falta el producto cruzado**. El código usa
solo escalar + recorte + `hypot`. El cruzado de la Parte 6 es para entender
qué se está midiendo (y volverá en el 2D); la proyección es lo que se
programa, porque además resuelve los extremos.

## 7.6 El caso degenerado: `A == B`

Si `A` y `B` son el mismo punto, `|u|² = 0` y `t = 0/0`. En JavaScript eso
es `NaN`, y `NaN` **envenena en silencio**: `NaN > ε` es `false`, `NaN <
ε` es `false`, no salta ningún error, y el tramo entero se descarta sin que
nadie se entere. Peor que un crash.

¿Puede pasar? Sí. El recorrido de Moore de la 2B, en una línea de 1 píxel de
grosor, va y vuelve por los mismos píxeles (§3.6 de la guía 2B), así que en
`points` puede haber dos índices con el mismo `(x, y)`. Hay que cortocircuitar:
si `|u|² == 0`, la distancia es la de `P` a `A`, y punto.

## 7.7 Pseudocódigo de `distanceToSegment`

<details>
<summary>▶ Pseudocódigo</summary>

```
función distanceToSegment(P, A, B) → número
    ux = B.x − A.x
    uy = B.y − A.y
    length2 = ux·ux + uy·uy
    si length2 == 0:                          # A y B son el mismo punto
        devolver hypot(P.x − A.x, P.y − A.y)

    t = ((P.x − A.x)·ux + (P.y − A.y)·uy) / length2     # producto escalar / |u|²
    t = max(0, min(1, t))                                # recorte al segmento

    Qx = A.x + t·ux
    Qy = A.y + t·uy
    devolver hypot(P.x − Qx, P.y − Qy)
```

</details>

Simúlala a mano con `A=(0,0)`, `B=(4,4)`, `P=(0,4)` y comprueba que te sale
`2.828`. Luego con `P=(6,1)` y `B=(4,0)`: `2.236`. Si te salen, entiendes la
función entera.

---

<a name="parte-8"></a>

# Parte 8 — Primer intento de simplificar: el barrido hacia delante

Ya sabes medir «¿a qué distancia está este punto de esta cuerda?». Ahora hay
que usar eso para decidir **dónde partir** el contorno. Y otra vez, primero la
idea que se le ocurre a cualquiera.

## 8.1 La idea

Empiezo en el punto 0 y voy **estirando una recta** hacia delante: pruebo la
cuerda `0→1`, luego `0→2`, luego `0→3`… mientras todos los puntos intermedios
queden a `≤ ε` de la cuerda. En cuanto uno se sale, corto: el punto anterior
es un vértice, y empiezo a estirar desde él.

Es simple, es un solo bucle, y parece que tiene que funcionar.

## 8.2 Ejecutándola: una esquina en L

Un tramo con una esquina de verdad en `(8,0)`:

```
índice:  0     1     2     3     4     5     6     7     8     9    10    11    12    13    14    15    16
punto: (0,0) (1,0) (2,0) (3,0) (4,0) (5,0) (6,0) (7,0) (8,0) (8,1) (8,2) (8,3) (8,4) (8,5) (8,6) (8,7) (8,8)

  0 | ██ ██ ██ ██ ██ ██ ██ ██ ██   ← esquina en el índice 8 = (8,0)
  1 |                         ██
  2 |                         ██
  ⋮ |                         ⋮
  8 |                         ██
```

`ε = 3`. Estiro desde el 0. Mientras la cuerda es `0→j` con `j ≤ 8`, es
horizontal y todos los intermedios están a distancia 0. Sigo estirando:

```
j = 9,  cuerda (0,0)→(8,1),  |u| = hypot(8,1) = 8.06
        el intermedio más alejado es la esquina (8,0):
        cruz = 8·0 − 1·8 = −8   →  8 / 8.06 = 0.99   ≤ 3  → sigo

j = 10, cuerda (0,0)→(8,2),  |u| = 8.25
        (8,0): cruz = 8·0 − 2·8 = −16  →  1.94   ≤ 3  → sigo

j = 11, cuerda (0,0)→(8,3),  |u| = 8.54
        (8,0): cruz = −24  →  2.81   ≤ 3  → sigo

j = 12, cuerda (0,0)→(8,4),  |u| = 8.94
        (8,0): cruz = −32  →  3.58   > 3  → ¡corto!
```

(Para estos puntos `t` queda dentro de `[0,1]`, así que la distancia a la
recta y al segmento coinciden; puedes comprobarlo con la Parte 7.)

Corto en `j = 12`, así que el vértice es el anterior: **índice 11 = `(8,3)`**.
Desde ahí el resto es vertical, distancia 0, llego al final.

```
resultado: (0,0)  (8,3)  (8,8)
esquina real:     (8,0)
```

**El vértice cae 3 píxeles después de la esquina.** Y no es casualidad que
sean 3: es `ε`. La cuerda se sigue estirando mientras la esquina queda a menos
de `ε`, y para cuando se pasa, ya hemos avanzado `ε` píxeles por el otro lado.

## 8.3 Por qué es grave

Con `ε = 3` en un dibujo de 8 píxeles parece poca cosa. Pero en la Parte 12
verás que `ε` tiene que crecer con el tamaño del contorno: en un marcador de
800 puntos, `ε ≈ 24`. **Las esquinas saldrían 24 píxeles desplazadas.** Con
esas esquinas, la homografía de la Fase 3 sale mal y el dibujo en 3D baila.

El defecto de fondo: el barrido decide **mirando solo hacia atrás**, y se
entera de que ha pasado una esquina cuando ya es tarde. Nunca compara
candidatos: acepta el primero que aguanta.

## 8.4 Lo que hace falta

Un método que, en vez de preguntar «¿hasta dónde puedo estirar?», pregunte
**«de todos los puntos del tramo, ¿cuál es el que MÁS se sale?»**. Porque el
que más se sale de la recta que une los extremos es, precisamente, la esquina.

Compruébalo en la L: cuerda de un extremo al otro, `(0,0)→(8,8)`, `|u| =
11.31`, `cruz = 8·y − 8·x`:

```
(7,0):  8·0 − 8·7 = −56  →  4.95
(8,0):  8·0 − 8·8 = −64  →  5.66    ← el máximo, y es la esquina exacta
(8,1):  8·1 − 8·8 = −56  →  4.95
```

El más alejado **es la esquina, sin desplazamiento**. Eso es Douglas–Peucker.

---

<a name="parte-9"></a>

# Parte 9 — Douglas–Peucker

## 9.1 El algoritmo en cuatro pasos

Para un tramo abierto que va del índice `first` al índice `last`:

1. Traza la **cuerda** del primer punto al último.
2. Entre los puntos intermedios, busca el **más alejado** de la cuerda
   (distancia al segmento, Parte 7). Llámalo `M` y a su distancia `dmax`.
3. Si `dmax ≤ ε` → todos los intermedios están "casi en la cuerda": **se
   tiran todos**. El tramo queda resumido en la recta `first→last`.
4. Si `dmax > ε` → `M` es un vértice de verdad: **se conserva**, y se
   repite el proceso en los dos tramos `first..M` y `M..last`.

```
    A ·······················  B        cuerda A-B
         ·   ·        ·
           ·    ·  ·  ← M, el MÁS ALEJADO de la cuerda
```

Los dos extremos, `first` y `last`, se conservan siempre: son los extremos
del tramo, no hay nadie que los sustituya. (Esto va a importar en la Parte
11.)

Fíjate en cómo resuelve los problemas anteriores:

- No pregunta por un punto, pregunta por un **tramo** (Parte 5).
- El vértice es el **máximo** del tramo entero, no el primero que aguanta
  (Parte 8): cae en la esquina exacta.
- No hay ningún `k`: la escala de cada tramo la fija el propio tramo. Un
  lado de 210 px y uno de 30 px se comprueban igual (Parte 4).

## 9.1b Solo el máximo, no todos los que se pasan

El error clásico al implementarlo: creer que el paso 2 es "guardo **todos**
los puntos que se pasen de `ε`". No lo es. Se guarda **uno solo**, el
máximo, y los demás se vuelven a mirar después contra las cuerdas nuevas.
Con números se ve por qué no da igual:

```
A = (0,0)   B = (10,0)   ε = 1.5
intermedios:  P1 = (2,2)   P2 = (5,4)   P3 = (8,2)

  4 |               P2
  3 |             /    \
  2 |     P1               P3
  1 |    /                    \
  0 | A                          B
    +--------------------------------
      0  1  2  3  4  5  6  7  8  9 10
```

La cuerda es horizontal, así que las distancias son las `y`: **2, 4 y 2**.
Los tres se pasan de 1.5.

- **Guardando los tres:** 3 vértices, y no se vuelve a mirar nada.
- **Douglas–Peucker:** se guarda solo `P2` (el máximo) y se repite en los dos
  trozos nuevos:
  - Tramo `A→P2`: cuerda de `(0,0)` a `(5,4)`. Para `P1`: `u = (5,4)`,
    `v = (2,2)`, `cruz = 5·2 − 4·2 = 2`, `|u| = 6.4` → **0.31 ≤ 1.5**, se
    tira.
  - Tramo `P2→B`: por simetría, `P3` da **0.31**, se tira.
  - Resultado: **1 vértice**, no 3.

`P1` y `P3` parecían esquinas solo porque la cuerda larga no tenía en cuenta
el pico que había en medio. En cuanto se parte por el pico, se ve que están
en la ladera, y la ladera es recta.

Consecuencia para el código: **el bucle que recorre los puntos no guarda
nada**. Solo busca el máximo. El `keep[farthest] = true` va fuera del bucle,
después de haberlo recorrido entero.

## 9.2 Simulación completa

Polilínea **abierta** de 9 puntos, `ε = 1.5`:

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

Un bultito pequeño en `(1,1)` (ruido) y un pico grande en `(4,3)` (vértice
real). Se conservan siempre los extremos: `keep = {0, 8}`.

Para cada cuerda uso `cruz = ux·(Py − Ay) − uy·(Px − Ax)` y `distancia =
|cruz| / |u|`. En estos tramos ningún punto se proyecta fuera del segmento,
así que coincide con `distanceToSegment`; si quieres, comprueba alguno con la
`t` de la Parte 7.

---

**TRAMO (0, 8)** — cuerda `(0,0)→(8,0)`, horizontal: la distancia es `|y|`.

| i | punto | distancia |
|---|---|---|
| 1 | (1,1) | 1 |
| 2 | (2,0) | 0 |
| 3 | (3,0) | 0 |
| 4 | (4,3) | **3** ← máximo |
| 5 | (5,0) | 0 |
| 6 | (6,0) | 0 |
| 7 | (7,0) | 0 |

`dmax = 3 > 1.5` → **se conserva el índice 4**. Quedan pendientes los tramos
`(0,4)` y `(4,8)`.

---

**TRAMO (0, 4)** — cuerda `A=(0,0)→B=(4,3)`. `u = (4,3)`, `|u| = 5`,
`cruz = 4·y − 3·x`.

| i | punto | cruz | distancia = \|cruz\|/5 |
|---|---|---|---|
| 1 | (1,1) | 4−3 = 1 | 0.2 |
| 2 | (2,0) | 0−6 = −6 | 1.2 |
| 3 | (3,0) | 0−9 = −9 | **1.8** ← máximo |

`dmax = 1.8 > 1.5` → **se conserva el índice 3**. Pendientes `(0,3)` y
`(3,4)`.

---

**TRAMO (0, 3)** — cuerda `(0,0)→(3,0)`, horizontal.

| i | punto | distancia |
|---|---|---|
| 1 | (1,1) | 1 |
| 2 | (2,0) | 0 |

`dmax = 1 ≤ 1.5` → **no se conserva nada**. Los índices 1 y 2 desaparecen:
el bultito de ruido se ha ido.

---

**TRAMO (3, 4)** — índices consecutivos, no hay intermedios. Nada que hacer.

---

**TRAMO (4, 8)** — cuerda `A=(4,3)→B=(8,0)`. `u = (4,−3)`, `|u| = 5`,
`cruz = 4·(y−3) − (−3)·(x−4) = 3x + 4y − 24`.

| i | punto | cruz | distancia |
|---|---|---|---|
| 5 | (5,0) | 15−24 = −9 | **1.8** ← máximo |
| 6 | (6,0) | 18−24 = −6 | 1.2 |
| 7 | (7,0) | 21−24 = −3 | 0.6 |

`dmax = 1.8 > 1.5` → **se conserva el índice 5**. Pendientes `(4,5)` y
`(5,8)`.

---

**TRAMO (4, 5)** — consecutivos, nada.

**TRAMO (5, 8)** — cuerda `(5,0)→(8,0)`, horizontal. `(6,0)` y `(7,0)` a
distancia 0. `dmax = 0 ≤ 1.5` → se tiran los dos.

---

### Resultado

```
keep = {0, 3, 4, 5, 8}

9 puntos  →  5 vértices:  (0,0) (3,0) (4,3) (5,0) (8,0)
```

El pico se ha conservado entero (su cima y los dos puntos donde arranca, que
son lo que le da forma) y el bultito de `(1,1)` ha desaparecido. Vuelve a
hacer la simulación con `ε = 2`: el resultado pasa a ser `(0,0) (4,3) (8,0)`,
3 vértices. **`ε` es el mando que controla cuánto simplificas.**

## 9.3 Qué acabas de ver

- El algoritmo se llama a sí mismo sobre tramos cada vez más pequeños, hasta
  que o no quedan intermedios o todos caben en la cuerda.
- Los vértices salen **en orden**: son índices de la lista original, y basta
  con recorrer `keep` de 0 a n para tenerlos ordenados. No hay que ordenar
  nada.
- El coste: cada nivel recorre el tramo entero. Para un cuadrilátero limpio
  son 4-6 niveles sobre 800 puntos: unas 4.000 distancias por contorno. Bien.

---

<a name="parte-10"></a>

# Parte 10 — De recursivo a iterativo: la pila de tramos

## 10.1 Qué es recursión y por qué no la vamos a usar

El algoritmo se describe solo como **recursión**: una función que, para
resolver el tramo `(0,8)`, se llama a sí misma con `(0,4)` y `(4,8)`, y cada
una de esas se vuelve a llamar con sus mitades, etc.

```
simplify(0, 8)
  ├─ simplify(0, 4)
  │    ├─ simplify(0, 3)
  │    └─ simplify(3, 4)
  └─ simplify(4, 8)
       ├─ simplify(4, 5)
       └─ simplify(5, 8)
```

Cada llamada que está "a medias" ocupa un hueco en la **pila de llamadas**
del lenguaje, que es donde JavaScript guarda a qué punto volver cuando la
función termine. Esa pila tiene un tamaño limitado (unas 10.000 llamadas
anidadas, según el navegador), y si se agota, el programa se para con
`RangeError: Maximum call stack size exceeded`.

Aquí la profundidad normal es pequeña. Pero un contorno patológico (una
espiral, una tira de 1 píxel que va y vuelve) puede anidar cientos de
niveles, y no quieres que la pestaña reviente por una sombra rara. En la 2B
ya tomaste esta decisión con el flood fill: **pila propia, nunca recursión**.
Aquí es la misma solución.

## 10.2 La pila de tramos

En la 2B la pila guardaba "píxeles pendientes de expandir". Aquí guarda
**"tramos pendientes de examinar"**, y un tramo son dos índices `(a, b)`. Para
no crear un objeto por tramo, se meten como dos números seguidos en un array
plano:

```
pending = [first, last]
mientras pending no esté vacía:
    b = pending.pop()
    a = pending.pop()          ← OJO al orden: LIFO, sale primero el último metido
    buscar el más lejano de la cuerda a→b
    si dmax > ε:
        keep[farthest] = cierto
        pending.push(a, farthest, farthest, b)    ← mete los DOS subtramos
```

Fíjate en el detalle del orden. Se hace `push(a, farthest, farthest, b)`:
cuatro números. Una pila devuelve en orden inverso, así que el primer `pop()`
da `b`, el segundo `farthest`… **Si sacas `a` primero y `b` después, te
llegan invertidos**: procesas tramos con `a > b`, el bucle `for (i = a+1; i <
b)` no entra nunca, `dmax` se queda en 0, y todos los contornos se
simplifican a 2 vértices sin ningún error. Es el bug clásico de este paso.

## 10.3 La misma simulación, en el orden real de la pila

Con la polilínea de la Parte 9. Anoto la pila después de cada iteración:

```
inicio:                 pending = [0, 8]
saco (0,8)  → keep 4  → pending = [0, 4, 4, 8]
saco (4,8)  → keep 5  → pending = [0, 4, 4, 5, 5, 8]
saco (5,8)  → nada    → pending = [0, 4, 4, 5]
saco (4,5)  → nada    → pending = [0, 4]
saco (0,4)  → keep 3  → pending = [0, 3, 3, 4]
saco (3,4)  → nada    → pending = [0, 3]
saco (0,3)  → nada    → pending = []          → fin
```

El orden en que se visitan los tramos es distinto al de la recursión (aquí
se hace primero el lado derecho), pero **el resultado es idéntico**: `keep =
{0, 3, 4, 5, 8}`. Cada tramo se decide solo con sus propios puntos; el orden
no influye.

## 10.4 `keep` en vez de listas nuevas

En lugar de construir una lista de vértices en cada nivel y concatenarlas,
se marca en un array de booleanos `keep[i]` y al final se recorre **una sola
vez**, de 0 a n. Así los vértices salen ordenados gratis (Parte 9.3) y no se
crean listas intermedias.

---

<a name="parte-11"></a>

# Parte 11 — El contorno es cerrado

## 11.1 El problema

Douglas–Peucker trabaja con una polilínea **abierta**: tiene un primer punto
y un último, y los conserva siempre (Parte 9.1). Tu contorno es un **ciclo**
(Parte 0, propiedad 4): no tiene ni principio ni fin. El índice 0 es un
accidente del barrido.

La idea raw es ignorarlo: pasarle el tramo `(0, n−1)` tal cual. Vamos a
hacerlo con el cuadrado de 12 puntos y `ε = 1`.

## 11.2 Ejecutando la idea raw: tramo `(0, 11)`

Cuerda `A = P[0] = (0,0)` → `B = P[11] = (0,1)`. Dos píxeles pegados: una
cuerda de longitud 1. Los intermedios se proyectan en sus extremos o fuera
de ella (la `t` de la Parte 7 vale 0 o se pasa de 1), así que la distancia
al segmento es la distancia al extremo más cercano. El más lejano es `(3,3)`, índice 6, a
`hypot(3,2) = 3.606` de `B`. Se conserva. Pendientes `(0,6)` y `(6,11)`.

**Tramo (0,6)** — cuerda `(0,0)→(3,3)`, `u = (3,3)`, `|u| = 4.243`, `cruz =
3y − 3x`:

| i | punto | cruz | distancia |
|---|---|---|---|
| 1 | (1,0) | −3 | 0.71 |
| 2 | (2,0) | −6 | 1.41 |
| 3 | (3,0) | −9 | **2.12** ← máximo |
| 4 | (3,1) | −6 | 1.41 |
| 5 | (3,2) | −3 | 0.71 |

`2.12 > 1` → se conserva el 3 = `(3,0)`. ✔ Es la esquina. Los subtramos
`(0,3)` y `(3,6)` son lados rectos: distancia 0, nada más.

**Tramo (6,11)** — cuerda `(3,3)→(0,1)`, `u = (−3,−2)`, `|u| = 3.606`, `cruz
= −3·(y−3) + 2·(x−3)`:

| i | punto | cruz | distancia |
|---|---|---|---|
| 7 | (2,3) | 0 − 2 = −2 | 0.55 |
| 8 | (1,3) | 0 − 4 = −4 | 1.11 |
| 9 | (0,3) | 0 − 6 = −6 | **1.66** ← máximo |
| 10 | (0,2) | 3 − 6 = −3 | 0.83 |

`1.66 > 1` → se conserva el 9 = `(0,3)`. ✔ Subtramos `(6,9)` y `(9,11)`:
rectos, nada.

**Resultado:**

```
keep = {0, 3, 6, 9, 11}   →   (0,0) (3,0) (3,3) (0,3) (0,1)
                                                        ↑
                                              5 vértices: uno FALSO
```

Las cuatro esquinas están. Pero el índice 11 = `(0,1)` también, porque **era
un extremo y los extremos se conservan siempre**. Un cuadrado con 5 vértices
no pasa el filtro "exactamente 4" del 2D. Y el error es sistemático: le pasa
a todos los contornos.

## 11.3 Diagnóstico

DP conserva sus dos extremos pase lo que pase. En un ciclo, los extremos son
dos puntos **vecinos** que no tienen nada de especial. La solución no es
tocar DP: es **elegir como extremos dos puntos que sean esquinas seguras**, y
partir el ciclo en dos polilíneas abiertas por ahí.

¿Qué puntos son esquinas seguras sin haber hecho nada todavía?

**El índice 0.** Por la propiedad 5 de la Parte 0: es el píxel más alto y,
de los más altos, el más a la izquierda. En una figura convexa (un
cuadrilátero lo es) un punto extremo así siempre es un vértice: si el lado de
arriba es horizontal, es su esquina izquierda; si no, es la punta de arriba.

**El punto más lejano del índice 0.** Fíjate en el cuadrado: desde `(0,0)`,
las distancias al cuadrado (`dx² + dy²`, sin raíz, que para comparar ordena
igual) son:

```
(3,3) → 18   ← máximo, y es una esquina
(3,2) → 13      (2,3) → 13
(3,1) → 10      (1,3) → 10
(3,0) →  9      (0,3) →  9
```

No es casualidad: caminando por un lado recto, la distancia a un punto fijo
crece hasta llegar al final del lado. El máximo cae siempre en una esquina.

## 11.4 Cómo se encuentra el más lejano: "campeón hasta ahora"

Buscar el máximo de una lista no necesita ordenarla ni comparar todos contra
todos. Una sola pasada, llevando dos variables: **la mejor marca vista hasta
ahora** y **quién la tiene**. Cada vez que alguien la supera, se convierte en
el nuevo campeón. La decisión es local: para saber si el punto `i` es el
mejor hasta ahora basta compararlo con el campeón actual.

Con el cuadrado de 12 puntos, tomando como referencia `P[0] = (0,0)`:

| i | punto | dx | dy | `d² = dx²+dy²` | ¿supera al campeón? | campeón | `far` |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | (arranque) | **−1** | — |
| 1 | (1,0) | 1 | 0 | 1 | 1 > −1 ✔ | 1 | 1 |
| 2 | (2,0) | 2 | 0 | 4 | 4 > 1 ✔ | 4 | 2 |
| 3 | (3,0) | 3 | 0 | 9 | 9 > 4 ✔ | 9 | 3 |
| 4 | (3,1) | 3 | 1 | 10 | 10 > 9 ✔ | 10 | 4 |
| 5 | (3,2) | 3 | 2 | 13 | 13 > 10 ✔ | 13 | 5 |
| 6 | (3,3) | 3 | 3 | **18** | 18 > 13 ✔ | **18** | **6** |
| 7 | (2,3) | 2 | 3 | 13 | ✘ | 18 | 6 |
| 8 | (1,3) | 1 | 3 | 10 | ✘ | 18 | 6 |
| 9 | (0,3) | 0 | 3 | 9 | ✘ | 18 | 6 |
| 10 | (0,2) | 0 | 2 | 4 | ✘ | 18 | 6 |
| 11 | (0,1) | 0 | 1 | 1 | ✘ | 18 | 6 |

`far = 6`, el punto `(3,3)`: la esquina opuesta, como decía 11.3.

Tres decisiones que tomas al escribirlo:

- **`d²`, sin raíz.** En toda la tabla no hay un solo `hypot`. Si `a > b`
  entonces `√a > √b`, así que la raíz no cambia quién gana: comparar 18 con
  13 da el mismo resultado que comparar 4.24 con 3.61. Te ahorras 800 raíces
  por contorno. Vale **solo para comparar**; si necesitaras la distancia en
  píxeles de verdad (para medirla contra `ε`), habría que hacer la raíz.
- **El campeón arranca en −1, no en 0.** Como `d²` nunca es negativo, así el
  primer punto siempre gana y `far` queda asignado. Arrancando en 0, un
  contorno donde todos los puntos fueran iguales a `P[0]` dejaría `far` sin
  asignar.
- **`>` estricto.** En un rectángulo puede haber dos puntos empatados en la
  distancia máxima: con `>` te quedas con el primero, con `>=` con el
  último. Los dos son esquinas válidas, pero conviene saber que estás
  eligiendo.

Es el mismo patrón que usarás dentro de `simplifyRange`, cambiando
"distancia al punto 0" por "distancia a la cuerda".

## 11.5 La solución: partir por `far`

1. `far` = índice del punto más lejano de `P[0]` (comparando `dx² + dy²`).
2. Primera mitad: tramo abierto `0..far`.
3. Segunda mitad: tramo abierto `far..n−1` **y de vuelta al 0**. Para que
   ese cierre no sea un caso especial, se añade una copia de `P[0]` al final
   del array, como índice `n`. La segunda mitad es entonces el tramo
   `far..n`, sin aritmética modular.
4. Se marcan `keep[0]`, `keep[far]` y `keep[n]`, se corren los dos tramos, y
   al recoger se recorre `0..n−1` (el índice `n` era una copia; no se
   devuelve).

Con el cuadrado: `far = 6`, `extended[12] = (0,0)`.

**Tramo (0,6)**: idéntico al de 11.2 → conserva el 3.

**Tramo (6,12)** — cuerda `(3,3)→(0,0)`, `u = (−3,−3)`, `|u| = 4.243`, `cruz
= −3·(y−3) + 3·(x−3)`:

| i | punto | cruz | distancia |
|---|---|---|---|
| 7 | (2,3) | 0 − 3 = −3 | 0.71 |
| 8 | (1,3) | 0 − 6 = −6 | 1.41 |
| 9 | (0,3) | 0 − 9 = −9 | **2.12** ← máximo |
| 10 | (0,2) | 3 − 9 = −6 | 1.41 |
| 11 | (0,1) | 6 − 9 = −3 | 0.71 |

`2.12 > 1` → se conserva el 9. Subtramos rectos.

**Resultado:**

```
keep = {0, 3, 6, 9}  (+ el 12, que se descarta)   →   (0,0) (3,0) (3,3) (0,3)

4 vértices. ✔
```

Compara las dos tablas de la segunda mitad: la única diferencia es que la
cuerda ahora llega hasta `(0,0)` en vez de pararse en `(0,1)`, y por eso el
`(0,1)` es un intermedio más, a `0.71`, y se tira.

---

<a name="parte-12"></a>

# Parte 12 — `ε` proporcional al tamaño

## 12.1 El problema de una `ε` fija

En la Parte 5 dije que `ε` aguanta el cambio de tamaño porque un lado recto
se desvía medio píxel mida lo que mida. Es verdad para los lados. Pero mira
las esquinas y el ruido:

**Marcador lejos** — el cuadrado de 3×3 de la guía 2B, 8 puntos de borde,
lado de 2. Con `ε = 3`: la esquina `(2,0)` respecto a la cuerda
`(0,0)→(2,2)` está a `|2·0 − 2·2| / 2.83 = 1.41`. `1.41 ≤ 3` → **se tira**.
Todas las esquinas desaparecen: el cuadrado se simplifica a 2 vértices. Muerto.

**Marcador cerca** — 200 px de lado, 800 puntos. El umbral de la Fase 1 no
da un borde limpio: con el desenfoque de la lente y la sombra, el borde
serpentea 2-4 píxeles, y las esquinas salen redondeadas con un radio de
varios píxeles. Con `ε = 3`, cada serpenteo de 4 px es un vértice y cada
esquina redondeada da 2 ó 3. Salen 8-12 vértices. Tampoco es un
cuadrilátero.

Una `ε` fija es demasiado grande para lo lejano y demasiado pequeña para lo
cercano. **Es el problema de `k` otra vez**, en versión suave.

## 12.2 La solución: `ε` relativa al perímetro

Lo que quieres es que **el mismo marcador dé el mismo polígono esté a la
distancia que esté**. Eso se consigue si `ε` crece con el tamaño del
contorno:

```
ε = 0.03 × points.length
```

`points.length` es el número de píxeles del borde: aproximadamente el
perímetro en píxeles (un paso en diagonal mide 1.41 y cuenta 1, pero para
esto da igual).

```
800 puntos  →  ε = 24
 80 puntos  →  ε = 2.4
 12 puntos  →  ε = 0.36
```

Por qué funciona, con el cuadrado de lado `L`: su perímetro es `4L`, y la
distancia de una esquina a la cuerda que une las dos esquinas opuestas es
`L/√2 = 0.707·L`. La relación entre las dos es `0.707L / 4L = 0.177`,
**independiente de `L`**. Con el factor `0.03`, la esquina siempre queda 6
veces por encima del umbral, mida el cuadrado 12 píxeles u 800. Y un
serpenteo de 4 px en un contorno de 800 (`ε = 24`) se tira sin discusión.

A esto se le llama **invariancia a la escala**: el resultado no depende del
tamaño. Es la propiedad que le faltaba a `k`.

## 12.3 El factor es un mando

`0.03` es un punto de partida, no una ley. Si al probarlo todo te da 2-3
vértices, es demasiado grande; si todo da 40, demasiado pequeño. Guárdalo
como constante con nombre en `main.ts` (`SIMPLIFY_FACTOR`) y ajústalo mirando
el contador de vértices en el `#probe`.

---

<a name="parte-13"></a>

# Parte 13 — Pseudocódigo, código e integración

## 13.1 Pseudocódigo completo

<details>
<summary>▶ Pseudocódigo</summary>

```
función distanceToSegment(P, A, B) → número          # Parte 7
    ux = B.x − A.x
    uy = B.y − A.y
    length2 = ux·ux + uy·uy
    si length2 == 0:
        devolver hypot(P.x − A.x, P.y − A.y)
    t = ((P.x − A.x)·ux + (P.y − A.y)·uy) / length2
    t = max(0, min(1, t))
    Qx = A.x + t·ux
    Qy = A.y + t·uy
    devolver hypot(P.x − Qx, P.y − Qy)


función simplifyRange(points, first, last, ε, keep)   # Partes 9 y 10, tramo ABIERTO
    pending = [first, last]
    mientras pending no vacía:
        b = pending.pop()
        a = pending.pop()
        maxDistance = 0
        farthest = −1
        para i desde a+1 hasta b−1:
            d = distanceToSegment(points[i], points[a], points[b])
            si d > maxDistance:
                maxDistance = d
                farthest = i
        si maxDistance > ε:
            keep[farthest] = cierto
            pending.push(a, farthest, farthest, b)


función simplifyClosed(points, ε) → lista de vértices   # Parte 11
    n = points.length
    si n < 3: devolver copia de points

    far = índice del punto más lejano de points[0]     (comparando dx²+dy²)

    extended = points + [ points[0] ]     # el cierre, como índice n
    keep = array de n+1 booleanos a falso
    keep[0] = keep[far] = keep[n] = cierto

    simplifyRange(extended, 0,   far, ε, keep)
    simplifyRange(extended, far, n,   ε, keep)

    devolver [ points[i] para i en 0..n−1 si keep[i] ]
```

</details>

## 13.2 Código: `src/cv/polygon.ts`

> **Estado a 2026-10-01:** el archivo ya existe y tiene escritas
> `distanceToSegment` y `farthestIndex`, las dos con `export` y verificadas
> con `tsc`. `Point` ya está exportado en `contour.ts`. **Lo que falta es
> `simplifyRange` y `simplifyClosed`**, que es lo que viene abajo.
>
> Ojo con dos detalles al pegarlo:
>
> - `simplifyClosed` **llama a `farthestIndex`**, no repite la búsqueda del
>   más lejano. Si la escribes otra vez dentro, tendrás el mismo código en
>   dos sitios.
> - Cuando `simplifyRange` empiece a usar `distanceToSegment`, puedes
>   quitarle el `export` a esta última: lo lleva solo porque sin ningún uso
>   `noUnusedLocals` rompía la compilación. Lo mismo con `farthestIndex`, a
>   menos que la quieras seguir probando desde `main.ts`.

<details>
<summary>▶ Código — lo que falta en src/cv/polygon.ts</summary>

```ts
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

  const far = farthestIndex(points);

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
```

Notas sobre el código:

- `pending.pop()!`: el `!` le dice a TypeScript "sé que no es `undefined`".
  Es verdad porque siempre se mete de dos en dos y se saca de dos en dos, y
  el `while` comprueba que queda algo. Es uno de los pocos sitios donde el
  `!` no miente.
- `points.slice()` para `n < 3`: devuelve una **copia**, para que quien llame
  no pueda modificar `contour.points` sin querer a través del resultado.
- Este código hace `concat`, `new Array` y `push` en cada contorno de cada
  frame. Es lo mismo que la nota 4.2 de la guía 2B: **no lo optimices
  ahora**. Con `Point[]` se razona y se depura en la mitad de tiempo; la Fase
  9 es para medir y recortar.

</details>

## 13.3 Integración en `main.ts`

<details>
<summary>▶ Código — lo que cambia en src/main.ts</summary>

**Import:**

```ts
import { simplifyClosed } from "./cv/polygon";
```

**Constante** (junto a `MIN_AREA`):

```ts
/** Tolerancia de Douglas-Peucker, como fraccion del numero de puntos del contorno. */
const SIMPLIFY_FACTOR = 0.03;
```

**Dentro de `tick`**, después de `putImageData` (se dibuja con el API de
canvas *encima* de los píxeles, así que tiene que ir después de devolverlos):

```ts
// 9. Contornos -> poligonos. Se dibuja cada uno en verde, con sus vertices.
let quadCandidates = 0;
canvasContext.strokeStyle = "lime";
canvasContext.lineWidth = 2;
for (const contour of contours) {
  const polygon = simplifyClosed(contour.points, contour.points.length * SIMPLIFY_FACTOR);
  if (polygon.length === 4) quadCandidates++;

  canvasContext.beginPath();
  canvasContext.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i++) {
    canvasContext.lineTo(polygon[i].x, polygon[i].y);
  }
  canvasContext.closePath();
  canvasContext.stroke();
}
```

**Probe:** añade `poligonos de 4: ${quadCandidates}`.

</details>

### ✅ Criterio de "esto está bien"

- Un folio, un libro o un marcador impreso: **polígono verde de 4 lados**,
  con los vértices clavados en las esquinas, que sigue siendo de 4 cuando
  giras el folio o lo alejas.
- Tu mano: un polígono verde de muchos lados que sigue la silueta.
- Un vaso o una taza vista desde arriba: polígono de 8-15 lados.
- `poligonos de 4` en el probe: 1-3 con un folio en escena, sin bailar mucho
  entre frames.

Si el contador de 4 baila entre 4 y 5 con el folio quieto, lo normal es que
una esquina esté redondeada por el desenfoque y `ε` la esté partiendo a
veces sí y a veces no: sube `SIMPLIFY_FACTOR` un poco.

## 13.4 Lo que viene después (para situarte, no para hacerlo ahora)

El Paso 2D coge estos polígonos y filtra: exactamente 4 vértices, convexo,
área y lado mínimos, y los normaliza (horario, empezando por
arriba-izquierda). Ahí es donde vuelve el **signo** del producto cruzado de
la Parte 6.6. Está descrito en `CONTEXT.md`, Fase 2, Paso 2D.

---

<a name="apendice-a"></a>

# Apéndice A — Checklist de depuración (síntoma → causa)

| síntoma | causa casi segura |
|---|---|
| `tsc` se queja de que `Point` no existe | falta `export` en `interface Point` de `contour.ts` |
| **Todo** se simplifica a 2 vértices | `pop()` de `a` y `b` al revés (tramos con `a > b`, el `for` no entra) — o `ε` enorme |
| Salen muchos más vértices de los que debería, y pegados | guardas **todos** los puntos que se pasan de `ε` en vez de solo el máximo: el `keep[...] = true` tiene que ir FUERA del bucle que recorre los puntos (§9.1b) |
| `far` acaba siendo 0, o `points[far]` es `undefined` | el campeón arranca en 0 en vez de −1, o el bucle empieza en `i = 0` (§11.4) |
| Todo da 30-40 vértices | `ε` demasiado pequeña, o `SIMPLIFY_FACTOR` multiplicado por `area` en vez de por `points.length` |
| Un contorno se queda sin vértices, sin error | `NaN`: falta la guarda `length2 === 0` |
| Cuadrados con 5 vértices, uno pegado al primero | has pasado `(0, n−1)` en vez de partir por `far` (Parte 11.2) |
| El primer vértice sale duplicado al final | devuelves `extended` o recorres hasta `n` en vez de `n−1` al recoger |
| Las esquinas salen desplazadas a lo largo del lado | estás midiendo a la recta infinita sin recortar `t`, o has hecho el barrido de la Parte 8 |
| Un folio da 4 de cerca y 2 de lejos | `ε` fija en píxeles, no proporcional |
| El polígono no se ve | lo dibujas **antes** de `putImageData`, que lo pisa |
| `RangeError: Maximum call stack size exceeded` | has escrito la recursión en vez de la pila |

<a name="apendice-b"></a>

# Apéndice B — Fórmulas de una línea

```
u = B − A                              vector (flecha) de A a B
|u| = hypot(ux, uy) = √(ux² + uy²)     longitud
|u|² = ux² + uy²                       "length2", sin raíz

ux·vy − uy·vx                          producto cruzado = área del paralelogramo (con signo)
|cruz| / |u|                           distancia de P a la RECTA por A y B  (v = P − A)

ux·vx + uy·vy                          producto escalar = |u| × (sombra de v sobre u)
t = (u · v) / |u|²                     fracción de la cuerda donde cae la proyección
t = max(0, min(1, t))                  recorte al segmento
Q = A + t·u                            punto del segmento más cercano a P
hypot(P − Q)                           distancia de P al SEGMENTO

ε = 0.03 × points.length               tolerancia proporcional al perímetro
pending.push(a, m, m, b)               los dos subtramos; se sacan b y luego a
```

<a name="apendice-c"></a>

# Apéndice C — Glosario

**Vector.** Un desplazamiento `(dx, dy)`: "avanza `dx`, baja `dy`". Sale de
restar dos puntos (destino − origen). Un punto es una posición; un vector es
un movimiento.

**Longitud (módulo) de un vector.** `√(dx² + dy²)`, Pitágoras. `Math.hypot`.

**Producto cruzado (2D).** `ux·vy − uy·vx`. Área del paralelogramo que
forman `u` y `v`, con signo según el lado. Dividido por `|u|`, la distancia
de la punta de `v` a la recta de `u`.

**Producto escalar.** `ux·vx + uy·vy`. Mide cuánto de `v` va en la dirección
de `u`. Dividido por `|u|²` da `t`, la fracción de `u` donde cae la sombra de
`v`.

**Proyección.** Dejar caer un punto en perpendicular sobre una recta. El
punto donde cae es `Q`.

**Polilínea.** Lista ordenada de puntos unidos por segmentos. Abierta si
tiene principio y fin; cerrada si el último se une al primero.

**Cuerda.** El segmento que une el primer y el último punto de un tramo.

**`ε` (épsilon), tolerancia.** Cuántos píxeles se permite un punto alejarse
de la cuerda antes de contar como vértice.

**Douglas–Peucker.** Simplificar una polilínea conservando el punto más
alejado de la cuerda (si se pasa de `ε`) y repitiendo a cada lado.

**Recursión.** Una función que se llama a sí misma con un problema más
pequeño. Consume pila de llamadas; se sustituye por una pila propia.

**Invariancia a la escala.** Que el resultado no cambie cuando la figura se
ve más grande o más pequeña. Se consigue con `ε` proporcional al perímetro.
