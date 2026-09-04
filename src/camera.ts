/**
 * Acceso a la camara. Este modulo NO sabe que existe una interfaz de usuario:
 * no toca el DOM, no pinta mensajes y no captura errores. Solo habla con la
 * API del navegador.
 */

/**
 * Pide la camara al navegador.
 *
 * No hay try/catch a proposito. Si el usuario deniega el permiso, la promesa
 * se rechaza y ese rechazo sube hasta quien llamo, que es el unico que tiene
 * UI para explicarselo al usuario.
 *
 * El tipo de retorno ya no lleva `| null`: no existe ningun camino por el que
 * esta funcion devuelva null. Un tipo que no miente.
 */
export const startCamera = (): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({ video: true, audio: false });

/**
 * Apaga la camara.
 *
 * Un MediaStream no tiene "off": es un contenedor de pistas, y `stream.active`
 * es solo el termometro que reporta si queda alguna viva. El interruptor real
 * esta en cada pista.
 *
 * Recibe `MediaStream` (no `MediaStream | null`) porque quien es dueno del
 * estado es quien debe comprobar si hay algo que apagar. Esta funcion no puede
 * poner a null la variable de quien la llama, asi que tampoco finge poder.
 */
export const stopCamera = (stream: MediaStream): void => {
  for (const track of stream.getTracks()) {
    track.stop();
  }
};
