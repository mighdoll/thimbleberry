import {
  labeledGpuDevice,
  loadRedComponent,
  maxTemplate,
  minMaxTemplate,
  ShaderGroup,
  sumTemplate,
  trackRelease,
  trackUse,
  withAsyncUsage,
  withBufferCopy,
  withLeakTrack,
} from "thimbleberry/shader-util";
import { TextureReduceShader } from "thimbleberry/shaders";
import { makeBuffer } from "./util/MakeBuffer";
import { sequenceTexture } from "./util/SequenceTexture";

it("texture reduce sum", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const { texture: srcTexture } = sequenceTexture(device, [4, 4]);
    await withLeakTrack(async () => {
      const tr = new TextureReduceShader({
        device,
        srcTexture,
        reducedResult: makeBuffer(device, [0], "reducedResult", Float32Array),
        blockLength: 4,
        dispatchSize: [1, 1],
        workgroupSize: [1, 1],
        reduceTemplate: sumTemplate,
        loadTemplate: loadRedComponent,
      });
      trackUse(tr);
      const shaderGroup = new ShaderGroup(device, tr);
      shaderGroup.dispatch();

      await withBufferCopy(device, tr.reducedResult, "f32", (data) => {
        expect([...data]).deep.eq([120]);
      });
      trackRelease(tr);
    });
  });
});

it("texture reduce max", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const { texture: srcTexture } = sequenceTexture(device, [4, 4]);
    const tr = new TextureReduceShader({
      device,
      srcTexture,
      reducedResult: makeBuffer(device, [0], "reducedResult", Float32Array),
      blockLength: 4,
      dispatchSize: [1, 1],
      workgroupSize: [1, 1],
      reduceTemplate: maxTemplate,
      loadTemplate: loadRedComponent,
    });
    const shaderGroup = new ShaderGroup(device, tr);
    shaderGroup.dispatch();

    await withBufferCopy(device, tr.reducedResult, "f32", (data) => {
      expect([...data]).deep.eq([15]);
    });
  });
});

it("texture reduce min/max, one dispatch", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const { texture: srcTexture } = sequenceTexture(device, [4, 4]);
    const shader = new TextureReduceShader({
      device,
      srcTexture,
      reducedResult: makeBuffer(device, [0, 0], "reducedResult", Float32Array),
      blockLength: 4,
      dispatchSize: [1, 1],
      workgroupSize: [1, 1],
      reduceTemplate: minMaxTemplate,
      loadTemplate: loadRedComponent,
    });
    const shaderGroup = new ShaderGroup(device, shader);
    shaderGroup.dispatch();

    await withBufferCopy(device, shader.reducedResult, "f32", (data) => {
      expect([...data]).deep.eq([1, 15]);
    });
  });
});

it("texture reduce min/max, four dispatches", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const { texture: srcTexture } = sequenceTexture(device, [4, 4]);
    // prettier-ignore
    const reducedResult = makeBuffer(device, [0, 0, 0, 0, 0, 0, 0, 0], "reducedResult", Float32Array);
    const shader = new TextureReduceShader({
      device,
      srcTexture,
      reducedResult,
      blockLength: 2,
      dispatchSize: [2, 2],
      workgroupSize: [1, 1],
      reduceTemplate: minMaxTemplate,
      loadTemplate: loadRedComponent,
    });
    const shaderGroup = new ShaderGroup(device, shader);
    shaderGroup.dispatch();

    await withBufferCopy(device, shader.reducedResult, "f32", (data) => {
      expect([...data]).deep.eq([1, 5, 2, 7, 8, 13, 10, 15]);
    });
  });
});
