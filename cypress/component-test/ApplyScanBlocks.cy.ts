import {
  labeledGpuDevice, ShaderGroup, trackRelease,
  trackUse,
  withAsyncUsage, withBufferCopy, withLeakTrack
} from "thimbleberry/shader-util";
import { ApplyScanBlocksShader } from "thimbleberry/shaders";
import { makeBuffer } from "./util/MakeBuffer";
import { prefixSum } from "./util/PrefixSum";

it("apply scan blocks to partial prefix scan", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const origSrc = [0, 1, 2, 3, 4, 5, 6, 7];
    const prefixesSrc = [0, 1, 3, 6, 4, 9, 15, 22];
    const partialScan = makeBuffer(device, prefixesSrc, "prefixes", Uint32Array);

    const blockSumsSrc = [6, 28];
    const blockSums = makeBuffer(device, blockSumsSrc, "blockSums", Uint32Array);

    await withLeakTrack(async () => {
      const applyBlocks = new ApplyScanBlocksShader({
        device,
        partialScan,
        blockSums,
        workgroupLength: 4,
      });
      trackUse(applyBlocks);
      const shaderGroup = new ShaderGroup(device, applyBlocks);
      shaderGroup.dispatch();

      await withBufferCopy(device, applyBlocks.prefixScan, "u32", (data) => {
        const expected = prefixSum(origSrc);
        expect([...data]).to.deep.equal(expected);
      });
      trackRelease(applyBlocks);
    });
  });
});
