/**
 * PHASE 2B: group ink pixels into connected regions and walk their borders.
 *
 * Takes the binary image and FILLS `labels`: every blob gets a distinct
 * number, background stays 0. Returns, for each blob big enough to matter,
 * its ordered outer border and its area.
 *
 * `labels` and `stack` are allocated and passed in by the caller (main.ts),
 * which is the one that knows the image size. This module keeps no state.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Contour {
  /** Border pixels, clockwise, one per pixel. */
  points: Point[];
  /** Number of pixels of the whole region. */
  area: number;
}

// The 8 neighbors, clockwise. On screen `y` grows DOWNWARDS, so "down" is +1.
//          E   SE  S   SW  W   NW  N   NE
const DX = [ 1,  1,  0, -1, -1, -1,  0,  1];
const DY = [ 0,  1,  1,  1,  0, -1, -1, -1];

/** Index in DX/DY of a one-step offset. Throws on anything else. */
function directionIndex(dx: number, dy: number): number {
  for (let i = 0; i < 8; i++) {
    if (DX[i] === dx && DY[i] === dy) return i;
  }
  throw new Error(`Not a neighbor offset: (${dx}, ${dy})`);
}

/**
 * Moore neighbor tracing: walks the outer border of the region `label`
 * starting at pixel `start`, clockwise, until it gets back to `start`.
 *
 * Two pixels move together: the current border pixel `p` and a support
 * pixel `b` that is ALWAYS background. At each step the 8 neighbors of `p`
 * are checked clockwise starting right after `b`; the first one inside the
 * region is the next `p`, and the last background pixel checked becomes the
 * new `b`.
 */
function traceBorder(
  labels: Int32Array,
  width: number,
  height: number,
  start: number,
  label: number,
  area: number,
): Point[] {
  let px = start % width;
  let py = (start - px) / width;
  const points: Point[] = [{ x: px, y: py }];

  const inRegion = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && labels[y * width + x] === label;

  // Initial support: the raster scan guarantees the West neighbor of the
  // start pixel is background (it would have been found first otherwise).
  let bx = px - 1;
  let by = py;

  // Safety cap. A region of `area` pixels cannot have a longer border; this
  // also covers the known failure of the "back to start" stopping rule on
  // some 1-pixel-wide shapes.
  const maxSteps = area * 2 + 8;

  for (let steps = 0; steps < maxSteps; steps++) {
    let d = directionIndex(bx - px, by - py); // where the support pixel is
    let found = false;

    for (let k = 0; k < 8; k++) {
      d = (d + 1) % 8; // next neighbor, clockwise
      const nx = px + DX[d];
      const ny = py + DY[d];

      if (inRegion(nx, ny)) {
        // New support: the last background pixel checked, one step back
        // (counter-clockwise) from the pixel just found. Computed from the
        // OLD position, before moving.
        const back = (d + 7) % 8;
        bx = px + DX[back];
        by = py + DY[back];
        px = nx;
        py = ny;
        found = true;
        break;
      }
    }

    if (!found) break; // isolated pixel: nothing to walk
    if (py * width + px === start) break; // back at the start: border closed
    points.push({ x: px, y: py });
  }

  return points;
}

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

  // Raster scan: row by row, left to right. The first pixel found of each
  // region is its top-left one, which is where the border walk starts.
  for (let p = 0; p < binary.length; p++) {
    if (binary[p] === 0 || labels[p] !== 0) continue; // background, or already labeled

    // Flood fill: label every pixel connected to `p`. Pixels are labeled
    // when PUSHED, not when popped, so no pixel enters the stack twice.
    const label = nextLabel++;
    let stackSize = 0;
    let area = 0;

    stack[stackSize++] = p;
    labels[p] = label;

    while (stackSize > 0) {
      const pos = stack[--stackSize];
      area++;
      const x = pos % width;
      const y = (pos - x) / width;

      for (let i = 0; i < 8; i++) {
        const nx = x + DX[i];
        const ny = y + DY[i];
        // Bounds check BEFORE computing the index: otherwise a neighbor past
        // the right edge wraps around to the next row.
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

        const n = ny * width + nx;
        if (binary[n] === 1 && labels[n] === 0) {
          labels[n] = label;
          stack[stackSize++] = n;
        }
      }
    }

    // Filter by size BEFORE tracing: most regions are sensor noise of a few
    // pixels, and walking their borders would be wasted work.
    if (area < minArea || area > maxArea) continue;

    contours.push({
      points: traceBorder(labels, width, height, p, label, area),
      area,
    });
  }

  return contours;
}
