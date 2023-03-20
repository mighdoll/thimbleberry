import {
  labeledGpuDevice,
  minMaxTemplate,
  ShaderGroup,
  sumTemplate,
  trackRelease,
  trackUse,
  Vec2,
  withAsyncUsage,
  withBufferCopy,
  withLeakTrack,
} from "thimbleberry/shader-util";
import { ReduceFrameSequence } from "thimbleberry/shaders";
import { sequenceTexture } from "./util/SequenceTexture";

export interface TestInfo {
  image: Vec2;
  blockDim: number;
  workgroupSize: Vec2;
  note?: string;
}

const tests: TestInfo[] = [
  { image: [4, 4], blockDim: 4, workgroupSize: [1, 1] },
  {
    image: [4, 4],
    blockDim: 2,
    workgroupSize: [2, 2],
    note: "1 buffer dispatch",
  },
  { image: [4, 4], blockDim: 1, workgroupSize: [4, 4] },
  { image: [4, 4], blockDim: 1, workgroupSize: [2, 2] },
  { image: [8, 8], blockDim: 2, workgroupSize: [2, 2], note: "3 dispatches" },
  { image: [8, 8], blockDim: 1, workgroupSize: [2, 2], note: "3 dispatches" },
  { image: [16, 16], blockDim: 1, workgroupSize: [2, 2], note: "3 dispatches" },
  { image: [3, 4], blockDim: 4, workgroupSize: [1, 1] },
  { image: [3, 4], blockDim: 1, workgroupSize: [2, 2] },
  { image: [3, 16], blockDim: 1, workgroupSize: [2, 2] },
  { image: [3, 16], blockDim: 2, workgroupSize: [2, 2] },
];

tests.forEach((test) => {
  console.clear();
  const { image, blockDim, workgroupSize, note = "" } = test;
  it(`reduce a ${image} image, block size ${blockDim}, workGroupSize: ${workgroupSize}. ${note}`, () => {
    runShader(image, blockDim, workgroupSize);
  });
});

function runShader(image: Vec2, blockDim: number, workgroupSize: Vec2): void {
  cy.then(async () => {
    await frameReduce(image, blockDim, workgroupSize);
  });
}

async function frameReduce(
  fbSize: Vec2,
  blockDim: number,
  workgroupSize: Vec2
): Promise<void> {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const { texture: srcTexture, sum } = sequenceTexture(device, fbSize);
    const fr = new ReduceFrameSequence({
      device,
      srcTexture,
      blockLength: blockDim,
      workThreads: workgroupSize[0],
      reduceTemplate: sumTemplate,
    });
    const shaderGroup = new ShaderGroup(device, fr);
    shaderGroup.dispatch();

    const reduced = fr.reducedResult;
    await withBufferCopy(device, reduced, "f32", (data) => {
      expect(data[0]).to.equal(sum);
    });
  });
}

it("reduce texture min/max, texture and buffer dispatches", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const { texture: srcTexture } = sequenceTexture(device, [4, 4]);
    await withLeakTrack(async () => {
      const frameReduce = new ReduceFrameSequence({
        device,
        srcTexture,
        blockLength: 2,
        workThreads: 2,
        reduceTemplate: minMaxTemplate,
      });
      trackUse(frameReduce);

      const shaderGroup = new ShaderGroup(device, frameReduce);
      shaderGroup.dispatch();
      expect(frameReduce.bufShaders().length).eq(1);

      const reduced = frameReduce.reducedResult;
      await withBufferCopy(device, reduced, "f32", (data) => {
        expect([...data].slice(-2)).deep.eq([1, 15]);
      });
      trackRelease(frameReduce);
    });
  });
});
