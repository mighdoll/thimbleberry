import { FormattedCsv, JsonRow } from "./FormattedCsv.js";
import { GpuPerfReport, reportJson } from "./GpuPerfReport.js";

// TODO get rid of this file

/** name:time pairs for extra csv report rows */
export type ExtraRows = Record<string, string>;

/** extra columns values repeated in every row of a csv report */
export type ExtraColumns = Record<string, string | ValueWidth>;

/** extra columns can include a fixed width */
export interface ValueWidth {
  value: string;
  width?: number;
}

/**
 * @return a report of gpu timing in a csv formatted string.
 *
 * @param extraRows a name, duration pair added as an extra row
 * @param tagColumns column name and value repeated in every row
 * @param label label for the total duration row ("gpu-total" by default)
 */
export function csvReport(
  report: GpuPerfReport,
  extraRows?: ExtraRows,
  tagColumns?: ExtraColumns,
  label?: string
): string {
  const csv = new FormattedCsv();

  const gpuRows = reportJson(report, label);
  const addedRows = additionalRows(extraRows);
  const allRows = [...gpuRows, ...addedRows];

  const extraValues = tagColumnValues(tagColumns);
  const rows = allRows.map(g => ({ ...g, ...extraValues }));
  return csv.report(rows);
}

function tagColumnValues(tagColumns?: ExtraColumns): Record<string, string> {
  if (!tagColumns) return {};
  const extraValues = Object.entries(tagColumns).map(([name, combinedValue]) => {
    const value = typeof combinedValue === "string" ? combinedValue : combinedValue.value;
    return [name, value];
  });
  return Object.fromEntries(extraValues);
}

function additionalRows(extraRows?: ExtraRows): JsonRow[] {
  if (!extraRows) return [];
  const start = (0).toFixed(2);
  const columnValues = Object.entries(extraRows).map(([name, value]) => ({
    name,
    start,
    duration: value,
  }));

  return columnValues;
}
