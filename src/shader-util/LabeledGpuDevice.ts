let deviceId = 0;

/** Return a gpu device with a unique label.
 *
 * It's useful to have a unique id when including the serialized GPUDevice
 * as part of a cache key e.g. for tests when multiple devices are used
 * in the browser session.
 */
export async function labeledGpuDevice(
  descriptor?: GPUDeviceDescriptor
): Promise<GPUDevice> {
  const adapter = await navigator.gpu.requestAdapter();
  return adapter!.requestDevice({ label: `device-${deviceId++}`, ...descriptor });
}
