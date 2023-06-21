/** @return a compute workgroup length in the X dimension based on a proposed length
 * and the maximum length supported by the device */
export function limitWorkgroupLength(device: GPUDevice, proposedLength?: number): number {
  const maxThreads = Math.min(
    device.limits.maxComputeInvocationsPerWorkgroup,
    device.limits.maxComputeWorkgroupSizeX
  );
  let length: number;
  if (!proposedLength || proposedLength > maxThreads) {
    length = maxThreads;
  } else {
    length = proposedLength;
  }
  return length;
}
