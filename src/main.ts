import { startCamera, stopCamera, waitForVideoMetadata } from "./camera";

// ---------------------------------------------------------------------------
// 1. ESTADO
// ---------------------------------------------------------------------------
// Estas tres variables son la unica verdad del programa. Todo lo que se ve en
// pantalla es una consecuencia de ellas.
//
// Fijate en lo que NO hay: no existe un booleano `encendida`. Eso es estado
// DERIVADO: "encendida" es exactamente `cameraStream !== null`. Guardarlo
// aparte serian dos copias de la misma verdad, y dos copias se desincronizan.

/** null = camara apagada. No-null = camara encendida. */
let cameraStream: MediaStream | null = null;

/** true mientras esperamos la respuesta de getUserMedia (puede tardar segundos). */
let busy = false;

/** Mensaje para el usuario. Cadena vacia = no hay nada que decir. */
let statusMessage = "";

let rafId = 0;   // 0 = parado. requestAnimationFrame nunca devuelve 0

/** Marca de tiempo del ultimo refresco del lector de brillo (throttling). */
let lastProbeUpdate = 0;

/** Margen del umbral adaptativo: cuanto mas oscuro que su entorno debe ser un
 *  pixel para contar como tinta. Se controla con el slider. */
let margin = 10;

/** Radio de la ventana: 15 -> se mira un cuadrado de 31x31 alrededor de cada
 *  pixel. Debe ser mayor que el grosor del detalle a detectar, para que la
 *  media represente el fondo de la zona y no el propio trazo. */
const WINDOW_RADIUS = 15;

/** Imagen en grises, 1 byte por pixel. Se reserva una vez y se reutiliza. */
let grayBuffer = new Uint8ClampedArray(0);

/** Tabla de sumas acumuladas: integral[y*width+x] = suma del rectangulo
 *  (0,0)..(x,y), el ultimo incluido. Mismo tamano que la imagen. */
let integral = new Uint32Array(0);





// ---------------------------------------------------------------------------
// 2. REFERENCIAS AL DOM
// ---------------------------------------------------------------------------

/**
 * Busca un elemento y revienta si no existe.
 *
 * Esto sustituye al `elemento?.addEventListener(...)` de antes. Con el `?.`,
 * una errata en el id no daba ningun error: el boton simplemente no hacia
 * nada y te pasabas veinte minutos buscando el fallo. Si el elemento TIENE
 * que existir, su ausencia debe ser ruidosa.
 *
 * Ademas resuelve el TS18047: al devolver `T` (nunca null), TypeScript ya no
 * tiene que preguntarse si el boton existe en cada uso.
 */
function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Falta el elemento #${id} en index.html`);
  }
  return element as T;
}

function require2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }
  return context;
}

const cameraButton = requireElement<HTMLButtonElement>("camera-button");
const statusText = requireElement<HTMLParagraphElement>("status");
const videoElement = requireElement<HTMLVideoElement>("camera-stream");
const canvasElement = requireElement<HTMLCanvasElement>("view");
const probeText = requireElement<HTMLParagraphElement>("probe");
const thresholdInput = requireElement<HTMLInputElement>("threshold");

const canvasContext = require2dContext(canvasElement);

thresholdInput.addEventListener("input", () => {
  margin = thresholdInput.valueAsNumber;
});

/**
 * Un frame del pipeline. La llama el navegador ~60 veces por segundo, justo
 * antes de repintar la pantalla.
 *
 * `now` es el timestamp en milisegundos que requestAnimationFrame pasa al
 * callback. Lo usamos para no escribir en el DOM 60 veces por segundo.
 */
