import { ComposableShader, initGpuTiming } from "thimbleberry";
import { benchDevice } from "./BenchDevice.js";
import { BenchReportType, logCsvReport, logMsg } from "./BenchReport.js";
import { BenchResult, benchShader } from "./BenchShader.js";

/** Create function to make a runnable shader for benchmarking. */
export type MakeShader = (device: GPUDevice) => Promise<ShaderAndSize> | ShaderAndSize;

/** function to create a shader for benchmarking, and optionally set default
 * benchmark parameters for each shader */
export interface MakeBenchableShader extends Partial<ControlParams> {
  makeShader: MakeShader;
}

/** A ready-to-run shader for benchmarking, and the number of source bytes
 * that the shader processes (used for reporting) */
export interface ShaderAndSize {
  shader: ComposableShader;
  srcSize: number;
}

/** control benchmark parameters per benchmark (or globally via url parameters) */
export interface ControlParams {
  runs: number;
  reportType: BenchReportType;
  precision: number;
  warmup: number;
  runsPerBatch: number;
}

const defaultControl: ControlParams = {
  reportType: "median",
  runs: 100,
  precision: 2,
  warmup: 15,
  runsPerBatch: 50,
};

interface NamedBenchResult {
  name: string;
  benchResult: BenchResult;
  srcSize: number;
}

/**
 * Run one or more benchmarks and report the results as csv to the debug console
 * and optionally to a localhost websocket.
 *
 * @param attributes name value pairs to include in each reported
 *   csv row (e.g. for git version)
 *
 * Control parameters for the benchmarks (e.g. # of runs, type of reports),
 * may optionally be specified statically as parameters to benchRunner() for each shader.
 *
 * Url query parameters are also supported (e.g. ?runs=1000&reportType=details),
 * and will globally override static parameters.
 */
export async function benchRunner(
  makeBenchables: MakeBenchableShader[],
  attributes?: Record<string, string>
): Promise<void> {
  const testUtc = Date.now().toString();
  const device = await benchDevice();
  initGpuTiming(device);

  const benchables = [];
  for (const make of makeBenchables) {
    const { shader, srcSize } = await make.makeShader(device);
    benchables.push({
      ...make,
      shader,
      srcSize,
    });
  }

  const namedResults: NamedBenchResult[] = [];
  for (const b of benchables) {
    const { srcSize, shader } = b;
    const { reportType, runs, precision, warmup, runsPerBatch } = controlParams(b);
    const name = shader.name || shader.constructor.name || "<shader>";
    const benchResult = await benchShader({ device, runs, warmup, runsPerBatch }, shader);
    namedResults.push({ benchResult, name, srcSize });
    logCsv(name, benchResult, srcSize, testUtc, reportType, precision, attributes);
  }

  // log summary separately for detail reports, for easier spreadsheet import
  const { reportType, precision } = controlParams();
  if (reportType === "details") {
    logMsg("## Summary\n");
    namedResults.forEach(result => {
      const { name, benchResult, srcSize } = result;

      logCsv(name, benchResult, srcSize, testUtc, "summary-only", precision, attributes);
    });
  }
}

/** consolidate control parameters from caller params, defaults and url param overrides */
function controlParams(provided?: Partial<ControlParams>): ControlParams {
  const urlParams = urlControlParams();
  const result = { ...defaultControl, ...provided, ...urlParams };

  return result;
}

function logCsv(
  label: string,
  benchResult: BenchResult,
  srcSize: number,
  utc: string,
  reportType: BenchReportType,
  precision: number,
  attributes?: Record<string, string>
): void {
  const preTags = { benchmark: label };
  const tags = { utc, ...attributes };
  logCsvReport({ benchResult, srcSize, reportType, preTags, tags, precision });
}

/** return global control parameters from url */
function urlControlParams(): Partial<ControlParams> {
  const params = new URLSearchParams(window.location.search);

  return removeUndefined({
    runs: intParam(params, "runs"),
    reportType: stringParam(params, "reportType"),
    warmup: intParam(params, "warmup"),
    runsPerBatch: intParam(params, "runsPerBatch"),
    precision: intParam(params, "precision"),
  });
}

function intParam(params: URLSearchParams, name: string): number | undefined {
  const value = params.get(name);
  return value ? parseInt(value) : undefined;
}

function stringParam<T = string>(params: URLSearchParams, name: string): T | undefined {
  return (params.get(name) as T) || undefined;
}

/** @return a copy, eliding fields with undefined values */
function removeUndefined<T>(obj: T): Partial<T> {
  const result = { ...obj };
  for (const key in result) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
}
