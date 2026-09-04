/**
 * Maquinaria de camara: todo el camino desde el hardware hasta tener pixeles
 * legibles. Eso incluye el elemento <video>, que no es interfaz de usuario
 * sino un decodificador y un buffer de frames.
 *
 * Lo que este modulo NO hace: tocar la UI (botones, textos, mensajes) ni
 * capturar errores. De eso se encarga quien tiene la pantalla.
 */

/**
 * Pide la camara al navegador.
 *
 * Sin try/catch a proposito: si el usuario deniega el permiso, la promesa se
 * rechaza y ese rechazo sube hasta quien llamo, que es el unico que puede
 * explicarselo al usuario.
 */
export const startCamera = (): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({ video: true, audio: false });

/**
 * Apaga la camara.
 *
 * Un MediaStream no tiene "off": es un contenedor de pistas, y `stream.active`
 * es solo el termometro que reporta si queda alguna viva. El interruptor real
 * esta en cada pista, y `track.stop()` es irreversible.
 */
export const stopCamera = (stream: MediaStream): void => {
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

/**
 * Espera a que el <video> sepa sus dimensiones.
 *
 * EL PROBLEMA: asignar `srcObject` retorna al instante, pero durante unos
 * milisegundos el navegador aun no sabe el formato del video y `videoWidth`
 * vale 0. Dimensionar un canvas en ese momento lo deja de 0x0 pixeles, y
 * `drawImage` no dibuja nada SIN DAR NINGUN ERROR. Fallo silencioso, el peor.
 *
 * IMPORTANTE: llamar a esto DESPUES de asignar `video.srcObject`. Un <video>
 * sin fuente no recibe datos, no emite el evento, y la espera no termina nunca.
 */
export function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  // El guardian de la carrera: si los metadatos YA llegaron, el evento
  // `loadedmetadata` ocurrio en el pasado y no se repite. Suscribirse ahora
  // seria esperar para siempre. Por eso se comprueba el estado ACTUAL primero.
  //
  // HAVE_METADATA es la constante 1 de la escala de readyState:
  //   0 HAVE_NOTHING  1 HAVE_METADATA  2 HAVE_CURRENT_DATA
  //   3 HAVE_FUTURE_DATA  4 HAVE_ENOUGH_DATA
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }

  // El patron para convertir un evento en algo que se pueda `await`.
  return new Promise<void>((resolve) => {
    // `{ once: true }` auto-elimina el listener al dispararse. Sin eso, cada
    // encendido acumularia un listener mas: la misma clase de fuga que el
    // stream huerfano de hace unos mensajes.
    //
    // Se envuelve en `() => resolve()` en vez de pasar `resolve` directamente
    // porque el listener recibe el objeto Event como argumento, y esta promesa
    // es Promise<void>: no queremos colar ese Event como valor resuelto.
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
  });
}
