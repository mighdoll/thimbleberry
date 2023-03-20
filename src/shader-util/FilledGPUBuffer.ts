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
  usage: GPUBufferUsageFlags,
  label?: string,
  ArrayConstructor: ConstructArray = Float32Array
): GPUBuffer {
  const buffer = device.createBuffer({
    label,
    size: data.length * ArrayConstructor.BYTES_PER_ELEMENT,
    usage,
    mappedAtCreation: true
  });
  new ArrayConstructor(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}
