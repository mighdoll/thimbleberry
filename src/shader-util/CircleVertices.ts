import { Vec2 } from "./Vec";
import { mapN, partitionBySize } from "thimbleberry/shader-util";

/** a circle with vertices between [-1,1] centered at 0,0 */
export function circleVerts(n: number): Vec2[] {
  const sliceAngle = (2 * Math.PI) / n;
  let angle = sliceAngle;
  const vertices = [...mapN(n)].map(() => {
    const vec: Vec2 = [Math.sin(angle), Math.cos(angle)];
    angle += sliceAngle;
    return vec;
  });

  return vertices;
}

/** @returns a triangle strip for a circle with with vertices between [-1,1] centered at 0,0
 * @param numCircleVerts the number of verticies on the circumference 
 */
export function circleStrip(numCircleVerts: number): Vec2[] {
  const center: Vec2 = [0, 0];
  const circle = circleVerts(numCircleVerts);
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
