import { mapN, partitionBySize } from "thimbleberry/shader-util";
import { Vec2 } from "./Vec";

/** a circle with vertices between [-1,1] centered at 0,0 */
export function circleVerts(n: number): Vec2[] {
  const numVerts = Math.ceil(n);
  const sliceAngle = (2 * Math.PI) / numVerts;
  let angle = sliceAngle;
  const vertices = [...mapN(numVerts)].map(() => {
    const vec: Vec2 = [Math.sin(angle), Math.cos(angle)];
    angle += sliceAngle;
    return vec;
  });

  return vertices;
}

/** @returns a triangle strip for a circle with with vertices between [-1,1] centered at 0,0 */
export function circleStrip(radius: number): Vec2[] {
  const e = 0.4; // target error in pixels from ideal curve
  const r = radius;
  const proposedVerts = Math.ceil(Math.PI / Math.acos(1 - e / r));
  const numVerts = Math.max(proposedVerts, 6);

  const center: Vec2 = [0, 0];
  const circle = circleVerts(numVerts);
  const verts = [...partitionBySize(circle, 2)].flatMap(([a, b]) => {
    if (b !== undefined) {
      return [center, a, b];
    } else {
      return [center, a];
    }
  });
  verts.push(center, circle[0]);
  return verts;
}
