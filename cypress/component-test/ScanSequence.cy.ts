import {
  labeledGpuDevice,
  ShaderGroup,
  sumTemplateUnsigned,
  trackRelease,
  trackUse,
  withAsyncUsage,
  withBufferCopy,
  withLeakTrack,
} from "thimbleberry/shader-util";
import { ScanSequence } from "thimbleberry/shaders";
import { makeBuffer } from "./util/MakeBuffer";
import { prefixSum } from "./util/PrefixSum";

it("scan sequence: unevenly sized buffer, two workgroups, one level block scanning", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const srcData = [0, 1, 2, 3, 4, 5, 6];

    const scan = new ScanSequence({
      device,
      source: makeBuffer(device, srcData, "source", Uint32Array),
      reduceTemplate: sumTemplateUnsigned,
      workgroupLength: 4,
    });
    const shaderGroup = new ShaderGroup(device, scan);
    shaderGroup.dispatch();

    await withBufferCopy(device, scan.sourceScan.blockSums, "u32", (data) => {
      expect([...data]).deep.equals([6, 15]);
    });
    await withBufferCopy(device, scan.blockScans[0].prefixScan, "u32", (data) => {
      expect([...data]).deep.equals([6, 21]);
    });
    const expected = prefixSum(srcData);
    await withBufferCopy(device, scan.prefixScan, "u32", (data) => {
      expect([...data]).deep.equals(expected);
    });
  });
});

it("scan sequence: large buffer, two levels of block scanning", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const srcData = Array.from({ length: 32 })
      .fill(0)
      .map((_, i) => i);

    const scan = new ScanSequence({
      device,
      source: makeBuffer(device, srcData, "source", Uint32Array),
      reduceTemplate: sumTemplateUnsigned,
      workgroupLength: 4,
    });
    const shaderGroup = new ShaderGroup(device, scan);
    shaderGroup.dispatch();

    const expected = prefixSum(srcData);
    await withBufferCopy(device, scan.prefixScan, "u32", (data) => {
      expect([...data]).deep.equals(expected);
    });
  });
});

it("scan sequence: large buffer, three levels of block scanning", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const srcData = Array.from({ length: 128 })
      .fill(0)
      .map((_, i) => i);

    await withLeakTrack(async () => {
      const scan = new ScanSequence({
        device,
        source: makeBuffer(device, srcData, "source", Uint32Array),
        reduceTemplate: sumTemplateUnsigned,
        workgroupLength: 4,
      });
      trackUse(scan);
      const shaderGroup = new ShaderGroup(device, scan);
      shaderGroup.dispatch();

      const expected = prefixSum(srcData);
      await withBufferCopy(device, scan.prefixScan, "u32", (data) => {
        expect([...data]).deep.equals(expected);
      });
      trackRelease(scan);
    });
  });
});
