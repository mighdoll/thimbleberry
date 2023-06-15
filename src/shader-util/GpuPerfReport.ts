import { ColumnValues, FormattedCsv } from "./FormattedCsv";
import { CompletedSpan } from "./GpuPerf";

export interface GpuPerfMark {
  label: string;
  start: number; // offset in milliseconds from start of gpu timing
  _startDex: number; // index into the querySet
}

export interface GpuPerfSpan extends GpuPerfMark {
  duration: number; // in milliseconds
  _endDex: number; // index into the querySet
}

/** A report of timing data collected from the gpu */
export interface GpuPerfReport {
  spans: GpuPerfSpan[];
  marks: GpuPerfMark[];
}

/** return a filtered report containing just the spans and marks within a containing span */
export function filterReport(
  report: GpuPerfReport,
  container: CompletedSpan
): GpuPerfReport {
  const spans = report.spans.filter(
    s => s._startDex >= container._startDex && s._endDex <= container._endDex
  );
  const marks = report.marks.filter(
    m => m.start >= container._startDex && m._startDex <= container._endDex
  );
  return { spans, marks };
}

/** return the time between the earliest and latest end of any span in the report */
export function reportDuration(report: GpuPerfReport): number {
  return lastTime(report) - firstTime(report);
}

/** return the first timestamp in the report */
export function firstTime(report: GpuPerfReport): number {
  const firstSpanStart = report.spans.reduce((a, s) => Math.min(s.start, a), Infinity);
  const firstMark = report.marks.reduce((a, s) => Math.min(s.start, a), Infinity);
  return Math.min(firstSpanStart, firstMark);
}

/** return the last timestamp in the report */
export function lastTime(report: GpuPerfReport): number {
  const lastSpanEnd = report.spans.reduce(
    (a, s) => Math.max(s.start + s.duration, a),
    -Infinity
  );
  const lastMark = report.marks.reduce((a, s) => Math.max(s.start, a), -Infinity);
  return Math.max(lastSpanEnd, lastMark);
}

/** typical size of the gpu columns, for callers making custom formatted csv reports */
export const gpuReportColumns = { name: 20, start: 8, duration: 9 };

/** raw row data for callers making custom formatted csv reports */
export function reportRows(
  report: GpuPerfReport,
  labelTotal?: string
): ColumnValues<typeof gpuReportColumns>[] {
  const startTime = firstTime(report);
  const rows: ColumnValues<typeof gpuReportColumns>[] = [];
  for (const span of report.spans) {
    const row = {
      name: span.label,
      start: (span.start - startTime).toFixed(2),
      duration: span.duration.toFixed(2),
    };
    rows.push(row);
  }
  const total = reportDuration(report).toFixed(2);
  rows.push({
    name: labelTotal || "gpu-total",
    start: startTime.toFixed(2),
    duration: total,
  });
  return rows;
}
