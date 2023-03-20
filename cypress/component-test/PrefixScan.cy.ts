import { labeledGpuDevice } from "thimbleberry/shader-util";
import {
  trackRelease,
  trackUse,
  withAsyncUsage,
  withLeakTrack,
} from "thimbleberry/shader-util";
import { ShaderGroup } from "thimbleberry/shader-util";
import { PrefixScanShader } from "thimbleberry/shaders";
import { makeBuffer } from "./util/MakeBuffer";
import { withBufferCopy } from "thimbleberry/shader-util";

it("workgroup scan one evenly sized buffer", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();

    const srcData = [0, 1, 2, 3, 4, 5, 6, 7];
    await withLeakTrack(async () => {
      const scan = new PrefixScanShader({
        device,
        source: makeBuffer(device, srcData, "source", Uint32Array),
        emitBlockSums: true,
        workgroupLength: 8,
      });
      trackUse(scan);
      const shaderGroup = new ShaderGroup(device, scan);
      shaderGroup.dispatch();

      await withBufferCopy(device, scan.prefixScan, "u32", (data) => {
        expect([...data]).to.deep.equal([0, 1, 3, 6, 10, 15, 21, 28]);
      });
      await withBufferCopy(device, scan.blockSums, "u32", (data) => {
        expect([...data]).to.deep.equal([28]);
      });
      trackRelease(scan);
    });
  });
});

it("workgroup scan one evenly sized buffer, two workgroups", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();

    const srcData = [0, 1, 2, 3, 4, 5, 6, 7];
    const scan = new PrefixScanShader({
      device,
      source: makeBuffer(device, srcData, "source", Uint32Array),
      emitBlockSums: true,
      workgroupLength: 4,
    });
    const shaderGroup = new ShaderGroup(device, scan);
    shaderGroup.dispatch();

    await withBufferCopy(device, scan.blockSums, "u32", (data) => {
      expect([...data]).to.deep.equal([6, 22]);
    });
  });
});

it("workgroup scan one unevenly sized buffer", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();

    const srcData = [0, 1, 2, 3, 4, 5, 6];
    const scan = new PrefixScanShader({
      device,
      source: makeBuffer(device, srcData, "source", Uint32Array),
      emitBlockSums: true,
      workgroupLength: 8,
    });
    const shaderGroup = new ShaderGroup(device, scan);
    shaderGroup.dispatch();

    await withBufferCopy(device, scan.prefixScan, "u32", (data) => {
      expect([...data]).to.deep.equal([0, 1, 3, 6, 10, 15, 21]);
    });
    await withBufferCopy(device, scan.blockSums, "u32", (data) => {
      expect([...data]).to.deep.equal([21]);
    });
  });
});

it("workgroup scan one unevenly sized buffer, two workgroups", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();

    const srcData = [0, 1, 2, 3, 4, 5, 6];
    const scan = new PrefixScanShader({
      device,
      source: makeBuffer(device, srcData, "source", Uint32Array),
      emitBlockSums: true,
      workgroupLength: 4,
    });
    const shaderGroup = new ShaderGroup(device, scan);
    shaderGroup.dispatch();

    await withBufferCopy(device, scan.prefixScan, "u32", (data) => {
      expect([...data]).to.deep.equal([0, 1, 3, 6, 4, 9, 15]);
    });
    await withBufferCopy(device, scan.blockSums, "u32", (data) => {
      expect([...data]).to.deep.equal([6, 15]);
    });
  });
});
