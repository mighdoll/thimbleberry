export interface ConstructArray {
  new (array: ArrayLike<number> | ArrayBufferLike): HasSet;
  BYTES_PER_ELEMENT: number;
}
export interface HasSet {
  set(array: ArrayLike<number>, offset?: number): void;
}

/** create a gpu buffer filled with data */
export function filledGPUBuffer(
  device: GPUDevice,
  data: number[],
  usage: GPUBufferUsageFlags = GPUBufferUsage.COPY_SRC |
    GPUBufferUsage.COPY_DST |
    GPUBufferUsage.STORAGE,
  label?: string,
  ArrayConstructor: ConstructArray = Float32Array
): GPUBuffer {
  const buffer = device.createBuffer({
    label,
    size: data.length * ArrayConstructor.BYTES_PER_ELEMENT,
    usage,
    mappedAtCreation: true,
  });
  new ArrayConstructor(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}

/** create a gpu buffer with integer data (handy for testing) */
export function bufferI32(
  device: GPUDevice,
  data: number[],
  label = "bufferI32"
): GPUBuffer {
  return filledGPUBuffer(
    device,
    data,
    GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    label,
    Int32Array
  );
}

/** create a gpu buffer with unsigned integer data (handy for testing) */
export function bufferU32(
  device: GPUDevice,
  data: number[],
  label = "bufferU32"
): GPUBuffer {
  return filledGPUBuffer(
    device,
    data,
    GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    label,
    Uint32Array
  );
}

/** create a gpu buffer with float data (handy for testing) */
export function bufferF32(
  device: GPUDevice,
  data: number[],
  label = "bufferF32"
): GPUBuffer {
  return filledGPUBuffer(
    device,
    data,
    GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    label,
    Float32Array
  );
}