/** @return a compute workgroup length based on a proposed length
 * and the maximum length supported by the device */
export function limitWorkgroupLength(device: GPUDevice, proposedLength?: number): number {
  const maxThreads = device.limits.maxComputeInvocationsPerWorkgroup;
  let length: number;
  if (!proposedLength || proposedLength > maxThreads) {
    length = maxThreads;
  } else {
    length = proposedLength;
  }
  return length;
}
