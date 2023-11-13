import { FormattedCsv, reportDuration, reportJson } from "thimbleberry";
import { BenchResult, GpuPerfWithId } from "./BenchShader.js";

/** "summary-only" shows only a gb/sec table
 * "fastest" shows a table with perf details from the fastest run, and also the summary
 * "median" shows a table with perf details from the median fastest run, and also the summary
 * "details" shows a table with perf details from all runs, and also the summary
 */
export type BenchReportType = "summary-only" | "median" | "fastest" | "details";

/* configuration options for logCsvReport */
export interface LogCsvConfig {
  /** perf results to log */
  benchResult: BenchResult;

  /** number of 32 bit words in the source, for gb/sec calculation */
  srcSize: number;

  /** amount of detail to include in the report
   * @defaultValue "median" */
  reportType?: BenchReportType;

  /** additional columns to add at the end (e.g. git tag) */
  tags?: Record<string, string>;

  /** additional columns to prepend (e.g. git tag) */
  preTags?: Record<string, string>;

  /** number of fractions in numerical values */
  precision?: number;
}

/** Log a csv formatted version of the benchmark performance records
 * to the debug console and optionally to a localhost websocket */
export function logCsvReport(params: LogCsvConfig): void {
  const validParams = validateParams(params);
  const gpuReports = selectGpuCsv(validParams);
  const summaryReports = summaryCsv(validParams);
  const sections = [...gpuReports, summaryReports];
  const msg = sections.join("\n\n") + "\n\n";

  logMsg(msg);
}

export function logMsg(msg: string): void {
  console.log(msg);
  logWebSocket(msg);
}

function validateParams(config: LogCsvConfig): Required<LogCsvConfig> {
  const defaultReportType: BenchReportType = "median";
  const defaults = {
    reportType: defaultReportType,
    tags: {},
    preTags: {},
    precision: 2,
  };
  const result = { ...defaults, ...config };
  const reportType = result.reportType;
  if (!["summary-only", "median", "fastest", "details"].includes(reportType)) {
    console.error(
      `invalid reportType: "${reportType}", using reportType: "${defaultReportType}"`
    );
    result.reportType = defaultReportType;
  }
  return result;
}

/** return the gpu perf csv requested by reportType,
 * (or none for "summary-only") */
function selectGpuCsv(params: Required<LogCsvConfig>): string[] {
  const { benchResult, reportType } = params;
  const { reports } = benchResult;

  let toReport: GpuPerfWithId[] = [];
  if (reportType === "summary-only") {
    return [];
  } else if (reportType === "details") {
    toReport = reports;
  } else if (reportType === "median") {
    toReport = medianReport(reports) ;
  } else if (reportType === "fastest") {
    const fastest = reports.reduce((a, b) =>
      reportDuration(a) < reportDuration(b) ? a : b
    );
    toReport = [fastest];
  }

  const reportCsv = gpuPerfCsv(toReport, params);
  return [reportCsv];
}

function medianReport(reports: GpuPerfWithId[]): GpuPerfWithId[] {
    const durations = reports.map(r => ({ report: r, duration: reportDuration(r) }));
    durations.sort((a, b) => a.duration - b.duration);
    const median = durations[Math.floor(durations.length / 2)];
    return median ? [median.report] : [];
}

/** return a csv table from gpu performance records */
function gpuPerfCsv(reports: GpuPerfWithId[], params: Required<LogCsvConfig>): string {
  const { preTags, tags, precision } = params;

  const totalLabel = `--> gpu total`;
  const reportsRows = reports.map(report => {
    const jsonRows = reportJson(report, totalLabel, precision);
    const rowsWithRun = jsonRows.map(row => ({ ...row, runId: report.id }));
    return rowsWithRun;
  });
  const flatRows = reportsRows.flat();
  const reportFullRows = flatRows.map(row => ({ ...preTags, ...row, ...tags }));

  const fmt = new FormattedCsv();
  const csv = fmt.report(reportFullRows);
  return csv;
}

/** create a summary csv table showing gb/sec, and average clock timetime */
function summaryCsv(params: Required<LogCsvConfig>): string[] {
  const { reportType, benchResult, srcSize, preTags, tags, precision } = params;
  const { averageClockTime, reports } = benchResult;
  if (reportType === "details") {
    // defer summary, to keep table types together for spreadsheet import
    return [];
  }

  const seconds = averageClockTime / 1000;
  const gigabytes = srcSize / 2 ** 30;
  const gbSec = (gigabytes / seconds).toFixed(2);

  const report = medianReport(reports)
  const median = report ? reportDuration(report[0]) : 0;
  
  const averageTimeMs = averageClockTime.toFixed(precision);
  const jsonRows = [
    {
      "avg time / run (ms)": averageTimeMs,
      "median gpu time (ms)": median.toFixed(precision),
      "src GB/sec": gbSec,
      "src bytes": srcSize.toString(),
    },
  ];
  const fullRows = jsonRows.map(row => ({ ...preTags, ...row, ...tags }));

  const summaryCsv = new FormattedCsv();
  return [summaryCsv.report(fullRows)];
}

/** If reporting is enabled via the ?reportUrl url param,
 *  write a message to a websocket on that port */
function logWebSocket(message: string): void {
  const url = new URL(document.URL);
  const params = new URLSearchParams(url.search);
  const port = params.get("reportPort");

  if (port) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.onopen = () => {
      ws.send(message);
      ws.close();
    };
  }
}
