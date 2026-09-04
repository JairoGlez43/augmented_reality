import { startCamera, stopCamera } from "./camera";

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

const cameraButton = requireElement<HTMLButtonElement>("camera-button");
const statusText = requireElement<HTMLParagraphElement>("status");

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
    cameraStream = null; // la transicion de vuelta: sin esto, la variable mentiria
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
