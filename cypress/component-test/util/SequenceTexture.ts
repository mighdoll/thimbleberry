import {
  make2dSequence,
  makeTexture,
  Vec2
} from "thimbleberry/shader-util";

interface SequenceTexture {
  texture: GPUTexture;
  sum: number;
  data: number[];
}

/** @return a test texture containing an ascending sequence of values
 *
 * e.g. [0, 1, 2,
 *       3, 4, 5,
 *       6, 7, 8]
 */
export function sequenceTexture(
  device: GPUDevice,
  size: Vec2,
  format: GPUTextureFormat = "r32float",
  step = 1
): SequenceTexture {
  // LATER now unsupported, but I think this util is going away.
  // 
  // const components = numComponents(format);
  // const bytesPerComponent = componentByteSize(format);
  const rawData = make2dSequence(size, step);
  const texture = makeTexture(device, rawData, format);

  const sum = [...rawData.flat()].reduce((a, b) => a + b, 0);
  return { texture, sum, data: rawData.flat() };
}
