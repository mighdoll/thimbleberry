import { dwarn } from "berry-pretty";
import { GpuPerfMark, GpuPerfReport, GpuPerfSpan } from "./GpuPerfReport";
import { partitionBySize, Sliceable } from "./Sliceable";
import { trackUse } from "./TrackUse";
import { withBufferCopy } from "./WithBufferCopy";

/** global GPUTiming instance */
export let gpuTiming: GpuTiming | undefined;

const maxQuerySetSize = 4096; // max size of a query set containing timestamps

export interface TimestampRangeResult<T> {
  /** result of the provided function */
  result: T;

  /** span to query for this groups records */
  span?: CompletedSpan;
}

/** Typically each rendered frame gets its own session number,
 * used for sanity checking that spans are connected to the right session */
let sessionEpoch = 0;

/** internal state of one span in the current session */
interface SpanInfo {
  label: string;
  startDex: number;
  endDex?: number;
}

/** internal state of one mark in the current session */
interface MarkInfo {
  label: string;
  stampDex: number;
}

/**
 * Provides an api for recording timing on the gpu and for producing a GpuPerfReport
 * from the gpu captured timing data.
 *
 * Generally, callers will call initGpuTiming() and then access methods of this
 * class via the global gpuTiming variable and the '?' operator. If timing is not
 * enabled, gpuTiming will be undefined.
 *
 * Note that this requires the "timestamp-query" feature to be enabled
 * when calling requestDevice(), which in turn currenlty requires a command line
 * flag when launching chrome: --enable-dawn-features=allow_unsafe_apis
 * Thes flags are also useful to increase reporting accuracy:
 * --enable-webgpu-developer-features  --disable-dawn-features=timestamp_quantization
 *
 * This class wraps two separate WebGPU apis:
 *   GPUCommandEncoder.writeTimestamp(),
 * and the timestampWrites parameter passsed to
 *   GPUCommandEncoder.beginRenderPass() and beginComputePass()
 *
 * The two apis have some overlapping functionality, but as of this writing the WebGPU
 * writeTimestamp api is unreliable on Metal (Apple), due to reordering of commands
 * at the driver level. Until that issue is fixed, prefer GpuTiming.timestampWrites()
 * instead of GpuTiming.span() or GpuTiming.mark().
 * 
 * GPUTiming works by asking the GPU to record timestamps during shader execution. 
 * GPU timestamps are saved into an array called a QuerySet which can later be copied 
 * back to the CPU for analysis.  This class maintains a mapping from span and mark 
 * labels to indices in the QuerySet. The results() method fetches the QuerySet
 * and parses the timestamps into a GPUPerfReport. 
 * 
 * See the companion module GpuPerfReport.ts for filtering and other GPUPerfReport utilities.
 */
export class GpuTiming {
  private device: GPUDevice;
  private querySet: GPUQuerySet;
  private stampDex = 0;
  private marks: MarkInfo[] = [];
  private spans: SpanInfo[] = [];
  private capacity: number;
  private sessionNum = sessionEpoch++;
  // buffer to hold results copied from querySet
  private resultBuffer: GPUBuffer;

  constructor(device: GPUDevice, maxSize?: number) {
    this.device = device;
    this.capacity = maxSize ?? maxQuerySetSize;
    this.querySet = this.initQuerySet();
    this.resultBuffer = this.createResultBuffer();
  }

  /** restart thie timing session, dropping any unreported results */
  restart(): void {
    this.stampDex = 0;
    this.marks.length = 0;
    this.spans.length = 0;
    this.sessionNum = sessionEpoch++;
  }

  /** start a timing span in the session.
   *
   * Note, prefer the timestampWrites() api on Metal for now.
   */
  span(label: string, commands: GPUCommandEncoder): StartedSpan {
    const startDex = this.stampDex;
    this.writeTimestamp(commands);
    let complete = false;
    const currentSession = this.sessionNum;

    const end = (commands: GPUCommandEncoder): CompletedSpan => {
      if (!complete) {
        if (this.sessionNum !== currentSession) {
          dwarn("gpuTiming: session changed before span completed", label);
          return { label, _startDex: 0, _endDex: 0 };
        }

        this.spans.push({ label, startDex, endDex: this.stampDex });
        this.writeTimestamp(commands);
        complete = true;
      }
      return { label, _startDex: startDex, _endDex: this.stampDex };
    };

    return {
      end,
    };
  }

  /** mark a moment in the session
   *
   * Note, prefer the timestampWrites() api on Metal for now.
   */
  mark(label: string, commands: GPUCommandEncoder): void {
    const markInfo: MarkInfo = {
      label,
      stampDex: this.stampDex,
    };
    this.marks.push(markInfo);
    this.writeTimestamp(commands);
  }

  /**
   * @return beginning & end timing structures for use as parameters for
   * beginRenderPass or beginComputePass */
  timestampWrites(label: string): GPURenderPassTimestampWrites {
    const querySet = this.querySet;
    this.spans.push({ label, startDex: this.stampDex, endDex: this.stampDex + 1 });
    return {
      querySet,
      beginningOfPassWriteIndex: this.stampDex++,
      endOfPassWriteIndex: this.stampDex++,
    };
  }

