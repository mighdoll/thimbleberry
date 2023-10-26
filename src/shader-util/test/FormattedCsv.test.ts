import { expect, test } from "vitest";
import { FormattedCsv } from "../FormattedCsv.js";

test("static column widths", () => {
  const fmt = new FormattedCsv({ name: 5, value: 6 });
  const report = fmt.report([{ name: "foo", value: "bar" }]);
  const expected = `
 name, value
  foo,   bar`.slice(1);
  expect(report).toEqual(expected);
});

test("allow dynamic column widths", () => {
  const fmt = new FormattedCsv({ name: undefined, value: undefined });
  const report = fmt.report([{ name: "long_name", value: "bar" }]);
  const expected = `
       name,  value
  long_name,    bar`.slice(1);
  expect(report).toEqual(expected);
});
