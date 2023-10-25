/** values for one row */
export type ColumnValues<T> = {
  [Property in keyof T]: string;
};

/** width of each column. Undefined widths will calculated dynamically. */
export interface ColumnDescription {
  [key: string]: number | undefined | null;
}

/** static width of each column */
interface ColumnWidths {
  [key: string]: number;
}

/** utility class to print column aligned tabular csv data */
export class FormattedCsv<T extends ColumnDescription> {
  private fields: ColumnDescription;

  constructor(fields: T) {
    this.fields = fields;
  }

  /** @returns the csv tabular report for the provided array of values */
  report(values: ColumnValues<T>[]): string {
    const headerEntries = Object.keys(this.fields).map(k => [k, k]);
    const header = Object.fromEntries(headerEntries);
    const jsonRows = [header, ...values];
    const columns = this.fixedColumns(values);
    const stringRows = jsonRows.map(r => this.row(r, columns));
    return stringRows.join("\n");
  }

  /** generate string for one row in the table */
  private row(values: ColumnValues<T>, columnWidths: ColumnWidths): string {
    const row = Object.entries(columnWidths).map(([name, width]) => {
      const value = values[name];
      return value.slice(0, width).padStart(width, " ");
    });
    return row.join(",");
  }

  /** calculate column widths dynamically for unspecified columns widths */
  private fixedColumns(values: ColumnValues<T>[]): ColumnWidths {
    const entries = Object.entries(this.fields).map(([name, width]) => {
      if (width === undefined || width === null) {
        return [name, this.maxColumnWidth(values, name) + 1];
      } else {
        return [name, width];
      }
    });
    return Object.fromEntries(entries);
  }

  private maxColumnWidth(values: ColumnValues<T>[], name: string): number {
    const col = values.map(v => v[name]);
    const longest = col.reduce((a, b) => (a.length > b.length ? a : b));
    return longest.length;
  }
}
