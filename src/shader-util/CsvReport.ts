import { ColumnValues, FormattedCsv } from "./FormattedCsv.js";
import { GpuPerfReport, gpuReportColumns, reportRows } from "./GpuPerfReport.js";


/** name:time pairs for extra csv report rows */
export type ExtraRows = Record<string, string>;

/** extra columns values repeated in every row of a csv report */
export type ExtraColumns = Record<string, string | ValueWidth>;

export interface ValueWidth {
  value: string;
  width?: number;
}

const defaultCsvPad = 2;

/** 
 * @return a report of gpu timing in a csv formatted string.
 * 
 * @param extraRows a name, duration pair added as an extra row
 * @param tagColumns column name and value repeated in every row
 */
export function csvReport(
  report: GpuPerfReport,
  extraRows?: ExtraRows,
  tagColumns?: ExtraColumns
): string {
  const extraColWidths = tagColumWidths(tagColumns);
  const cols = { ...gpuReportColumns, ...extraColWidths };
  const csv = new FormattedCsv(cols);

  const gpuRows = reportRows(report);
  const addedRows = additionalRows(extraRows);
  const allRows = [...gpuRows, ...addedRows];

  const extraValues = tagColumnValues(tagColumns);
  const rows = allRows.map(g => ({ ...g, ...extraValues }));
  const bodyRows = rows.map(r => csv.row(r));
  const lines = [csv.header(), ...bodyRows, "\n"];

  return lines.join("\n");
}

function tagColumWidths(tagColumns?: ExtraColumns): Record<string, number> {
  if (!tagColumns) return {};
  const extraWidths = Object.entries(tagColumns).map(([name, combinedValue]) => {
    const value = typeof combinedValue === "string" ? combinedValue : combinedValue.value;
    const width = typeof combinedValue === "string" ? undefined : combinedValue.width;
    const actualWidth = width ?? Math.max(name.length, value.length) + defaultCsvPad;
    return [name, actualWidth];
  });
  return Object.fromEntries(extraWidths);
}

function tagColumnValues(tagColumns?: ExtraColumns): Record<string, string> {
  if (!tagColumns) return {};
  const extraValues = Object.entries(tagColumns).map(([name, combinedValue]) => {
    const value = typeof combinedValue === "string" ? combinedValue : combinedValue.value;
    return [name, value];
  });
  return Object.fromEntries(extraValues);
}

function additionalRows(extraRows?: ExtraRows): ColumnValues<typeof gpuReportColumns>[] {
  if (!extraRows) return [];
  const start = (0).toFixed(2);
  const columnValues = Object.entries(extraRows).map(([name, value]) => ({
    name,
    start,
    duration: value,
  }));

  return columnValues;
}