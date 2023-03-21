import { prettyFloat } from "berry-pretty";
import { filterNth, partitionBySize, Sliceable } from "./Sliceable";
import { bufferToSliceable, componentByteSize, numComponents } from "./TextureFormats";

/** console.log a GPUTexture */
export async function printTexture(
  device: GPUDevice,
  texture: GPUTexture,
  selectComponent?: number,
  precision?: number
): Promise<void> {
  const components = numComponents(texture.format);
  withTextureCopy(device, texture, data => {
    if (texture.label) console.log(`${texture.label}:`);
    const s = imageArrayToString(
      data,
      texture.height,
      components,
      selectComponent,
      precision
    );
    console.log(s);
  });
}

/** Copy a GPUTexture to the CPU and run a function on the contents */
export async function withTextureCopy<T>(
  device: GPUDevice,
  texture: GPUTexture,
  fn: (data: Sliceable<number>) => T
): Promise<T> {
  const imageTexture: GPUImageCopyTexture = {
    texture,
  };

  // create buffer, padded if necessary to 256 bytes per row
  const components = numComponents(texture.format);
  const bytesPerComponent = componentByteSize(texture.format);

  const textureByteWidth = texture.width * components * bytesPerComponent;
  const bufferByteWidth = Math.ceil(textureByteWidth / 256) * 256;
  const bufferBytes = bufferByteWidth * texture.height;

  const buffer = device.createBuffer({
    label: "textureCopy",
    size: bufferBytes,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // copy image to buffer
  const imageDestination: GPUImageCopyBuffer = {
    buffer,
    bytesPerRow: bufferByteWidth,
    rowsPerImage: texture.height,
  };
  const copySize: GPUExtent3DStrict = {
    width: texture.width,
    height: texture.height,
    depthOrArrayLayers: texture.depthOrArrayLayers,
  };
  const commands = device.createCommandEncoder({});
  commands.copyTextureToBuffer(imageTexture, imageDestination, copySize);
  const cmdBuffer = commands.finish();
  device.queue.submit([cmdBuffer]);

  // fetch buffer
  await buffer.mapAsync(GPUMapMode.READ);
  const mapped = buffer.getMappedRange();
  const cpuCopy = new Uint8Array(mapped);
  const trimmed = trimExcess(cpuCopy, bufferByteWidth, textureByteWidth);
  const data = bufferToSliceable(texture.format, trimmed);

  try {
    return fn(data);
  } finally {
    buffer.unmap();
    buffer.destroy();
  }
}

export function hexBytes(src: Sliceable<number>, maxLength = 1024): string {
  return [...src.slice(0, maxLength)].map(v => v.toString(16)).join(" ");
}

/** returns an array of bytes, trimmed to remove padding */
function trimExcess(
  bufferArray: Uint8Array,
  bytesPerRow: number, // bytes per row in buffer including padding
  imageBytesPerRow: number // bytes per row
): Uint8Array {
  const resultRows: Uint8Array[] = [];
  for (const row of partitionBySize(bufferArray, bytesPerRow)) {
    const slice = row.slice(0, imageBytesPerRow);
    resultRows.push(slice);
  }
  const byteArray = resultRows.flatMap(row => [...row]);
  return new Uint8Array(byteArray);
}

export function imageArrayToString(
  imageArray: Sliceable<number>,
  imageHeight: number,
  components: number,
  selectComponent?: number | undefined,
  precision = 3
): string {
  const rows = imageArrayToRows(imageArray, imageHeight, components, selectComponent);
  const strings = rows.map((row, i) => {
    const rowString = [...row]
      .map(s => prettyFloat(s, precision).padStart(precision))
      .join(" ");
    return `   ${i % 10}:  ${rowString}`;
  });
  return strings.join("\n");
}

export function imageArrayToRows(
  imageArray: Sliceable<number>,
  imageHeight: number,
  components: number,
  selectComponent?: number | undefined
): Sliceable<number>[] {
  const imageWidth = imageArray.length / imageHeight;
  const rows = [...partitionBySize(imageArray, imageWidth)];
  const result = rows.map(row => {
    if (selectComponent !== undefined) {
      return [...filterNth(row, selectComponent, components)];
    } else {
      return row;
    }
  });
  return result;
}
