import { dlog } from "berry-pretty";
import {
  csvReport,
  gpuTiming,
  initGpuTiming,
  labeledGpuDevice,
  logCsvReport,
  minMaxTemplate,
  reportDuration,
  ShaderGroup,
  trackUse,
  withAsyncUsage,
} from "thimbleberry/shader-util";
import { ReduceFrameSequence } from "thimbleberry/shaders";
import { sequenceTexture } from "./util/SequenceTexture";

it("gpu perf measures time: frame sequence example", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice({
      requiredFeatures: ["timestamp-query"],
    });
    trackUse(device);
    initGpuTiming(device);

    const { texture: srcTexture } = sequenceTexture(device, [1024, 1024]);
    const frameReduce = new ReduceFrameSequence({
      device,
      srcTexture,
      reduceTemplate: minMaxTemplate,
      workThreads: 16,
      blockLength: 4,
    });
    const shaderGroup = new ShaderGroup(device, frameReduce);

    const start = performance.now();
    shaderGroup.dispatch();
    await device.queue.onSubmittedWorkDone;
    const clockTime = performance.now() - start;

    const gpuPerf = await gpuTiming?.results();
    const csv = csvReport(gpuPerf!);
    console.log(csv);
    const resultTime = reportDuration(gpuPerf!);
    dlog({ resultTime, clockTime });
    // expect(resultTime).to.be.lessThan(clockTime); // TODO unreliable..
  });
});
