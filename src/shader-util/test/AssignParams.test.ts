import { HasReactive, reactively } from "@reactively/decorate";
import { assignParams, ValueOrFn } from "thimbleberry/shader-util";
import { expect, test } from "vitest";

interface ExampleParams {
  a: ValueOrFn<string>;
}

class Example extends HasReactive {
  @reactively a!: string;

  constructor(params: ExampleParams) {
    super();
    assignParams<Example>(this, params, {});
  }
}

test("raw value param", () => {
  const e = new Example({ a: "hello" });
  expect(e.a).toEqual("hello");
});

test("reactive fn param", () => {
  const e1 = new Example({ a: "hello" });
  const e2 = new Example({ a: () => e1.a });
  expect(e2.a).toEqual("hello");
  e1.a = "world";

  expect(e2.a).toEqual("world"); // updates follow the change to src

  // allow modification of child, disconnects from src
  e2.a = "foo";
  expect(e2.a).toEqual("foo");
  e1.a = "bar";
  expect(e2.a).toEqual("foo");
});

const roundEquals = (a: number, b: number): boolean => Math.round(a) === Math.round(b);

interface ExampleEqualityParams {
  a: ValueOrFn<number>;
}

class ExampleEquality extends HasReactive {
  @reactively({ equals: roundEquals }) a!: number;

  constructor(params: ExampleEqualityParams) {
    super();
    assignParams<ExampleEquality>(this, params, {});
  }
}
test("equalityFn", () => {
  const e = new ExampleEquality({ a: 1 });
  expect(e.a).toEqual(1);

  e.a = 1.1;
  expect(e.a).toEqual(1);
});
