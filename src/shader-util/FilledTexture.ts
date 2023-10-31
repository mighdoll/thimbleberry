import {
  Vec2,
  arrayToArrayBuffer,
  componentByteSize,
  mapN,
  numComponents,
  renderAttachable,
  storageBindable,
} from "thimbleberry";

/** @return a test texture containing the supplied data */
export function makeTexture(
  device: GPUDevice,
  data: number[][] | number[][][],
  format: GPUTextureFormat = "r16float",
  label?: string
): GPUTexture {
  const components = numComponents(format);

  if (data[0][0] instanceof Array) {
    console.assert(components === data[0][0].length, "data must match format");
  } else {
    console.assert(components === 1, "data must match format");
  }
  const size: Vec2 = [data[0].length, data.length];

  const arrayBuffer = arrayToArrayBuffer(format, data.flat(2));
  return textureFromArray(device, arrayBuffer, size, format, label);
}

/** @return a test texture from the supplied array buffer data */
export function textureFromArray(
  device: GPUDevice,
  data: ArrayBuffer,
  size: Vec2,
  format: GPUTextureFormat = "r16float",
  label?: string
): GPUTexture {
  const components = numComponents(format);
  const texture = makeEmptyTexture(device, size, label, format);

  device.queue.writeTexture(
    { texture },
    data,
    {
      bytesPerRow: size[0] * componentByteSize(format) * components,
      rowsPerImage: size[1],
    },
    size
  );
  return texture;
}

/** (for test fixtures) make a gpu texture */
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

/** (for test fixtures) fill a 2D array with sequential values */
export function make2dSequence(size: Vec2, step = 1): number[][] {
  const data = [];
  let i = 0;
  for (let y = 0; y < size[1]; y++) {
    const row = [];
    for (let x = 0; x < size[0]; x++) {
      row.push(i * step);
      i++;
    }
    data.push(row);
  }
  return data;
}

/** (for test fixtures) fill a 3D array with sequential values, offset by 10 for each component */
export function make3dSequence(size: Vec2, numComponents = 4): number[][][] {
  let i = 0;
  return mapN(size[0], () =>
    mapN(size[1], () => {
      const rgba = mapN(numComponents, c => i + c * 10);
      i++;
      return rgba;
    })
  );
}