function tick(now: number): void {
  const startedAt = performance.now();

  const width = canvasElement.width;
  const height = canvasElement.height;
  const pixelCount = width * height;

  // 1. Copiar el frame actual del <video> al canvas.
  canvasContext.drawImage(videoElement, 0, 0, width, height);

  // 2. Leer TODOS los pixeles (RGBA, 4 bytes por pixel).
  const frame = canvasContext.getImageData(0, 0, width, height);
  const data = frame.data;

  // Los buffers se reservan UNA vez y se reutilizan: reservar cientos de KB
  // sesenta veces por segundo haria trabajar al recolector sin parar.
  if (grayBuffer.length !== pixelCount) {
    grayBuffer = new Uint8ClampedArray(pixelCount);
    // Uint32 y no Uint8: la suma de toda la imagen llega a ~58 millones.
    integral = new Uint32Array(pixelCount);
  }

  // 3. PASADA 1 -> a grises. `i` avanza de 4 en 4 sobre data (RGBA) y `p` de
  //    1 en 1 sobre gray (1 byte por pixel).
  for (let i = 0, p = 0; p < pixelCount; i += 4, p++) {
    grayBuffer[p] = (77 * data[i] + 150 * data[i + 1] + 29 * data[i + 2]) >> 8;
  }

  // 4. PASADA 2 -> tabla de sumas acumuladas.
  //    T(x,y) = suma de todos los pixeles del rectangulo (0,0)..(x,y), el
  //    ultimo incluido. Se apoya en las tres celdas ya calculadas:
  //
  //      T(x,y) = gray(x,y) + T(x-1,y) + T(x,y-1) - T(x-1,y-1)
  //                            izquierda   arriba    contado dos veces
  //
  //    Fuera de la imagen vale 0: "la suma de una fila que no existe".
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const rowAbove = row - width;

    for (let x = 0; x < width; x++) {
      const left = x > 0 ? integral[row + x - 1] : 0;
      const up = y > 0 ? integral[rowAbove + x] : 0;
      const upLeft = x > 0 && y > 0 ? integral[rowAbove + x - 1] : 0;

      integral[row + x] = grayBuffer[row + x] + left + up - upLeft;
    }
  }

  // Lectura de la tabla que devuelve 0 fuera de la imagen. Eso es lo que hace
  // que la formula de abajo funcione igual en el borde que en el centro.
  const at = (px: number, py: number): number =>
    px < 0 || py < 0 ? 0 : integral[py * width + px];

  // 5. PASADA 3 -> umbral adaptativo.
  for (let y = 0; y < height; y++) {
    // La ventana se recorta a los limites de la imagen.
    const y0 = Math.max(0, y - WINDOW_RADIUS);
    const y1 = Math.min(height - 1, y + WINDOW_RADIUS);

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - WINDOW_RADIUS);
      const x1 = Math.min(width - 1, x + WINDOW_RADIUS);

      // Los cuatro terminos salen de combinar los dos bordes en x (x0-1 y x1)
      // con los dos bordes en y (y0-1 y y1):
      //
      //     T(x1,y1)      todo el bloque desde el origen
      //   - T(x0-1,y1)    la franja de la izquierda que sobra
      //   - T(x1,y0-1)    la franja de arriba que sobra
      //   + T(x0-1,y0-1)  la esquina, restada dos veces
      //
      // Son 4 lecturas tanto si el radio es 1 como si es 50.
      const sum =
        at(x1, y1) - at(x0 - 1, y1) - at(x1, y0 - 1) + at(x0 - 1, y0 - 1);

      // Los pixeles REALES de la ventana, no (2r+1)^2: en una esquina la
      // ventana recortada es mas pequena.
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const mean = sum / count;

      const p = y * width + x;
      const value = grayBuffer[p] < mean - margin ? 0 : 255;

      const i = p * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
  }

  // 6. Devolver los pixeles al canvas.
  canvasContext.putImageData(frame, 0, 0);

  const elapsed = performance.now() - startedAt;

  if (now - lastProbeUpdate > 200) {
    lastProbeUpdate = now;
    probeText.textContent =
      `Margen C: ${margin}  |  radio: ${WINDOW_RADIUS}  |  ` +
      `tick: ${elapsed.toFixed(1)} ms  (presupuesto 16.6 ms)`;
  }

  rafId = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// 3. RENDER: el unico sitio del programa que escribe en el DOM
// ---------------------------------------------------------------------------

/**
 * Lee el estado y escribe TODA la interfaz.
 *
 * Esta es la idea central de React reimplementada en diez lineas. La regla que
 * nos autoimponemos: nadie toca el DOM fuera de aqui. Para cambiar la pantalla
 * se cambia el estado y se llama a renderUI(). Asi es imposible que la interfaz
 * mienta, porque solo hay un lugar que la escribe.
 *
 * Nota: ASIGNA, no devuelve. Calcular la etiqueta no sirve de nada si nadie
 * la escribe; en vanilla el que aplica el cambio eres tu.
 */
