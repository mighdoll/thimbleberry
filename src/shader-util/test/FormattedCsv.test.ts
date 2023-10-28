import { expect, test } from "vitest";
import { FormattedCsv } from "../FormattedCsv.js";

test("automatic column widths", () => {
  const fmt = new FormattedCsv();
  const report = fmt.report([{ name: "long_name", value: "bar" }]);
  const expected = `
       name,  value
  long_name,    bar`.slice(1);
  expect(report).toEqual(expected);
});

test("static fields column widths", () => {
  const fmt = new FormattedCsv(["extra"]);
  const report = fmt.report([{ name: "long_name", value: "bar" }]);
  const expected = `
       name,  value,  extra
  long_name,    bar,       `.slice(1);
  expect(report).toEqual(expected);
});
