import {
  labeledGpuDevice,
  minMaxTemplate,
  ShaderGroup,
  trackRelease,
  trackUse,
  withAsyncUsage,
  withBufferCopy,
  withLeakTrack,
} from "thimbleberry/shader-util";
import { HistogramShader } from "thimbleberry/shaders";
import { makeBuffer } from "./util/MakeBuffer";
import { makeTexture } from "./util/MakeTexture";

it("histogram in one workgroup", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();

    const srcData = [
      [0, 1, 1, 1],
      [1, 1, 1, 1],
      [2, 2, 2, 3],
      [3, 4, 9, 10],
    ];

    const srcTexture = makeTexture(
      device,
      srcData,
      "r16float",
      "source density texture"
    );
    const max = Math.max(...srcData.flat());
    const maxBuffer = makeBuffer(device, [1, max], "min/max");
    const numBuckets = 10;

    await withLeakTrack(async () => {
      const histogram = new HistogramShader({
        device,
        srcTexture,
        maxBuffer,
        numBuckets,
        reduceTemplate: minMaxTemplate,
      });
      trackUse(histogram);
      const shaderGroup = new ShaderGroup(device, histogram);
      shaderGroup.dispatch();

      await withBufferCopy(device, histogram.histogramBuffer, "u32", (data) => {
        const expected = [7, 3, 2, 1, 0, 0, 0, 0, 1, 1];
        expect([...data]).to.deep.equal(expected);
      });

      await withBufferCopy(device, histogram.sumBuffer, "f32", (data) => {
        const expected = [7, 6, 6, 4, 0, 0, 0, 0, 9, 10];
        expect([...data]).to.deep.equal(expected);
      });
      trackRelease(histogram);
    });
  });
});

it("histogram in multiple workgroups", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();

    const srcData = [
      [0, 1, 1, 1],
      [1, 1, 1, 1],
      [2, 2, 2, 3],
      [3, 4, 9, 10],
    ];

    const srcTexture = makeTexture(
      device,
      srcData,
      "r16float",
      "source density texture"
    );
    const max = Math.max(...srcData.flat());
    const maxBuffer = makeBuffer(device, [1, max], "min/max");
    const numBuckets = 10;

    const histogram = new HistogramShader({
      device,
      srcTexture,
      maxBuffer,
      workgroupSize: [2, 2],
      numBuckets,
      reduceTemplate: minMaxTemplate,
    });
    const shaderGroup = new ShaderGroup(device, histogram);
    shaderGroup.dispatch();

    const resultBuffer = histogram.histogramBuffer;
    await withBufferCopy(device, resultBuffer, "u32", (data) => {
      const expected = [7, 3, 2, 1, 0, 0, 0, 0, 1, 1];
      expect([...data]).to.deep.equal(expected);
    });
  });
});

it("uneven histogram in multiple workgroups", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();

    const srcData = [
      [0, 1, 1, 1, 1],
      [1, 1, 1, 1, 2],
      [2, 2, 2, 3, 3],
      [3, 4, 9, 10, 10],
    ];

    const srcTexture = makeTexture(
      device,
      srcData,
      "r16float",
      "source density texture"
    );
    const max = Math.max(...srcData.flat());
    const maxBuffer = makeBuffer(device, [1, max], "min/max");
    const numBuckets = 10;

    const histogram = new HistogramShader({
      device,
      srcTexture,
      maxBuffer,
      workgroupSize: [2, 2],
      numBuckets,
      reduceTemplate: minMaxTemplate,
    });
    const shaderGroup = new ShaderGroup(device, histogram);
    shaderGroup.dispatch();

    const resultBuffer = histogram.histogramBuffer;
    await withBufferCopy(device, resultBuffer, "u32", (data) => {
      const expected = [8, 4, 3, 1, 0, 0, 0, 0, 1, 2];
      expect([...data]).to.deep.equal(expected);
    });
  });
});
