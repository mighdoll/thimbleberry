import { ConstructArray, filledGPUBuffer } from "thimbleberry/shader-util";

/** create a gpu buffer filled with data for tests */
export function makeBuffer(
  device: GPUDevice,
  data: number[],
  label?: string,
  arrayConstructor: ConstructArray = Float32Array
): GPUBuffer {
  return filledGPUBuffer(
    device,
    data,
    GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    label,
    arrayConstructor
  );
}
