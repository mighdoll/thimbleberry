import { Float16Array, setFloat16 } from "@petamoriken/float16";
import { Sliceable } from "./Sliceable";

export type SampledTextureType2D =
  | "texture_external"
  | "texture_2d<f32>"
  | "texture_2d<u32>"
  | "texture_2d<i32>";

export function componentByteSize(format: GPUTextureFormat): number {
  if (format.includes("32")) {
    return 4;
  }
  if (format.includes("16")) {
    return 2;
  }
  if (format.includes("8")) {
    return 1;
  }
  throw new Error(`Unknown texture format ${format}`);
}

export function numComponents(format: GPUTextureFormat): number {
  if (format.startsWith("bgra")) {
    return 4;
  }
  if (format.startsWith("rgba")) {
    return 4;
  }
  if (format.startsWith("rg")) {
    return 2;
  }
  if (format.startsWith("r")) {
    return 1;
  }
  throw new Error(`Unknown texture format ${format}`);
}

/** copy an ArrayBuffer from the gpu to an array format suitable for reading on the cpu */
export function bufferToSliceable(
  format: GPUTextureFormat,
  data: Uint8Array
): Sliceable<number> {
  const converted = gpuArrayFormat(format, data.buffer);
  if (converted) {
    return converted;
  }
  switch (format) {
    case "r16float":
    case "rg16float":
    case "rgba16float":
      return new Float16Array(data.buffer);
    // TODO support other texture types
    default:
      throw new Error(`Unknown texture format ${format}`);
  }
}

/** copy an array of numbers to packed ArrayBuffer suitable for sending to the gpu */
export function arrayToArrayBuffer(
  format: GPUTextureFormat,
  data: number[]
): ArrayBuffer & Sliceable<number> & HasArrayBuffer {
  const converted = gpuArrayFormat(format, data);
  if (converted) {
    return converted;
  }
  switch (format) {
    case "r16float":
    case "rg16float":
    case "rgba16float":
      return floatsToUint16Array(data);
    // TODO support other texture types
    default:
      throw new Error(`Unknown texture format ${format}`);
  }
}

interface HasArrayBuffer {
  buffer: ArrayBuffer;
}

/** Return a typed array for the appropriate gpu format type
 *
 * 16 bit float formats are not handled here: 16 bit floats are handled differently for
 * reading or writing from the gpu.
 */
function gpuArrayFormat(
  format: GPUTextureFormat,
  data: number[] | ArrayBuffer
): (ArrayBuffer & Sliceable<number> & HasArrayBuffer) | undefined {
  switch (format) {
    case "r8uint":
    case "rg8uint":
    case "rgba8uint":
    case "rgba8unorm":
    case "rgba8unorm-srgb":
    case "rgba8snorm":
    case "bgra8unorm":
    case "bgra8unorm-srgb":
    case "r8unorm":
    case "r8snorm":
      return new Uint8Array(data);

    case "r8sint":
    case "rg8sint":
    case "rgba8sint":
      return new Int8Array(data);

    case "r16uint":
    case "rg16uint":
    case "rgba16uint":
      return new Uint16Array(data);

    case "r16sint":
    case "rg16sint":
    case "rgba16sint":
      return new Int16Array(data);

    case "r32uint":
    case "rg32uint":
    case "rgba32uint":
      return new Uint32Array(data);

    case "r32sint":
    case "rg32sint":
    case "rgba32sint":
      return new Int32Array(data);

    case "r32float":
    case "rg32float":
    case "rgba32float":
      return new Float32Array(data);

    default:
      return undefined;
  }
}

/** return the sampling type for texture binding a certain  */
export function textureSampleType(
  format: GPUTextureFormat,
  float32Filterable = false
): GPUTextureSampleType {
  if (format.includes("32float")) {
    return float32Filterable ? "float" : "unfilterable-float";
  }
  if (format.includes("float") || format.includes("unorm")) {
    return "float";
  }
  if (format.includes("uint")) {
    return "uint";
  }
  if (format.includes("sint")) {
    return "sint";
  }
  throw new Error(`native sample type unknwon for for texture format ${format}`);
}

export function storageBindable(format: GPUTextureFormat): boolean {
  switch (format) {
    case "rgba8unorm":
    case "rgba8snorm":
    case "rgba8uint":
    case "rgba8sint":
    case "rgba16uint":
    case "rgba16sint":
    case "r32uint":
    case "r32sint":
    case "r32float":
    case "rg32uint":
    case "rg32sint":
    case "rg32float":
    case "rgba32uint":
    case "rgba32sint":
    case "rgba32float":
      return true;

    case "r8unorm":
    case "r8uint":
    case "r8snorm":
    case "rg8uint":
    case "rg8unorm":
    case "rgba8unorm-srgb":
    case "bgra8unorm": // ok, if bgra8unorm-storage is enabled
    case "bgra8unorm-srgb":
    case "r8sint":
    case "rg8sint":
    case "r16uint":
    case "r16sint":
    case "r16float":
    case "rg16uint":
    case "rg16sint":
    case "rg16float":
    case "rgba16float":
    case "rgb10a2unorm":
    case "rg11b10ufloat":
    default:
      return false;
  }
}

export function renderAttachable(format: GPUTextureFormat): boolean {
  switch (format) {
    case "r8unorm":
    case "r8uint":
    case "r8sint":
    case "rg8unorm":
    case "rg8uint":
    case "rg8sint":
    case "rgba8unorm":
    case "rgba8unorm-srgb":
    case "rgba8uint":
    case "rgba8sint":
    case "bgra8unorm":
    case "bgra8unorm-srgb":
    case "r16uint":
    case "r16sint":
    case "r16float":
    case "rg16uint":
    case "rg16sint":
    case "rg16float":
    case "rgba16uint":
    case "rgba16sint":
    case "rgba16float":
    case "r32uint":
    case "r32sint":
    case "r32float":
    case "rg32uint":
    case "rg32sint":
    case "rg32float":
    case "rgba32uint":
    case "rgba32sint":
    case "rgba32float":
    case "rgb10a2unorm":
      return true;

    case "r8snorm":
    case "rg8snorm":
    case "rgba8snorm":
    case "rg11b10ufloat": // ok, if "rg11b10ufloat-renderable" is enabled
    default:
      return false;
  }
}

/** convert src data to fp16 floats */
export function floatsToUint16Array(data: number[]): Uint16Array {
  const out = new Uint16Array(data.length);
  const toFP16 = fp16Converter();
  data.forEach((n, i) => {
    const twoBytes = toFP16(n);
    out.set([twoBytes], i);
  });
  return out;
}

/** return the element type for wgsl textureLoad() results */
export function texelLoadType(format: GPUTextureFormat): "f32" | "u32" | "i32" {
  if (format.includes("float")) return "f32";
  if (format.includes("unorm")) return "f32";
  if (format.includes("uint")) return "u32";
  if (format.includes("sint")) return "i32";
  throw new Error(`unknown format ${format}`);
}

/** return a function that converts numbers to their packed fp16 equivalents */
function fp16Converter(): (n: number) => number {
  const ff = new Float16Array(1);
  const ffView = new DataView(ff.buffer);
  return n => {
    setFloat16(ffView, 0, n);
    return ffView.getUint16(0, false);
  };
}
