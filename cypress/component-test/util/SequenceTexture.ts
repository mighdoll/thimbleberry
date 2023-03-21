import {
  arrayToBuffer,
  componentByteSize,
  numComponents,
  Vec2,
} from "thimbleberry/shader-util";
import { mapN } from "../../../src/shader-util/MapN";

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
  const texture = device.createTexture({
    size,
    format,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST| GPUTextureUsage.COPY_SRC, // prettier-ignore
  });
  const components = numComponents(format);
  const bytesPerComponent = componentByteSize(format);
  const rawData = mapN(size[0] * size[1] * components, (i) => step * i);
  const data = arrayToBuffer(format, rawData);
  device.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: size[0] * bytesPerComponent * components },
    size
  );
  const sum = [...data].reduce((a, b) => a + b, 0);
  return { texture, sum, data: rawData };
}
