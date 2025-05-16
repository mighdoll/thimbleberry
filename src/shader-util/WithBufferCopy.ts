import { Sliceable } from "./Sliceable";

export type GPUElementFormat = "f32" | "u8" | "u32" | "u64" | "i32" | "i8";

// prettier-ignore
/** built-in WGSL types that can be array element types */
export type WgslElementType = 
  | "f32" | "u8" | "u32" | "u64" | "i32" | "i8"
  | "mat2x2f" | "mat2x3f" | "mat2x4f"
  | "mat3x2f" | "mat3x3f" | "mat3x4f"
  | "mat4x2f" | "mat4x3f" |"mat4x4f"
  | "mat2x2h" | "mat2x3h" | "mat2x4h"
  | "mat3x2h" | "mat3x3h" | "mat3x4h"
  | "mat4x2h" | "mat4x3h" |"mat4x4h" 
  | "vec2f" | "vec3f" | "vec4f"
  | "vec2h" | "vec3h" | "vec4h"
  | "vec2i" | "vec3i" | "vec4i"
  | "vec2u" | "vec3u" | "vec4u"
  | "vec2h" | "vec3h" | "vec4h"
;

/** Run a function on the CPU over the copied contents of a gpu buffer.
 *
 * Note that it's normally required to copy a buffer to read it on the CPU
 * because per spec a MAP_READ buffer cannot be a STORAGE buffer.
 */
export async function withBufferCopy<T>(
  device: GPUDevice,
  buffer: GPUBuffer,
  fmt: GPUElementFormat,
  fn: (data: Sliceable<number>) => T
): Promise<T> {
  const size = buffer.size;
  const copy = device.createBuffer({
    size,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  const commands = device.createCommandEncoder({});
  commands.copyBufferToBuffer(buffer, 0, copy, 0, size);
  const cmdBuffer = commands.finish();
  device.queue.submit([cmdBuffer]);
  await copy.mapAsync(GPUMapMode.READ);
  const cpuCopy = arrayForType(fmt, copy.getMappedRange());

  try {
    return fn(cpuCopy);
  } finally {
    copy.unmap();
    copy.destroy();
  }
}

/** Copy a GPU buffer to an array of numbers on the CPU */
export async function copyBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  fmt: GPUElementFormat = "u32"
): Promise<number[]> {
  return withBufferCopy(device, buffer, fmt, d => [...d]);
}

/** console.log the contents of gpu buffer */
export async function printBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  fmt: "f32" | "u8" | "u32" | "i32" | "i8" = "f32",
  prefix?: string,
  precision?: number
): Promise<void> {
  await withBufferCopy(device, buffer, fmt, data => {
    if (buffer.label) console.log(`${prefix || ""}${buffer.label}:`);
    let stringData: string[];
    if (precision) {
      stringData = [...data].map(d => d.toPrecision(precision));
    } else {
      stringData = [...data].map(d => d.toString());
    }
    console.log("  ", stringData.join(" "));
  });
}

/** return the TypedArray for a gpu element format
 * (helpful if you want to map the gpu buffer to a ) */
export function arrayForType(
  type: "f32" | "u8" | "u32" | "u64" | "i32" | "i8",
  data: ArrayBuffer
): Float32Array | Uint8Array | Uint32Array | Int32Array | Int8Array {
  switch (type) {
    case "f32":
      return new Float32Array(data);
    case "u8":
      return new Uint8Array(data);
    case "u64":
    case "u32":
      return new Uint32Array(data);
    case "i32":
      return new Int32Array(data);
    case "i8":
      return new Int8Array(data);
  }

/** @return number of bytes per element in an array, including alignment padding */
export function elementStride(fmt: WgslElementType): number {
  let numSlots: number;
  let elemSize: number;
  if (fmt.startsWith("vec")) {
    elemSize = suffixTypeBytes(fmt.slice(-1));
    const size = fmt[3];
    if (size === "2") {
      numSlots = 2;
    } else if (size === "3" || size === "4") {
      numSlots = 4;
    } else throw new Error(`Unknown vector size: ${fmt}`);
  } else if (fmt.startsWith("mat")) {
    elemSize = suffixTypeBytes(fmt.slice(-1));
    const matSize = fmt.slice(3, 6);
    if (matSize === "2x2") {
      numSlots = 4;
    } else if (
      matSize === "2x3" ||
      matSize === "3x2" ||
      matSize === "2x4" ||
      matSize === "4x2"
    ) {
      numSlots = 8;
    } else if (matSize === "3x3" || matSize === "3x4" || matSize === "4x3") {
      numSlots = 12;
    } else if (matSize === "4x4") {
      numSlots = 16;
    } else throw new Error(`Unknown matrix size: ${fmt}`);
  } else {
    numSlots = 1;
    const found = fmt.match(/\d+/);
    const bits = Number.parseInt(found?.[0] as string);
    elemSize = bits / 8;
  }

  return elemSize * numSlots;
}

/** number of bytes per element by suffix, e.g. in a vec3h it's 2 bytes for f16 elements */
function suffixTypeBytes(suffix: string): number {
  switch (suffix) {
    case "f":
    case "u":
    case "i":
      return 4;
    case "h":
      return 2;
    default:
      throw new Error(`Unknown suffix: ${suffix}`);
  }
}
