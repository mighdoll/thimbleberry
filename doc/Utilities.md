[stoneberry]: https://stoneberry.dev

# Thimbleberry WebGPU Utilities

Thimbleberry utilities offer support for writing WebGPU applications and WGSL shaders
for the browser.

Note that the Thimbleberry utility modules are generally independent of each other,
so feel free to pick and choose.
Unused utilities will be automatically removed during application bundling.

Contents:

- [Debug Logging / Testing](#Debug-logging--testing)
- [GPU Performance Reports](./Utilities.md#GPU-Performance-Reports)
- [Shader Components](./Utilities.md#Shader-Components)
- [Resource Management](./Utilities.md#Resource-Management)
- [Caching Compiled Shaders](./Utilities.md#Caching-Compiled-Shaders)
- [WGSL templates](./Utilities.md#WGSL-templates)
- [Reactively](./Utilities.md#Reactively)
- [Cypress Component Tests](./Utilities.md#Cypress-Component-Tests)

## Debug Logging / Testing

Handy utilities for debugging and testing:

- `printBuffer()` - console.log a GPUBuffer
- `printTexture()` - console.log a GPUTexture
- `withBufferCopy()` - copy a GPUBuffer to the cpu for analysis / test validation
- `withTextureCopy()` - copy a GPUTexture to the cpu for analysis / test validation

I've found it useful to iteratively develop shaders by running small examples
and logging or analyzing the results on the CPU. Those small examples then
turn into component integration tests to maintain the shader.

During development, I habitually attach a small 'debug' buffer to each shader
to record a few values from within the wgsl, and then log them with `printBuffer()`.

## GPU Performance Reports

[begincomputepass]: https://www.w3.org/TR/webgpu/#command-encoder-pass-encoding
[beginrenderpass]: https://www.w3.org/TR/webgpu/#command-encoder-pass-encoding

Thimbleberry includes a high level api for benchmarking shaders and reporting results.
The default results look like this:

```
      benchmark,           name,  start,  duration,  runId,            utc
  reduce_simple,   reduce 32768,   0.00,      0.21,     91,  1699900977585
  reduce_simple,     reduce 128,   0.23,      0.01,     91,  1699900977585
  reduce_simple,       reduce 1,   0.25,      0.01,     91,  1699900977585
  reduce_simple,  --> gpu total,  11.23,      0.26,     91,  1699900977585

      benchmark,  avg time / run (ms),  median gpu time (ms),  src GB/sec,  src bytes,            utc
  reduce_simple,                 0.32,                  0.26,       98.58,   33554432,  1699900977585
```

The tabular csv format is designed to be readable in the debug console
and also easy to import into external tools.
Here's an example displaying the benchmarks of some [stoneberry][] shaders:

<img width="900" alt="image" src="https://github.com/mighdoll/thimbleberry/assets/63816/b28987f6-034a-4224-91a4-4f9754f7d626">

Here's an [interactive dashboard](https://public.tableau.com/views/shader-benchmarking/Dashboard)
where you can select the benchmark and shader to visualize.

### To benchmark your shader with `benchRunner`

1. Add a timing trigger to your shader by adding
   `gpuTiming?.timestampWrites("myShader")` to your shader's [beginComputePass][] or [beginRenderPass][].
   You can leave this code in your production shader if you'd like,
   it's a no-op if timing is not enabled.

   ```ts
   // if gpu timing is enabled, time this render pass
   const timestampWrites = gpuTiming?.timestampWrites("myShader");

   const passEncoder = commandEncoder.beginRenderPass({
     label: "myShader",
     timestampWrites,
   });
   ```

1. Write a function that will create an instance of your shader with benchmark data.
   The benchmark function takes a `GPUDevice` as a parameter,
   and returns the size of the benchmark data
   and a function with the signature `commands(gpuCommandEncoder)` that the benchmark runner
   will call to run your shader.

   ```ts
   function myShaderBench(device: GPUDevice): ShaderAndSize {
     const shader = { commands: (encoder: GPUCommandEncoder) => {} };
     return { shader, srcSize: 2 ** 20 };
   }
   ```

1. Pass your shader benchmark function to `benchRunner` from a tiny browser test app.

   ```ts
   async function main(): Promise<void> {
     await benchRunner([{ makeShader: myShaderBench }]);
   }
   ```

[stoneberry-bench]: https://github.com/stoneberry-webgpu/stoneberry/blob/main/packages/bench/src/bench.ts

See [stoneberry-bench][] or [alpenbench](https://github.com/mighdoll/alpenbench)
for open source benchmarking examples using `benchRunner`.

_Note that you need to launch the browser with a flag to capture GPU performance metrics.
In Chromium based browsers, use the command line flag:
`--enable-dawn-features=allow_unsafe_apis` to enable gpu timing.
And to increase reporting accuracy, also pass the flag: `--disable-dawn-features=timestamp_quantization`._

#### BenchRunner Options

Configuration options to control the number of runs and warmups,
numerical precision of output reporting, etc. are optional arguments to the `benchRunner`.
See `ControlParams` for current options.
You can also set options dynamically via url parameters:

```
    http://localhost:5173/?precision=4&reportType=fastest&runs=200
```

#### Preserving results to a file

The `benchRunner` will echo its csv output to a webSocket port
if the url parameter `reportPort` is set.
A websocket listener can then record the results to a file for further
processing, or to track performance differences over time.
See [stoneberry-bench][] for an example of `pnpm bench` and `pnpm bench:dev` commands
that set up a websocket listener.

### Lower Level Timing API

You can use a lower level api for integrating gpu timing and reporting
into applications without using the `benchRunner`.

- Request the feature `'timestamp-query'` when you call `requestDevice` for your `GPUDevice`.

- `initGpuTiming(gpuDevice)` - enables the timing api.
  After initialization, access to the api is available through the global `gpuTiming`.

- `gpuTiming?.timestampWrites()` - returns a partial descriptor for [beginRenderPass] or
  [beginComputePass] that will record timing for the render or compute pass.

- `gpuTiming.results()` to fetch and convert the timing samples from the gpu.

- see `benchRunner`'s `logCsvReport()` to log gpu timing results to the debug
  console in tabular csv format.

For grouping timestamp records (e.g. to capture timing of multiple shaders in a frame), use:

- `withTimestampGroup()` - create a multi-span covering the time from the first
  underlying span to the last underlying span. Note that the group time is not
  the sum of the underlying span times (in the likely case that the GPU
  execution has gaps or overlaps when executing the underlying shaders).
## Shader Components

[shadercomponent]: ../src/shader-util/ShaderComponent.ts

The `ShaderComponent` is a start towards making shaders more modular: [ShaderComponent].
Simply implement the `commands()` function and then multiple shaders can be dispatched together in a `ShaderGroup`.

## WGSL templates

[wgsl-analzyer]: https://marketplace.visualstudio.com/items?itemName=wgsl-analyzer.wgsl-analyzer

A simple text substitution macro facility is a typical way of adding some
richness to low level languages, and it's a useful way to extend WGSL.
If two shaders differ only because one binds a `texture_2d` and the other binds
a `texture_external`, a text substitution template can capture the small difference
without making the programmer rewrite the entire shader.

There are many javascript/typescript string templating systems,
but they conflict with syntax aware editing for WGSL.
And there is already at least one promising WGSL editor for vscode: [wgsl-analzyer].
It offers type hints, formatting, typechecking, etc.

Thimbleberry offers a simple templating system that's designed to fit inside WGSL comments
so that WGSL syntax editors can parse the code without tripping over a template
syntax.
The idea is to write one version of the WGSL code normally
and then to add specially formatted comments to describe template substitution patterns.
Here's how it looks:

```
@group(0) @binding(1) var srcTexture: texture_2d<f32>; //! texture_2d<f32>=srcTextureType
```

The template rules are expressed as comments with the `//!` prefix.
In this case, the system will replace the src text "texture_2d<f32>"
with the contents of the srcTextureType template variable.

See `applyTemplate()` for details of the template syntax.

For a more involved use of templates, see for example `ReduceBuffer.wgsl`
and `BinOpTemplate.ts` in [stoneberry][],
which use templates to make a generic reduction shader that can support
arbitrary binary operations (min, max, sum).

## Resource Management

WebGPU resources like textures and buffers are expensive,
and garbage collection is uncertain.
To free GPU resources more directly, Thimbleberry offers utilities
for reference counting destroyable resources.

- basic usage tracking

  - `trackUse()` when a resource is in use
  - `trackRelease()` when a resource is not used (it's destroyed when all users call release())

- grouping tracked resources

  - `trackContext()` to identify a group of resources
    - `.finish()` to release an entire group of resources

- scoped usage tracking

  - `withUsage()` to temporarily use a resource with a function
  - `withAsyncUsage()` to temporarily use a resource with an async function

- reactive usage tracking

  - `reactiveTrackUse()` for reactively users, automatically track and release resources
    (e.g. if a buffer is rebuilt, release the old buffer and track the new one)

- testing
  - `withLeakTrack()` for tests to validate usage tracking

## Caching Compiled Shaders

Shader compilation is notably CPU expensive,
so caching is typically wise.

Thimbleberry provides a typical memoize API,
with a front end specialized for caching shader pipeline constructors.
It's called `memoizeWithDevice()` and it's used for functions
that take a labeled GPUDevice.
The cache is globally persistent by default.
A cache version with weak references is also available:
pass `weakMemoCache()` to the function returned from `memoizeWithDevice()`.

## Reactively

[Reactively]: https://github.com/modderme123/reactively
[decorate]: https://github.com/modderme123/reactively/tree/main/packages/decorate
[decorated]: https://github.com/modderme123/reactively/tree/main/packages/decorate
[Reactivity]: ./Reactivity.md

Reactivity is a handy technique for making flexible WebGPU shaders.
(See [Reactivity][] for a detailed discussion.)
If you'd like to try building your shaders in a
reactive style using [Reactively][] and [decorate][],
there are a couple of useful utilities in Thimbleberry.

- `reactiveTrackUse()` will help with resource cleanup by tracking destroyable
  objects like GPUBuffers. If the resource becomes unused because it was
  replaced dynamically, the old resource will be destroyed.

- `assignParams()` will copy props style argument objects to [Reactively][] [decorated][]
  properties conveniently in one step, and will validate that all properties
  are assigned.

Thimbleberry's other utilities don't depend on reactivity.

## Cypress Component Tests

[component-test]: https://github.com/mighdoll/thimbleberry/tree/main/cypress/component-test
[mosaic-cy]: https://github.com/mighdoll/thimbleberry/tree/main/cypress/component-test/Mosaic.cy.ts
[cypress.config.ts]: https://github.com/mighdoll/thimbleberry/tree/main/cypress.config.ts

Cypress component testing is a handy way to develop and maintain shaders in a test supported style.
An example cypress configuration is in the Thimbleberry tree.

Thimbleberry includes some useful examples and utilities for Cypress tests.

- The [debug](#debug-logging--testing) functions like `withTextureCopy()` are purpose built for debugging and testing.
- Convenience routines in Thimbleberry
  such as `makeTexture()`, `sequenceTexture()`, `makeBuffer()` are useful for setting up test scenarios.
- Take note of the configuration in [cypress.config.ts], e.g. for setting browser command line arguments.

For examples, take a look at [Mosaic.cy.ts][mosaic-cy] or the other tests in [component-test].

Shader development and debugging is more difficult than typical web programming.
I've found it useful to develop shaders incrementally from small test examples.
Once set up, component testing wtih Vite and Cypress is very handy.
New tests are easy to add.
Tests re-run automatically as you change a file.
And best of all, the development test cycle time is essentially instantaneous.

Cypress is big and can be difficult to configure,
but hopefully these examples will help you.
