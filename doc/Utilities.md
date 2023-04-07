# Thimbleberry WebGPU Utilities

[shaders]: https://github.com/mighdoll/thimbleberry/tree/main/src
[app shaders]: https://github.com/mighdoll/thimbleberry/tree/main/image-demo/src/shaders

Thimbleberry utilities offer support for writing WebGPU applications and WGSL shaders
for the browser.

Note that the Thimbleberry utility modules are generally independent of each other.
Feel free to pick and choose the ones that are useful for you.

You can see examples in the thimbleberry source of [shaders][], [app shaders][]
and [shader tests][component-test] using most of the Thimbleberry utilities.

Contents:

- [Debug Logging / Testing](#Debug-logging--testing)
- [Shader Components](./Utilities.md#Shader-Components)
- [Reactively](./Utilities.md#Reactively)
- [Resource Management](./Utilities.md#Resource-Management)
- [Caching Compiled Shaders](./Utilities.md#Caching-Compiled-Shaders)
- [WGSL templates](./Utilities.md#WGSL-templates)
- [GPU Performance Reports](./Utilities.md#CPU-Performance-Reports)
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

## Shader Components

[shadercomponent]: ../src/shader-util/ShaderComponent.ts

The `ShaderComponent` is a start towards making shaders more modular: [ShaderComponent].
Simply implement the `encodeCommands()` function and then multiple shaders can be dispatched together in a `ShaderGroup`.

I'm interested in evolving `ShaderComponent` to support richer api options.
Suggestions welcome.

The demo image transform app, for example, has
a richer extension called `ImageShaderComponent` that requires a few fields for
input and and output textures.
This enables an `ImageChain` to sequence an arbitrary set of image transforming shaders, interspersing temporary buffers as needed.

`ImageChain` and `ImageShaderComponent` are currently specialized for image processing,
and so they're in the demo app and not in the utility library for now.
I expect we'll find more generic ways to stitch together modular shaders over time.

## Reactively
[Reactively]: https://github.com/modderme123/reactively
[decorate]: https://github.com/modderme123/reactively/tree/main/packages/decorate

The current generation of fine grained reactive (signal) libraries in web
frameworks offers several features that are useful for using the WebGPU API: 
dependency tracking, caching, and lazy recalculation.
I've been using [Reactively], a small, fast and standalone reactive library.
Using Reactively's [decorate] library,
you can mark a property, getter, or method `@reactively`.
Simply marking a property `@reactively` makes that property lazy and cached. 
It also turns on dependency tracking.

GPU resources like textures and buffers are expensive to allocate,
and the conditions that require rebuilding those resources can be complicated to track.
The convenience of a reactive library is a good way to handle GPU resource allocation.
By marking the GPU resource allocation method or getter with `@reactively`,
the resource allocation immediately becomes lazy, 
saving startup time and memory for resources that might not be used for a long time. 

More importantly, those GPUBuffers and GPUTextures 
are rebuilt automatically when necessary. So if the user resizes a canvas, 
the shader wrapper will automatically allocate a larger GPUTexture.

The lazy recalculation feature is useful even for methods that don't return a value.
For example, I typically mark `@reactively` on a `writeUniforms(): void` 
method that copies over uniforms data from the CPU to the GPU. 
If the source data hasn't changed, [Reactively] will automatically skip the copy.

#### Reactively tips
To make dependency tracking work, note that it's important to 
also mark the related properties with `@reactively`
so that changes to those properties can be tracked by the reactive system. 
If allocation depends on `size`, both the allocator and the `size` property should be marked.

Passing `@reactively` tracked values between classes and modules works fine, but
to preserve reactive change tracking,
share an access function instead of the raw value.
e.g. to share `myObj.srcTexture`,
share as `{srcParam: () => myObj.srcTexture}`.

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

For a more involved use of templates, see `ReduceBuffer.wgsl` and `BinOpTemplate.ts`,
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

## GPU Performance Reports

[begincomputepass]: https://www.w3.org/TR/webgpu/#command-encoder-pass-encoding
[beginrenderpass]: https://www.w3.org/TR/webgpu/#command-encoder-pass-encoding

Thimbleberry includes an api for capturing performance timing on the GPU.

`initGpuTiming()` - enable the timing api globally.
After initialization, accessing the api through the global `gpuTiming` variable is convenient.

Thimbleberry offers two methods of capturing GPU timing,
fronting the two APIs available in WebGPU.

- `gpuTiming?.timestampWrites()` - returns part of the descriptor to [beginRenderPass] or
  [beginComputePass] to time a render or compute pass.

  Here's an example:

```
      // if gpu timing is enabled, time this render pass
      const timestampWrites = gpuTiming?.timestampWrites("mosaic");

      const passEncoder = commandEncoder.beginRenderPass({
        label: "Mosaic shader render pass",
        timestampWrites,
      });
```

- `gpuTiming?.span()` - starts timing a set of gpu submissions

  - `span.end()` - end the set

- I recommend using the timestampWrites() API for now.
  Span timing is unreliable on MacOS (though that may be fixed prior to general release of WebGPU). 

For grouping timestamp records (e.g. to capture timing of multiple shaders in a frame), use:

- `withTimestampGroup()` - create a multi-span covering the time from the first
  underlying span to the last underlying span. Note that the group time is not
  the sum of the underlying span times (in the likely case that there are gaps
  or overlaps between the underlying spans).

Use `gpuTiming.results()` to fetch and convert the timing samples from the gpu.

Use `logCsvReport()` to log the gpu timing results to the debug console in tabular form.
The result looks like this:

```
                name,   start, duration
              mosaic,    0.00,     0.13
      convertTexture,    0.13,     0.07
       reduceTexture,    0.21,     0.09
   bufferReduce 2400,    0.30,     0.03
           histogram,    0.34,     1.34
          sourceScan,    1.70,     0.02
     scaleUnitColors,    1.73,     0.05
           gpu-total,    0.00,     1.78
         clock-total,    0.00,     6.50
```

[demo]: https://thimbleberry.dev

The output is in comma-separated-values format,
making the results easy to import into external tools.

Times are in ms. This is from the image transform [demo] running on a Mac M1,
with both 'mosaic' and 'equalize unit histogram' enabled, using the 640x480 webcam as a source.

`gpu-total` is created with `withTimestampGroup()`, and coalesces the underlying gpu timings.
`clock-total` is measured on the cpu and added to the report.

..hmm, looks like the histogram shader is slow in this revision.
It'll be nice to improve it and measure the difference..

_Note that you need to launch the browser with the flag `--disable-dawn-features=disallow_unsafe_apis`
to capture GPU performance metrics._

## Cypress Component Tests

[component-test-util]: https://github.com/mighdoll/thimbleberry/tree/main/cypress/component-test/util
[component-test]: https://github.com/mighdoll/thimbleberry/tree/main/cypress/component-test
[mosaic-cy]: https://github.com/mighdoll/thimbleberry/tree/main/cypress/component-test/Mosaic.cy.ts
[cypress.config.ts]: https://github.com/mighdoll/thimbleberry/tree/main/cypress.config.ts

Cypress component testing is handy way to develop and maintain shaders in a test supported style.
An example cypress configuration is in the Thimbleberry tree.

Thimbleberry includes some useful examples and utilities for Cypress tests.

- The [debug](#debug-logging--testing) functions like `withTextureCopy()` are purpose built for debugging and testing.
- Convenience routines in [component-test/util][component-test-util]
  such as `makeTexture()`, `sequenceTexture()`, `makeBuffer()` are useful for setting up test scenarios.
- Take note of the configuration in [cypress.config.ts], e.g. for setting browser command line arguments.

For examples, take a look at [Mosaic.cy.ts][mosaic-cy] or the other tests in [component-test].

Shader development and debugging is more difficult than typical web programming.
I've found it useful to develop shaders incrementally from small test examples.
Once setup, component testing wtih Vite and Cypress is very handy.
New tests are easy to add.
Tests re-run automatically as you change a file.
And best of all, the development test cycle time is essentially instantaneous.

Cypress is big and can be difficult to configure,
but hopefully these examples will help you.