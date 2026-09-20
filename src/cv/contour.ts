/**
 * FASE 2B: agrupar los pixeles de tinta en regiones conexas.
 *
 * Recibe la imagen binaria y RELLENA `labels`: cada mancha recibe un numero
 * distinto, el fondo se queda en 0. Devuelve cuantas manchas ha encontrado.
 *
 * `labels` y `stack` los reserva y los pasa quien llama (main.ts), porque es
 * quien conoce el tamano de la imagen. Este modulo no guarda nada.
 */

// Los 8 vecinos. En pantalla la `y` crece hacia ABAJO, asi que "abajo" es +1.
//            E   SE  S   SO  O   NO  N  NE
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

  // EL BARRIDO
  for (let p = 0; p <= binary.length-1; p++) {
    // TODO: si no es tinta, o ya tiene etiqueta, saltar al siguiente
    if(binary[p] === 0 || labels[p] !== 0){
        continue;
    }
    let label = nextLabel++;
    let stackSize = 0;

    stack[stackSize++] = p;
    labels[p] = label;

    while(stackSize>0){
        let pos = stack[--stackSize];
        let xPos = pos % width;
        let yPos = (pos - xPos) / width;
        for(let i = 0; i <= DX.length-1; i++){
            const nx = xPos + DX[i];
            const ny = yPos + DY[i];
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const n = ny * width + nx;
            if(binary[n] === 1){
                labels[n] === label;
                stack[stackSize++] = n;
            }
        }

    }

  }

  return nextLabel - 1;    // cuantas etiquetas se han repartido
}
