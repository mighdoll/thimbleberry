import { CompletedSpan } from "./GpuPerf";

/** A report of timing data collected from the gpu. */
export interface GpuPerfReport {
  spans: GpuPerfSpan[];
  marks: GpuPerfMark[];
}

export interface GpuPerfMark {
  label: string;
  start: number; // offset in milliseconds from start of gpu timing
  _startDex: number; // index into the querySet
}

export interface GpuPerfSpan extends GpuPerfMark {
  duration: number; // in milliseconds
  _endDex: number; // index into the querySet
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

/** JSON formatted result row for performance reports */
export interface GpuReportJson {
  name: string;
  start: string;
  duration: string;
}

/** JSON formatted result rows for each span, and total report time.
 * results are extracted and formatted from a GpuPerfReport */
export function reportJson(
  report: GpuPerfReport,
  labelTotal?: string,
  precision = 2
): GpuReportJson[] {
  const startTime = firstTime(report);
  const rows: GpuReportJson[] = [];
  for (const span of report.spans) {
    const row = {
      name: span.label,
      start: (span.start - startTime).toFixed(precision),
      duration: span.duration.toFixed(precision),
    };
    rows.push(row);
  }
  const total = reportDuration(report).toFixed(precision);
  rows.push({
    name: labelTotal || "gpu-total",
    start: startTime.toFixed(precision),
    duration: total,
  });
  return rows;
}
