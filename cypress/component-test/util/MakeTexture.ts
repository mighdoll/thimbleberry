import { dsert } from "berry-pretty";
import {
  arrayToArrayBuffer,
  componentByteSize,
  mapN,
  numComponents,
  renderAttachable,
  storageBindable,
  Vec2,
} from "thimbleberry/shader-util";

/** @return a test texture containing the supplied data */
export function makeTexture(
  device: GPUDevice,
  data: number[][] | number[][][],
  format: GPUTextureFormat = "r16float",
  label?: string
): GPUTexture {
  const components = numComponents(format);
  if (data[0][0] instanceof Array) {
    dsert(components === data[0][0].length, "data must match format");
  } else {
    dsert(components === 1, "data must match format");
  }
  const size = { width: data[0].length, height: data.length };
  const texture = makeEmptyTexture(device, [size.width, size.height], label, format);
  const buffer = arrayToArrayBuffer(format, data.flat(2));
  device.queue.writeTexture(
    { texture },
    buffer,
    {
      bytesPerRow: size.width * componentByteSize(format) * components,
      rowsPerImage: data.length,
    },
    size
  );
  return texture;
}

export function makeEmptyTexture(
  device: GPUDevice,
  size: Vec2,
  label?: string,
  format: GPUTextureFormat = "r16float"
): GPUTexture {
  let usage =
    GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC;
  if (renderAttachable(format)) {
    usage |= GPUTextureUsage.RENDER_ATTACHMENT;
  }
  if (storageBindable(format)) {
    usage |= GPUTextureUsage.STORAGE_BINDING;
  }
  return device.createTexture({
    label,
    size,
    format,
    usage,
  });
}

export function make2dSequence(size: Vec2): number[][] {
  const data = [];
  let i = 0;
  for (let y = 0; y < size[1]; y++) {
    const row = [];
    for (let x = 0; x < size[0]; x++) {
      row.push(i++);
    }
    data.push(row);
  }
  return data;
}

export function make3dSequence(size: Vec2, numComponents = 1): number[][][] {
  let i = 0;
  return mapN(size[0], () =>
    mapN(size[1], () => {
      const rgba = mapN(numComponents, c => i + c * 10);
      i++;
      return rgba;
    })
  );
}
