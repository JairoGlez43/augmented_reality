# MEMORY.md — Estado actual

> Dónde estamos exactamente. Claude lo lee al empezar cada sesión y lo
> actualiza al terminar cada paso. Tú lo actualizas cuando trabajas offline.
> El temario completo está en `CONTEXT.md`.

## Posición

| | |
|---|---|
| **Fase actual** | **2 — Contornos y cuadriláteros** |
| **Paso actual** | **2C** — `polygon.ts` a medias: 2 de 4 funciones |
| **Último commit** | ver `git log -1` (Paso 2B ✅ en `c2789ab`) |
| **Última sesión** | 2026-10-01 |
| **Rendimiento** | `tick` ≈ 10-11 ms de 16.6 (F0+F1) |

## Siguiente acción concreta

Paso 2B cerrado (guía `GUIA-FASE-2B.md`). Empezar el **Paso 2C** con
**`GUIA-FASE-2C.md`**:

1. ~~Flood fill en `src/cv/contour.ts` (`labelRegions`) → pintar cada región de
   un color y ver el contador en `#probe`.~~ ✅ hecho
2. ~~Buffers `labelsBuffer` y `stackBuffer` en `main.ts`.~~ ✅ hecho
3. ~~Añadir `area` + filtro `minArea`/`maxArea` → renombrar a `findContours`.~~
   ✅ hecho
4. ~~`traceBorder` (Moore) → puntos del borde en rojo.~~ ✅ commit `c2789ab`
   (2026-09-22). En el review se limpió `contour.ts` entero (comentarios en
   inglés, `directionIndex`, `traceBorder` ya no exportada, `Point` sí) y en
   `main.ts` se quitó el texto de depuración de `#status` y se añadió
   `MAX_AREA_FRACTION`.
5. **Paso 2C** con **`GUIA-FASE-2C.md`**. Estado de `src/cv/polygon.ts`:

   | función | estado |
   |---|---|
   | `distanceToSegment(p, a, b)` | ✅ escrita, compila |
   | `farthestIndex(points)` | ✅ escrita, compila |
   | `simplifyRange(...)` | ⬅ **AQUÍ** |
   | `simplifyClosed(points, epsilon)` | falta |

   Las dos que faltan están en la **guía §13.2**, con una nota arriba de los
   dos detalles a tener en cuenta al pegarlas (que `simplifyClosed` llama a
   `farthestIndex` en vez de repetir la búsqueda, y lo de quitar los
   `export` temporales). Después, la integración en `main.ts` es la §13.3 y
   el criterio ✅ de pantalla está justo debajo.

   **Nada de esto se ha visto funcionando todavía**: las dos funciones
   escritas solo están verificadas con `tsc`, no en pantalla. Al terminar
   `simplifyClosed`, lo primero es el criterio de §13.3 (un folio → 4
   vértices).

   Trampas conocidas, por orden de probabilidad: el `pop()` de `a` y `b` al
   revés (§10.2), guardar todos los puntos que se pasan de `epsilon` en vez
   de solo el máximo (§9.1b), y dibujar el polígono antes de `putImageData`
   (se lo come). Todo en el Apéndice A.

Dudas que quedaron resueltas en la sesión: el barrido no repite trabajo (la
guarda `labels[p] !== 0` es O(1)); hay tres niveles de bucle (barrido → `while`
de la pila → 8 vecinos); etiquetar al meter, no al sacar.

**Sesión 2026-09-21** — `labelRegions` + coloreado por etiqueta funcionando.
Dos dudas grandes, resueltas y ya incorporadas a la guía (§3.2 y §3.3):

- **`b` (punto de apoyo) es SIEMPRE fondo**, nunca el `p` anterior. Pies y mano
  van por sitios distintos: los pies por la mancha, la mano por el fondo. Hay
  tabla de verificación en §3.5 y un `console.assert` recomendado.
- **No se puede empezar el recorrido en un píxel interior**: sus 8 vecinos son
  tinta, no existe `b` válido, la precondición no se cumple. Por eso se arranca
  siempre en el píxel del barrido, cuyo Oeste es fondo garantizado.

También descartada una propuesta suya: sacar el contorno con min/max de x e y.
Eso da la **bounding box**, no el contorno — para un cuadrado girado 45° las
esquinas salen a 45° de las verdaderas. Y aunque se acertara con los píxeles de
borde, un **conjunto** no sirve: Douglas–Peucker necesita una secuencia
**ordenada**.

**Sesión 2026-09-22** — Jairo leyó la Parte 5 de la guía 2B y no vio de dónde
salía Douglas–Peucker ni las fórmulas (`hypot`, `t`). Se explicó en chat, desde
abajo y con números: el objetivo de 2C (4 esquinas ordenadas para la
homografía), por qué "esquina = donde gira" falla (8 direcciones → 45° de
ruido), por qué mirar más lejos con `k` tampoco (rango `escalón < k < lado`
que se vacía de lejos y la perspectiva lo rompe dentro del mismo contorno), el
cambio de pregunta a tramos con tolerancia `ε`, y la distancia punto-recta vía
área del paralelogramo (producto cruzado). Vectores: los recuerda vagamente de
la universidad; se le explican desde cero cuando hacen falta.

Resultado: **`GUIA-FASE-2C.md`**, guía nueva con ese mismo estilo (idea raw →
fallo con números → parche → fallo → solución), sin asumir nada de fases
anteriores. La Parte 5 de la guía 2B se sustituyó por un puntero. Petición
explícita de Jairo para todas las guías offline: nunca subir el nivel de
partida, introducir cada concepto donde se usa, porque las lee a trozos con
semanas de por medio y sin poder preguntar.

