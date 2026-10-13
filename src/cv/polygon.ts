/**
 * PHASE 2C: from a contour of hundreds of border points to a polygon of a
 * few vertices.
 */
import type { Point } from "./contour";

/**
 * Distance from `p` to the SEGMENT a-b, not to the infinite line through
 * them. A point past one of the ends measures against that end.
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;

  // A zero-length segment IS a point, and the distance to a point is well
  // defined; the formula below just cannot express it, because it would
  // divide by zero and return NaN (which no comparison ever catches).
  if (length2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  // Where p projects onto the line, as a fraction of the segment: 0 is a,
  // 1 is b. Clamping to [0,1] is what turns "distance to the line" into
  // "distance to the segment".
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2;
  t = Math.max(0, Math.min(1, t));

  const qx = a.x + t * dx;
  const qy = a.y + t * dy;
  return Math.hypot(p.x - qx, p.y - qy);
}

/**
 * Index of the point farthest from `points[0]`.
 *
 * This is where the contour gets cut in two. Douglas-Peucker needs an open
 * polyline (a first point and a last one) and a contour is a closed ring,
 * so it has to be split; cutting at the farthest point is safe because it
 * always lands on a corner. Walking along a straight side, the distance to
 * a fixed point keeps growing until the side ends, so the maximum can only
 * happen where a side ends.
 *
 * Compares SQUARED distances. The square root does not change which one is
 * biggest, and this runs once per border point of every contour.
 */
export function farthestIndex(points: Point[]): number {
  let far = 0;
  let maxDistance2 = -1;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[0].x;
    const dy = points[i].y - points[0].y;
    const distance2 = dx * dx + dy * dy;

    if (distance2 > maxDistance2) {
      maxDistance2 = distance2;
      far = i;
    }
  }

  return far;
}
