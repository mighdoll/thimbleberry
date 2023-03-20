const [top, bottom] = [1, -1],
  [left, right] = [-1, 1];

export const fullFrameTriangleStrip = [
  [left, bottom],
  [left, top],
  [right, top], // upper left triangle
  [right, bottom],
  [left, bottom] // lower right triangle
];
