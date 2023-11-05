import { ComposableShader, GpuPerfReport, ShaderGroup, filterReport } from "thimbleberry";
import { BatchResult, runBatch } from "./BenchBatch.js";

/** parameters to benchShader() */
export interface BenchConfig {
  device: GPUDevice;
  runs: number;
  runsPerBatch?: number;
  warmup?: number;
}

/** benchmark timing results */
export interface BenchResult {
  reports: GpuPerfWithId[];
  averageClockTime: number;
}

/** associates a benchmark run id with the returned gpu spans and marks */
export interface GpuPerfWithId extends GpuPerfReport {
  id: string;
}

/** run the shader multiple times, in batches, and report gpu and cpu clock timings */
export async function benchShader(
  config: BenchConfig,
  ...shaders: ComposableShader[]
): Promise<BenchResult> {
  const { device, runs, warmup = 15, runsPerBatch = 50 } = config;
  const batchResults: BatchResult[] = [];
  const shaderGroup = new ShaderGroup(device, ...shaders);

  /* warmup runs */
  if (warmup) {
    await runBatch(device, 0, warmup, shaderGroup);
  }

  /* run the shader in batches, so we don't overflow timing buffers */
  for (let i = 0; i < runs; ) {
    const runsThisBatch = Math.min(runsPerBatch, runs - i);
    const result = await runBatch(device, i, runsThisBatch, shaderGroup);
    batchResults.push(result);
    i += runsThisBatch;
  }

  shaderGroup.destroyAll();

  // find average clock time across all batches
  const batchAverages = batchResults.map(r => r.averageClockTime * r.batchSize);
  const averageClockTime = batchAverages.reduce((a, b) => a + b, 0) / runs;

  const reports = batchResults.flatMap(({ report, spans }) => {
    return spans.map(span => {
      const filtered = filterReport(report, span);
      return { ...filtered, id: span.runId.toString() };
    });
  });

  return { reports, averageClockTime };
}
