import { memoizeWithDevice } from "./CacheKeyWithDevice";
import { filledGPUBuffer } from "./FilledGPUBuffer";
import { fullFrameTriangleStrip } from "./FullFrameTriangles";
import { trackUse } from "./TrackUse";

interface FullFrameVertBufferParams {
  device: GPUDevice;
}

/** buffer containing a triangle strip that covers the entire canvas */
export const fullFrameVertexBuffer = memoizeWithDevice(createFrameVertexBuffer);

function createFrameVertexBuffer(params: FullFrameVertBufferParams): GPUBuffer {
  const { device } = params;
  const verts = fullFrameTriangleStrip.flat();
  const usage = GPUBufferUsage.VERTEX;

  const buffer = filledGPUBuffer(device, verts, usage, "full-screen-verts", Float32Array);
  trackUse(buffer);
  return buffer;
}
