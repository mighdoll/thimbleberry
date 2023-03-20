/** width of each column */
export interface ColumnDescription {
  [key: string]: number;
}

/** values for every column in a row */
export type ColumnValues<T> = {
  [Property in keyof T]: string;
};

/** utility class to print column aligned tabular csv data */
export class FormattedCsv<T extends ColumnDescription> {
  private fields: ColumnDescription;

  constructor(fields: T) {
    this.fields = fields;
  }

  header(): string {
    const keyValues = Object.keys(this.fields).map(k => [k, k]);
    const o = Object.fromEntries(keyValues);
    return this.row(o);
  }

  row(values: ColumnValues<T>): string {
    const row = Object.entries(this.fields).map(([name, width]) => {
      const value = values[name];
      return value.slice(0, width).padStart(width, " ");
    });
    return row.join(",");
  }
}