  /** fetch all results from the gpu and return a report */
  async results(): Promise<GpuPerfReport> {
    const { querySet, device, resultBuffer } = this;

    await this.device.queue.onSubmittedWorkDone();
    const commands = this.device.createCommandEncoder();
    commands.resolveQuerySet(querySet, 0, querySet.count, resultBuffer, 0);
    device.queue.submit([commands.finish()]);
    const report = await withBufferCopy(device, resultBuffer, "u32", data => {
      const dTime = this.toRelativeTimes(data);
      return this.relativeTimeToReport(dTime);
    });
    return report;
  }

  /**
   * Group a set of gpu timing records,
   * e.g. to record a frame's worth of render and compute passes
   *
   * @returns a CompletedSpan that can be used to filter
   * a GpuPerfReport to just the records for this group.
   */
  withGroup<T>(label: string, fn: () => T): TimestampRangeResult<T> {
    const _startDex = this.stampDex;
    const result = fn();
    const _endDex = this.stampDex;
    const span: CompletedSpan = { label, _startDex, _endDex };

    return {
      result,
      span,
    };
  }

  destroy(): void {
    this.querySet.destroy();
    this.resultBuffer.destroy();
  }

  /** convert 64 bit uint timestamps from the gpu
   * to floating point times relative to the first event */
  private toRelativeTimes(data: Sliceable<number>): number[] {
    const validData = data.slice(0, this.stampDex * 2);
    const evts = [...partitionBySize(validData, 2)];
    if (evts.length === 0) {
      return [];
    }

    // find the first event
    const firstEvt = evts.reduce((a, b) => {
      const [aLo, aHi] = a;
      const [bLo, bHi] = b;
      if (aHi < bHi) {
        return a;
      }
      if (aLo < bLo) {
        return a;
      } else {
        return b;
      }
    });

    // convert to delta ms since first event recorded in this session
    const dTime = evts.slice(0, this.stampDex).map(([lo, hi]) => {
      const dHi = hi - firstEvt[1];
      const dLo = lo - firstEvt[0];
      return (dHi * 2 ** 32 + dLo) / 1e6;
    });
    return dTime;
  }

  /** report structured gpu perf results */
  private relativeTimeToReport(dTime: number[]): GpuPerfReport {
    const markReport: GpuPerfMark[] = this.marks.map(m => {
      const start = dTime[m.stampDex];
      return { start, label: m.label, _startDex: m.stampDex };
    });

    const spanReport: GpuPerfSpan[] = this.spans.map(s => {
      const start = dTime[s.startDex];
      const end = dTime[s.endDex!];
      const duration = end - start;
      return {
        duration,
        start,
        label: s.label,
        _startDex: s.startDex,
        _endDex: s.endDex!,
      };
    });

    return { marks: markReport, spans: spanReport };
  }

  private writeTimestamp(commands: GPUCommandEncoder): void {
    if (this.stampDex >= this.querySet.count) {
      console.error("gpuTiming: exceeded max size");
      return;
    }

    commands.writeTimestamp(this.querySet, this.stampDex++);
  }

  /** allocate a reusable buffer for collecting timing data */
  private createResultBuffer(): GPUBuffer {
    const { querySet, device } = this;
    const size = Float64Array.BYTES_PER_ELEMENT * querySet.count;
    const buffer = device.createBuffer({
      size,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    trackUse(querySet);
    return buffer;
  }

  /** install the query set buffer on the gpu */
  private initQuerySet(): GPUQuerySet {
    const querySet = this.device.createQuerySet({
      type: "timestamp",
      count: this.capacity,
      label: "gpuTiming",
    });
    trackUse(querySet);
    return querySet;
  }
}

/** an in progress timing measurement that has begun but not yet completed */
export interface StartedSpan {
  end(commands: GPUCommandEncoder): CompletedSpan;
}

/** a completed span describing a range in the current timing session */
export interface CompletedSpan {
  label: string;
  _startDex: number;
  _endDex: number;
  // LATER add an session number for sanity checking
}

/** enable timing recording globally */
export function initGpuTiming(device: GPUDevice, maxSize?: number | undefined): void {
  if (gpuTiming) {
    return;
  }
  gpuTiming = new GpuTiming(device, maxSize);
}

export function destroyGpuTiming(): void {
  if (gpuTiming) {
    gpuTiming.destroy();
    gpuTiming = undefined;
  }
}

/**
 * Group a set of gpu timing records.
 * e.g. to record a frame's worth of render and compute passes
 *
 * @returns a CompletedSpan that can be used to filter
 * a GpuPerfReport to just the records for this group.
 *
 * It's ok to call withTimestampGroup even if gpuTiming is not enabled.
 * The underlying function is still called, but no timing information
 * is recorded or reported.
 */
export function withTimestampGroup<T>(
  label: string,
  fn: () => T
): TimestampRangeResult<T> {
  if (gpuTiming) {
    return gpuTiming.withGroup(label, fn);
  } else {
    return {
      result: fn(),
    };
  }
}
