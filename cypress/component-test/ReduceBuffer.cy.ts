import {
  labeledGpuDevice,
  maxTemplate,
  minMaxTemplate,
  partitionBySize,
  ShaderGroup,
  sumTemplate,
  trackRelease,
  trackUse,
  withAsyncUsage,
  withBufferCopy,
  withLeakTrack,
} from "thimbleberry/shader-util";
import { BufferReduceShader } from "thimbleberry/shaders";
import { makeBuffer } from "./util/MakeBuffer";

it("buffer reduce sum, two dispatches", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const sourceData = [0, 1, 2, 3, 4, 5, 6, 7];
    await withLeakTrack(async () => {
      const shader = new BufferReduceShader({
        device,
        source: makeBuffer(device, sourceData, "source buffer", Float32Array),
        reducedResult: makeBuffer(device, [0, 0], "result", Float32Array),
        dispatchLength: 2,
        blockLength: 2,
        workgroupLength: 2,
        reduceTemplate: sumTemplate,
      });
      trackUse(shader);
      const shaderGroup = new ShaderGroup(device, shader);
      shaderGroup.dispatch();

      const elemsPerDispatch = shader.blockLength * shader.workgroupLength!;
      const expected = [...partitionBySize(sourceData, elemsPerDispatch)].map(
        (part) => part.reduce((a, b) => a + b)
      );

      await withBufferCopy(device, shader.reducedResult, "f32", (data) => {
        expect([...data]).deep.eq(expected);
      });
      trackRelease(shader);
    });
  });
});

it("buffer reduce max, two dispatches", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const sourceData = [0, 1, 2, 3, 4, 5, 6, 7];
    const shader = new BufferReduceShader({
      device,
      source: makeBuffer(device, sourceData, "source buffer", Float32Array),
      reducedResult: makeBuffer(device, [0, 0], "result", Float32Array),
      dispatchLength: 2,
      blockLength: 2,
      workgroupLength: 2,
      reduceTemplate: maxTemplate,
    });
    const shaderGroup = new ShaderGroup(device, shader);
    shaderGroup.dispatch();

    const elemsPerDispatch = shader.blockLength * shader.workgroupLength!;
    const expected = [...partitionBySize(sourceData, elemsPerDispatch)].map(
      (part) => part.reduce((a, b) => Math.max(a, b))
    );

    await withBufferCopy(device, shader.reducedResult, "f32", (data) => {
      expect([...data]).deep.eq(expected);
    });
  });
});

it("buffer reduce min/max, two dispatches", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    // uneven number of min/max pairs
    const sourceData = [
      [1e8, -1e8],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 5],
      [1, 6],
    ].flat();
    const shader = new BufferReduceShader({
      device,
      source: makeBuffer(device, sourceData, "source buffer", Float32Array),
      reducedResult: makeBuffer(device, [0, 0, 0, 0], "result", Float32Array),
      dispatchLength: 2,
      blockLength: 2,
      workgroupLength: 2,
      reduceTemplate: minMaxTemplate,
    });

    const shaderGroup = new ShaderGroup(device, shader);
    shaderGroup.dispatch();

    await withBufferCopy(device, shader.reducedResult, "f32", (data) => {
      expect([...data]).deep.eq([1, 3, 1, 6]);
    });
  });
});
