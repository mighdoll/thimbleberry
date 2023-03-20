export function createDebugBuffer(
  device: GPUDevice,
  label = "debugBuffer",
  size = 16
): GPUBuffer {
  return device.createBuffer({
    label,
    size: size * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });
}
