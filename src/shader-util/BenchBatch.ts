import {
  CompletedSpan,
  GpuPerfReport,
  ShaderGroup,
  gpuTiming,
  withTimestampGroup
} from "thimbleberry";

/** collected results from a batch of benchmark runs */
export interface BatchResult {
  averageClockTime: number;
  spans: SpanWithId[];
  report: GpuPerfReport;
  batchSize: number;
}

/** unique id attached to a span for later reporting */
export interface SpanWithId extends CompletedSpan {
  runId: number;
}

/** run the ShaderGroup batchSize times, and collect timing results from the gpu */
export async function runBatch(
  device: GPUDevice,
  run: number,
  batchSize: number,
  shaderGroup: ShaderGroup
): Promise<BatchResult> {
  const spans: SpanWithId[] = [];

  // run the shader mulitple times 
  gpuTiming!.restart();
  const batchStart = performance.now();
  for (let i = run, batchNum = 0; batchNum < batchSize; i++, batchNum++) {
    const span = runOnce(i, shaderGroup);
    span && spans.push({ ...span, runId: i });
  }

  // collect and report results 
  await device.queue.onSubmittedWorkDone();
  const clockTime = performance.now() - batchStart;
  const report = await gpuTiming!.results();
  const averageClockTime = clockTime / batchSize;
  return { averageClockTime, spans, report, batchSize };
}

/** run once, returning a span for the run.
 * The span can be used later to filter collected gpu timing events to those during this run. */
function runOnce(id: number, shaderGroup: ShaderGroup): CompletedSpan | undefined {
  const frameLabel = `frame-${id}`;
  performance.mark(frameLabel);
  const { span } = withTimestampGroup(frameLabel, () => {
    shaderGroup.dispatch();
  });
  if (span) {
    return span;
  } else {
    console.error("no span from withTimestampGroup. gpuTiming not initialized?");
  }
}