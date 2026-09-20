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
interface Area {
  x: number;
  y: number;
  label: number;
}

const DX = [ 1,  1,  0, -1, -1, -1,  0,  1];
const DY = [ 0,  1,  1,  1,  0, -1, -1, -1];


export function labelRegions(
  binary: Uint8Array,
  width: number,
  height: number,
  labels: Int32Array,
  stack: Int32Array,
): number {
  labels.fill(0);
  let nextLabel = 1; 
  let areas: Area[] = [];
  // EL BARRIDO
  for (let p = 0; p <= binary.length-1; p++) {
    // TODO: si no es tinta, o ya tiene etiqueta, saltar al siguiente
    if(binary[p] === 0 || labels[p] !== 0){
        continue;
    }
    const label = nextLabel++;
    let stackSize = 0;

    stack[stackSize++] = p;
    labels[p] = label;

    //console.log(labels);
    //console.log(stackSize, stack);
    while(stackSize > 0){
        let pos = stack[--stackSize];
        let xPos = pos % width;
        let yPos = (pos - xPos) / width;
        //console.log(xPos, yPos, pos);
        for(let i = 0; i <= DX.length-1; i++){
            const nx = xPos + DX[i];
            const ny = yPos + DY[i];
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                //console.log('descartamos vecinos fuera de rango');
                continue;
            }
            const n = ny * width + nx;
            if(binary[n] === 1 && labels[n] === 0){
                labels[n] = label;
                stack[stackSize++] = n;
            }
        }

    }
    //console.log('salimos del while');
  }
  //console.log('justo antes del return', labels);
  return nextLabel - 1;    // cuantas etiquetas se han repartido
}