**Sesión 2026-09-25** — Dos huecos que él detectó en la guía 2C, ya tapados:

- **De dónde sale la idea de medir distancias punto-recta** (§5.3, nueva):
  simplificar es *borrar puntos*, y la distancia de un punto a la cuerda es
  cuánto se deforma la figura al borrarlo. Más: por qué la cuerda y no una
  recta de ajuste (los tramos deben engancharse; los vértices deben ser
  píxeles reales), y por qué el máximo y no la suma ni la media (tabla con
  los dos contraejemplos).
- **Deducción de `ux·vy − uy·vx`** (§6.5, nueva): entendía el recorte del
  rectángulo pero no pudo llegar a la fórmula. Le faltaba hacerlo con letras:
  tabla de las 6 piezas y el desarrollo de `(ux+vx)(uy+vy)` cancelando
  recortes.

Lección para las guías: cuando una fórmula aparece, no basta comprobarla con
números — hay que **deducirla**. Y cuando se elige una medida (distancia,
máximo, cuerda), decir qué alternativas había y por qué se descartaron.

**Sesión 2026-09-29** — Reconstruyó el algoritmo con sus palabras. Tres cosas
a recordar de cómo piensa:

- Llegó **solo** a la pregunta que mata la detección por ángulos ("¿desde
  dónde empieza el vector de entrada y hasta dónde el de salida?"). Cuando
  la formule él, confirmárselo: es la `k` de la Parte 4.
- Tenía el criterio **invertido**: creía que `distancia > epsilon` descarta
  la mancha. Es al revés (guarda un vértice); el descarte es al final,
  contando. Añadido destacado en §1.5.
- Su modelo era **circular** (trazaba la cuerda "hasta el vértice", usando
  el resultado como dato). Es el mismo defecto que tienen los mínimos
  cuadrados aquí, y romper esa circularidad es la idea central de DP.
  Añadido como razón decisiva en la Decisión B de §5.3.

Añadido a la guía: §1.4 (un cuadrado en perspectiva NO tiene ángulos de 90°:
124/124/56/56 — creía que el criterio era "4 ángulos rectos") y **§1.5, el
plan entero en pasos numerados**, en el formato de secuencia simple que él
mismo usó y pidió.

## Pendientes acumulados (no bloquean)

- [ ] **Repo público** (decidido 2026-09-20, ver CONTEXT.md → "Este repo es
      público"): pasar código y comentarios a inglés, quitar los 17
      `console.*` de `src/`, escribir `README.md` y `docs/journey.md`. La
      diapositiva de F1 (300 ms → 10 ms con tabla integral) es la primera y ya
      está vivida. Se hace al cerrar F2, no ahora: no interrumpir el paso 2B.
- [ ] Ocultar el `<video>` (`display: none`) y comprobar que el canvas sigue
      pintando. Si deja de hacerlo, avisar a Claude: hay un matiz.
- [ ] `tick` en 10-11 ms deja poco margen para F2-F7. Se recorta en F9
      (no pasar por RGBA, `requestVideoFrameCallback`, Worker).
- [ ] `style.css` es el de la plantilla de Vite y no se importa. Limpiar o
      importar cuando toque la UI (F7/F11).
- [ ] Fase 0 dejó anotado: `WINDOW_RADIUS` a 40 no debería cambiar el tiempo
      (prueba de que la tabla integral está bien). Verificar si no se hizo.

## Decisiones tomadas (para no reabrirlas)

- Vanilla TS, sin React, sin librerías de visión. Three.js solo en F7B.
- Un solo botón toggle. `renderUI()` único escritor de UI de control.
- Tabla integral **inclusiva** (`T(x,y)` incluye el píxel), mismo tamaño que la
  imagen, con lectura que devuelve 0 fuera. (Convención elegida por Jairo; la
  alternativa con fila/columna de ceros extra es equivalente.)
- Homografía de F3 por sistema 8×8 exacto, no DLT+SVD (eso en F10).
- Convención de cuadrilátero: horario en pantalla, esquina 0 = menor `x+y`.
- Marcador (F4): rejilla 6×6, borde negro, 16 bits interiores.

## Historial de fases

| Fase | Estado | Commit | Notas |
|---|---|---|---|
| 0 Captura | ✅ | `feat: add brightness probe...` | 13 bugs documentados en CONTEXT |
| 1 Umbral | ✅ | `Fase 1: umbral adaptativo...` | 300 ms → 10 ms con tabla integral |
| 2 Contornos | ⏳ | | |
| 3 Homografía | | | solución verificada en CONTEXT |
| 4 Decodificación | | | |
| 5 Calibración | | | |
| 6 Pose | | | |
| 7 Render | | | |
| 8 Tracking | | | |
| 9 Rendimiento | | | |
| 10 Markerless | | | |
| 11 Portafolio | | | |

## Notas offline (escribe aquí cuando trabajes sin Claude)

_Formato sugerido: fecha · paso · qué hice · qué dudas me quedaron · dónde me quedé._

-

## Protocolo de reanudación (para Claude)

1. Leer este archivo. Leer "Notas offline".
2. Si hay notas: revisar el código escrito offline (bugs, limpieza, rendimiento)
   **antes** de avanzar. Responder las dudas anotadas.
3. Actualizar "Posición" y vaciar "Notas offline" (moviendo lo relevante a
   Decisiones o Pendientes).
4. Continuar por "Siguiente acción concreta" con el método de `CONTEXT.md`.
5. Al cerrar un paso: actualizar Posición, Siguiente acción, y si se cerró una
   fase, la tabla de Historial y la sección "Lo hecho" de `CONTEXT.md`
   (conceptos + bugs y lecciones), y añadir la solución verificada de la fase
   siguiente-siguiente.
