import { dlog } from "berry-pretty";
import {
  csvReport,
  gpuTiming,
  initGpuTiming,
  labeledGpuDevice,
  make2dSequence,
  makeTexture,
  minMaxTemplate,
  reportDuration,
  ShaderGroup,
  trackUse,
  withAsyncUsage,
} from "thimbleberry/shader-util";
import { ReduceFrameSequence } from "thimbleberry/shaders";

it("gpu perf measures time: frame sequence example", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice({
      requiredFeatures: ["timestamp-query"],
    });
    trackUse(device);
    initGpuTiming(device);

    const data = make2dSequence([1024, 1024]);
    const srcTexture = makeTexture(device, data, "r32float");
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
