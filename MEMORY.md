# MEMORY.md — Estado actual

> Dónde estamos exactamente. Claude lo lee al empezar cada sesión y lo
> actualiza al terminar cada paso. Tú lo actualizas cuando trabajas offline.
> El temario completo está en `CONTEXT.md`.

## Posición

| | |
|---|---|
| **Fase actual** | **2 — Contornos y cuadriláteros** |
| **Paso actual** | **2A** — buffer binario aparte (no empezado) |
| **Último commit** | `Fase 1: umbral adaptativo con tabla de sumas acumuladas` |
| **Última sesión** | 2026-09-15 |
| **Rendimiento** | `tick` ≈ 10-11 ms de 16.6 (F0+F1) |

## Siguiente acción concreta

Leer en `CONTEXT.md` → *Fase 2 → Conceptos* y hacer el **Paso 2A**: crear
`binaryBuffer: Uint8Array` (1 = tinta, 0 = fondo), reservado una vez, y
escribir en él en la pasada 3. Criterio: la imagen se ve igual que antes.

## Pendientes acumulados (no bloquean)

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
