/** values for one row */
export type JsonRow = Record<string, string>;

/** static width of each column */
interface ColumnWidths {
  [key: string]: number;
}

const columnPadding = 2;

/** utility class to print column aligned tabular csv data */
export class FormattedCsv {
  private staticColumns: string[];

  constructor(staticFields?: string[]) {
    this.staticColumns = staticFields || [];
  }

  /** @returns the csv tabular report for the provided array of values */
  report(valueRows: JsonRow[]): string {
    const columns = this.columnNames(valueRows);
    const widths = columnWidths(columns, valueRows);
    const headerRows = Object.fromEntries(columns.map(c => [c, c]));
    const jsonRows = [headerRows, ...valueRows];
    const stringRows = jsonRows.map(r => row(r, widths));
    return stringRows.join("\n");
  }

  private columnNames(values: JsonRow[]): string[] {
    const set = new Set<string>();
    values.forEach(jsonRow => Object.keys(jsonRow).forEach(k => set.add(k)));
    this.staticColumns.forEach(k => set.add(k));
    return [...set];
  }
}

/** generate string for one row in the table */
function row(rowValues: JsonRow, columnWidths: ColumnWidths): string {
  const rowStrings = Object.entries(columnWidths).map(([name, width]) => {
    const value = rowValues[name] || "";
    return value.slice(0, width).padStart(width, " ");
  });
  return rowStrings.join(",");
}

/** calculate column widths dynamically */
function columnWidths(columnNames: string[], values: JsonRow[]): ColumnWidths {
  const entries = columnNames.map(name => {
    const valueLength = longestColumnValue(values, name);
    const maxWidth = Math.max(name.length, valueLength);
    return [name, maxWidth + columnPadding];
  });
  return Object.fromEntries(entries);
}

/** return the length of the longest value in a named column  */
function longestColumnValue(rows: JsonRow[], name: string): number {
  const column = rows.map(v => v[name]);
  const widths = column.map(v => (v ? v.length : 0));
  const longest = widths.reduce((a, b) => (a > b ? a : b));
  return longest;
}
