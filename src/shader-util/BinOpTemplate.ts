/** wgsl text substitutions that define binary operations for reduce and scan shaders */
export interface BinOpTemplate {
  inputStruct: string; // internal format of a potentially different input structure
  outputStruct: string; // internal format of our structure
  elementSize: number; // size of our structure in bytes
  pureOp: string; // create our structure from from an f32
  flatMapOp: string; // combine two of our structures
  inputOp: string; // convert an input structure to our structure
  identityOp: string; // create our structure with the identity value for our op type (e.g. 0 for sum, 1 for multiply)
}

export const sumTemplate: BinOpTemplate = {
  elementSize: 4,
  outputStruct: "sum: f32,",
  inputStruct: "sum: f32,",
  pureOp: "return Output(a);",
  flatMapOp: "return Output(a.sum + b.sum);",
  identityOp: "return Output(0.0);",
  inputOp: "return Output(a.sum);"
};

export const sumTemplateUnsigned: BinOpTemplate = {
  elementSize: 4,
  outputStruct: "sum: u32,",
  inputStruct: "sum: u32,",
  pureOp: "return Output(a);",
  flatMapOp: "return Output(a.sum + b.sum);",
  identityOp: "return Output(0);",
  inputOp: "return Output(a.sum);"
};

export const minMaxTemplate: BinOpTemplate = {
  elementSize: 8,
  outputStruct: "min: f32, max: f32,",
  inputStruct: "min: f32, max: f32,",
  flatMapOp: "return Output(min(a.min, b.min), max(a.max, b.max));",
  identityOp: "return Output(1e38, -1e38);",
  inputOp: "return Output(a.min, a.max);", // assumes Input is a struct with min and max
  pureOp: `
    if (a > 0.0) {
        return Output(a, a);
    } else {
        return identityOp();
    }
    `
};

export const maxTemplate: BinOpTemplate = {
  elementSize: 4,
  outputStruct: "max: f32,",
  inputStruct: "max: f32,",
  pureOp: "return Output(a);",
  flatMapOp: "return Output(max(a.max, b.max));",
  identityOp: "return Output(0.0);",
  inputOp: "return Output(a.max);"
};

// find min max of the alpha channel
export const minMaxAlphaTemplate: BinOpTemplate = {
  elementSize: 8,
  outputStruct: "min: f32, max: f32,",
  inputStruct: "min: f32, max: f32,",
  flatMapOp: "return Output(min(a.min, b.min), max(a.max, b.max));",
  identityOp: "return Output(1e38, -1e38);",
  inputOp: "return Output(a.min, a.max);", // assumes Input is a struct with min and max
  pureOp: `
    if (a > 0.0) {
        return Output(a, a);
    } else {
        return identityOp();
    }
    `
};
