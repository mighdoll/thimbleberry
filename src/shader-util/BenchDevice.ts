/** 
 * Return a GPUDevice for benchmarking with limits expanded where possible 
 * and timestamp-query enabled for collecting timing reports from the GPU.
*/
export async function benchDevice(label = ""): Promise<GPUDevice> {
  const adapter = (await navigator.gpu.requestAdapter())!;
  const {
    maxBufferSize,
    maxStorageBufferBindingSize,
    maxComputeWorkgroupSizeX,
    maxComputeWorkgroupSizeY,
    maxComputeWorkgroupSizeZ,
    maxComputeInvocationsPerWorkgroup, 
  } = adapter.limits;
  const requiredLimits = {
    maxBufferSize,
    maxStorageBufferBindingSize,

    // suprisingly, larger workgroups seems to be slower on Mac M1Max

    maxComputeWorkgroupSizeX,
    maxComputeWorkgroupSizeY,
    maxComputeWorkgroupSizeZ,
    maxComputeInvocationsPerWorkgroup,
  };

  const requiredFeatures: Iterable<GPUFeatureName> = ["timestamp-query"];

  return adapter.requestDevice({
    label: `${label} bench`,
    requiredLimits,
    requiredFeatures,
  });
}