function renderUI(): void {
  
  //console.log("renderUI", { busy, cameraStream, statusMessage });
  if (busy) {
    cameraButton.textContent = "Abriendo camara...";
  } else if (cameraStream) {
    cameraButton.textContent = "Apagar camara";
  } else {
    cameraButton.textContent = "Encender camara";
  }

  // `disabled` es la PROPIEDAD del DOM (el estado vivo), no el atributo HTML
  // (que solo describe el valor inicial). Un boton deshabilitado deja de
  // emitir eventos click: el navegador bloquea la carrera de verdad.
  cameraButton.disabled = busy;

  statusText.textContent = statusMessage;

  if (videoElement.srcObject !== cameraStream) {
    videoElement.srcObject = cameraStream;  
  }
}

// ---------------------------------------------------------------------------
// 4. TRADUCCION DE ERRORES (esto es texto de interfaz, por eso vive aqui)
// ---------------------------------------------------------------------------

/**
 * getUserMedia rechaza con un DOMException cuya propiedad `.name` dice el
 * motivo. Con "strict": true, el parametro de un catch es `unknown`, asi que
 * hay que ESTRECHAR el tipo con `instanceof` antes de poder leer `.name`.
 */
function describeCameraError(error: unknown): string {
  if (!(error instanceof DOMException)) {
    // Si no es un DOMException, no es un fallo de camara: es un bug nuestro.
    // No lo disfrazamos de mensaje amable.
    return `Error inesperado: ${String(error)}`;
  }

  switch (error.name) {
    case "NotAllowedError":
      return "Has denegado el permiso de camara. Concedelo en el icono de la barra de direcciones y vuelve a intentarlo.";
    case "NotFoundError":
      return "No se ha encontrado ninguna camara en este dispositivo.";
    case "NotReadableError":
      return "La camara existe, pero otra aplicacion la esta usando (Teams, Zoom, OBS...). Cierrala y reintenta.";
    case "OverconstrainedError":
      return "La camara no soporta la configuracion solicitada.";
    default:
      return `No se ha podido abrir la camara (${error.name}).`;
  }
}

// ---------------------------------------------------------------------------
// 5. EL UNICO LISTENER
// ---------------------------------------------------------------------------
// Un boton, un addEventListener, registrado una sola vez al cargar la pagina.
// La decision de encender o apagar se toma DENTRO del cuerpo, en cada click,
// porque es ahi donde el estado tiene su valor actual.

cameraButton.addEventListener("click", async () => {
  // --- Rama APAGAR: sincrona, no puede fallar, termina aqui.
  if (cameraStream) {
    stopCamera(cameraStream);
    //console.log(cameraStream.active);
    cameraStream = null;
    cancelAnimationFrame(rafId);
    rafId = 0;
    canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);
    probeText.textContent = ""; // el lector se apaga con el bucle
    statusMessage = "";
    renderUI();
    return;
  }

  // --- Rama ENCENDER ---
  // Estas tres lineas son SINCRONAS y ocurren antes del await. Ahi se cierra
  // la carrera del doble click: JavaScript no interrumpe codigo sincrono, asi
  // que cuando llega la pausa del await el boton ya esta deshabilitado y no
  // puede emitir mas clicks.
  busy = true;
  statusMessage = "";
  renderUI();

  try {
    cameraStream = await startCamera();
    renderUI(); // el stream ya esta vivo, pero aun no sabemos su resolucion
    await waitForVideoMetadata(videoElement);
    canvasElement.width = 640;
    canvasElement.height = Math.round((videoElement.videoHeight * 640) / videoElement.videoWidth);
    rafId = requestAnimationFrame(tick);
    statusMessage = `canvas tick ${rafId}`;
  } catch (error) {
    // Aqui SI capturamos, porque aqui si podemos hacer algo: mostrarselo al
    // usuario. En camera.ts no habia nada util que hacer con el error.
    statusMessage = describeCameraError(error);
  } finally {
    // `finally` corre haya ido bien o mal. Si solo rehabilitaramos el boton al
    // final del `try`, un permiso denegado lo dejaria muerto para siempre.
    busy = false;
    renderUI();
  }
});








// Primer pintado: sincroniza el HTML inicial con el estado real (apagada).
renderUI();
