WebGPU gives web developers flexible ways to use the crazy high performance parallel power of GPUs. GPU programs on the web are no longer trapped inside one canvas! 

But sharing WebGPU resources between multiple parts of a web application can be tricky to manage. When do you build WebGPU buffers and shaders? When do you update? When do you release old GPU resources? In a web page with shared GPU resources, resource management is complicated.

One good approach is to use a fine grained reactivity library. Fine grained reactivity is helping web developers to manage the costs of updating the DOM and wrangle the complexity of update logic. Similarly, fine grained reactivity can help WebGPU developers deal with the costs and complexity of managing GPU resources.

* [Fine Grained Reactivity for HTML](#fine-grained-reactivity-for-html)
* [WebGPU Resource Management](#webgpu-resource-management)
* [Reactively for WebGPU](#reactively-for-webgpu)
  * [Resource Reallocation](#resource-reallocation)
  * [Caching](#caching)
  * [Dependency Tracking ](#dependency-tracking)
  * [Lazy Recalculation](#lazy-recalculation)
  * [Resource Cleanup](#resource-cleanup)
  * [Challenges](#challenges-when-using-reactivity-for-webgpu)
* [Summary](#summary)
* [Status](#status)

First, a bit of background on fine grained reactivity.

## Fine Grained Reactivity for HTML
The challenge: updating the HTML DOM is expensive, and the reasons to update are complicated. Update too often and the app is slow. Update too little and the app looks buggy. And long chains of logic to decide when to update are hard to maintain.

The fine grained reactivity approach is declarative. The fine grained reactivity libraries have a lightweight way to _declare_ reactive elements, and then the libraries automatically track dependencies between reactive elements. The declarations are easy to maintain, and the app code doesn't need update logic at all. The library handles update logic by itself, by [cleverly evaluating][evaluating] the reactive graph implied by the reactive element dependencies. The 'fine grained' category of these libraries indicates that reactivity applies to JavaScript and TypeScript variables and functions. 'Fine grained' libraries differ from more 'coarse grained' libraries where reactivity only applies to larger entities like components or modules.

Significant parts of the web dev community are moving to fine grained reactivity to meet the challenge of creating modern dynamic HTML. Note that fine grained reactive libraries are sometimes called Signal libraries. Libraries like [Reactively], [Preact Signals], [Angular Signals], [SolidJs], and [Vue Signals][vue] are examples of this trend.

The fine grained reactive libraries provide three key features: laziness, caching, and smart recalculation. The feature set makes for good performance because they allow apps to avoid expensive DOM manipulation except when strictly necessary. And the fine grained reactive libraries make web development easier because they offload apps from most of the logic of deciding when to update. The new generation of fine grained reactivity libraries is easy to adopt too, with short APIs and only a few KB of code.

Of course, lazy variables or clever recalculation schemes aren't new ideas. Functional reactive programmers and even spreadsheet users have used those ideas for many years. The ideas are not new on the web ([vue], [elm]), and the ideas have been explored in the research community ([flapjax], [fran], [deprecating], [incremental]). But fine grained reactively is becoming increasingly mainstream on the web partly due to an inspiring new generation of [lighter and faster][evaluating] implementations and partly due to the untiring explanations from advocates like [Ryan].

## WebGPU Resource Management 
Like the browser's HTML DOM, WebGPU resources are expensive to update, and the reasons to update can be similarly complicated.

WebGPU resources are very demanding in terms of CPU time and memory use. WebGPU shader programs are compiled, and compilation is relatively slow. Best not to compile them too much. WebGPU buffers and textures are often large. Best not to allocate them unnecessarily. GPU memory is limited and relatively inflexible. For example, GPUBuffers, the workhorse storage elements for WebGPU programs,
don't grow and shrink automatically like JavaScript/TypeScript arrays. You need to allocate a new buffer if you need more storage. Best not to reallocate all the time though, lest your fancy parallel GPU spend all its time waiting for buffer copying.

So for performance reasons, just as web developers need to avoid constantly changing the DOM, WebGPU developers need to avoid constantly building and rebuilding GPU resources.

WebGPU programs and resources can naturally support multiple canvases. Imagine dashboards, simulations, interactive documents, etc. And WebGPU can easily serve as a compute engine with perhaps no graphics at all. The key flexibility is that WebGPU shaders, buffers and textures can be dynamically shared by multiple different parts of the main JavaScript/TypeScript/HTML app. Taking advantage of this flexibility leads to more complex internal interdependencies between program elements.

A dynamic multipart page like a dashboard or an interactive document using WebGPU may have a complicated set of code and data dependencies that can trigger an update to the GPU resources, just like a complicated web page may have complicated reasons to update the HTML.

That's the analogy between WebGPU development and web development. WebGPU resource updates are expensive and update logic is complex. It's structurally the same problem as HTML DOM updates for a web framework.

Let's see how we can apply a web development style solution to WebGPU by using a fine grained reactivity library to manage WebGPU resources.

## Reactively for WebGPU
To explore fine grained reactivity for WebGPU, we'll use the [Reactively] library by [modderme123]. It's fast and small and was originally designed to be independent of any particular web framework. (That said, [Reactively] adapters for [Lit] are already available, and [SolidJS] is planning to adopt [Reactively] in their 2.0 release.)

The code samples below are from the Mosaic tiling plugin in the [Thimbleberry] image transform demo. In the Mosaic transform, the destination image is filled with polygonal tiles
where the color of each tile is sampled from the source image.
<img width="800" alt="user interface showing bird picture and mosaic tile version of bird picture" src="https://user-images.githubusercontent.com/63816/229271188-83148124-8b5f-4aa9-994b-9ebcb2498c7e.png">

The user can specify the size and shape of the mosaic tiles in a control panel:

<img width="150" height="256" alt="user interface control panel" src="https://user-images.githubusercontent.com/63816/230548292-21d3f35a-aba3-4035-85bb-5769663fa28a.png">


### Resource Reallocation
Let's look at how to manage the vertex buffer for the Mosaic shader with [Reactively].

The vertex buffer is a suitable candidate for fine grained reactivity because the buffer will need to be updated in response to a complex set of user actions, and it's expensive to update. Our GPU will stall waiting on the CPU every time we update this buffer, so we'd rather not update the buffer too often, especially because we might be pretty busy processing video at 60 frames per second.

A variety of user actions on the control panel might change the tile vertices and require that we update the vertex buffer. Our goal is to update the buffer only if one of the user actions forces a change. We could maintain a list of 'dirtying' user actions, but that sounds tedious and hard to maintain. Every time we add a new tiling feature, we'll have to take care to revise our update logic too.

Let's see how fine grained reactivity manages the update problem more simply. Here's the routine that allocates the vertex buffer:

```ts
  @reactively private get vertexBuffer(): GPUBuffer {
    const verts = this.shapeVerts;
    const usage = GPUBufferUsage.VERTEX;
    const buffer = filledGPUBuffer(this.device, verts, usage, "mosaic-verts");
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }
```

The key trick is simply adding `@reactively` annotations. The annotation turns on the fine grained reactivity features of dependency tracking, caching, and lazy recalculation for this method. 

### Caching
While processing a video stream, the `GPUBuffer` will be needed on every frame and so the `vertexBuffer` getter will be called on every frame. That sounds expensive. But we're ok. The `@reactively` annotation gives us caching automatically, so the getter body will only be called on the first frame. Subsequent calls will return a cached value without executing the code in the method body.

### Dependency Tracking 
But what if the vertices change? What if the user changes the shape and number of the tiles while the video is playing? In that case, we will need to update the buffer. [Reactively] can handle that situation automatically. [Reactively] tracks dependencies and will re-execute the body of the getter if the dependencies change, `vertexBuffer` will create a new `GPUBuffer` as required. In this case, `shapeVerts` might change if the user changes the size and shape of the mosaic tiles in the control panel and then it would be appropriate to rebuild the GPUBuffer for new vertices for the next rendered frame.

So that `shapeVerts` is reactively tracked, we mark it `@reactively` too:
```ts
  @reactively private get shapeVerts(): number[] {
    const window = this.destSize;
    const [xt, yt] = this.mosaicSize.map((tile, i) => tile / window[i]);

    const scaledVertsNDC = this.rawVerts.map(([x, y]) => [x * xt, y * yt]);
    return scaledVertsNDC.flat();
  }
```

And we similarly annotate `rawVerts`, `mosaicSize`, and `destSize` with `@reactively`. For example, here we annotate the `mosaicSize` property:
```ts
  @reactively({ equals: deepEqual }) mosaicSize!: Vec2;
```
We use `deepEqual` so that reactive checking uses `mosaicSize` array contents, rather than the array identity. 

[Reactively] automatically detects that `shapeVerts` depends on `mosaicSize` and that `vertexBuffer` depends on `shapeVerts`. That is, just from the `@reactively` annotations, [Reactively] detects the dependency relationships:

<img width="465" alt="flowchart showing connections between the reactive variables" src="https://user-images.githubusercontent.com/63816/230543686-469f61a5-0b61-4d2a-b1df-8b8318250fdb.png">


### Lazy Recalculation
When the user changes the tile size in the control panel, the event handler modifies `mosaicSize`. When the application next asks for `vertexBuffer`, [Reactively] will automatically re-execute the function bodies of `shapeVerts` and `vertexBuffer`.

<img width="466" alt="flowchart with reactive variables, highlighting dirty chain from mosaicSize to shapeVerts to vertexBuffer" src="https://user-images.githubusercontent.com/63816/230543818-0b75c946-db7e-4fd8-9b9b-d0460778d19b.png">


### Resource Cleanup
After we create a new buffer for newly changed vertices, what happens to the old GPUBuffer? We could hope that garbage collection will clean up, and it will, eventually. But GPU resources can be large, and garbage collection is uncertain, so WebGPU provides a `destroy()` method on `GPUBuffer` and similar resources to reclaim their memory without delay. Let's make sure we call `destroy()` on unneeded vertex buffers. The fine grained reactivity libraries all include some variation of a cleanup API that we can leverage to handle `destroy` in WebGPU.

The key line in the `vertexBuffer()` body above is this one: 
```
reactiveTrackUse(buffer, this.usageContext);
```
`reactiveTrackUse` uses [Reactively]'s `onCleanup()` method to register a callback when the getter is re-run. That's a perfect time to release the old buffer. And in fact, `reactiveTrackUse` typically will destroy() the old buffer immediately. Under the hood, `reactiveTrackUse` tries to be a little more clever. It uses [Thimbleberry][thimb-src]'s `trackUse` reference counting utility which will defer calling `destroy()` in the case where the buffer is still in some other part of our application.

Here's `reactiveTrackUse`:
```ts
/** (for use within reactively reaction).
 * Track a destroyable resource and release the resource if the reaction reruns */
export function reactiveTrackUse(target: HasDestroy, context: TrackContext): void {
  trackUse(target, context);
  onCleanup(() => trackRelease(target, context));
}
```

### Challenges when Using Reactivity for WebGPU
Relying on laziness and dependency tracking takes a different perspective, but we've really made very few code changes, mostly just adding a few annotations to reap significant benefits. While it's a win overall, using [Reactively] for WebGPU brings some challenges.

First, reactivity tends to be contagious. Because reactive functions only track dependencies with other reactive elements, it quickly becomes tempting to make more and more things reactive. Web programmers who use `Promise`s will be familiar with the similar 'function coloring' problem of mixing async and synchronous code. Reactivity is quite lightweight, so there's not much cost in adding a few more reactive elements. But when adding reactivity to an existing code base, it's worthwhile to think a bit about where the boundaries should lie.

Second, there's little compile time support for checking that reactivity is correct. If you forget to mark something as reactive, no type error or lint rule is likely to warn you. Of course, there's no compile time support if we try to write update logic with traditional imperative code. But the possibility of linting or type checking is clear when reactivity is declarative. React's linter, for example, provides warnings for their coarse grained reactivity system. I expect that compile time support for fine grained reactivity tools will improve as web frameworks with compilation and lint tools develop further.

Finally, lazy execution means giving up some control of exactly when your code runs. As with using a web framework, that can make debugging a bit harder. Execution in these small fine grained reactivity libraries isn't that complicated, but I expect to see debugging tools appear to help identify cases of missing dependencies or unexpected cache misses.

Note that while the example code in this post uses decorators and Typescript classes, [Reactively] works equally well with a more functional style.

#### Reactively tips
The lazy recalculation feature is useful even for methods that don't return a value.
For example, I typically mark `@reactively` on a `writeUniforms(): void` 
method that copies over uniforms data from the CPU to the GPU. 
If the source data hasn't changed, [Reactively] will automatically skip the copy.

To make dependency tracking work, note that it's important to 
also mark the related properties with `@reactively`
so that changes to those properties can be tracked by the reactive system. 
If allocation depends on `size`, both the allocator and the `size` property should be marked.

Passing `@reactively` tracked values between classes and modules works fine, but
to preserve reactive change tracking,
share an access function instead of the raw value.
e.g. to share `myObj.srcTexture`,
share as `{srcParam: () => myObj.srcTexture}`.

### Summary
With fine grained reactively, GPU resources are rebuilt when necessary and no more. Caching, dependency tracking, and smart recalculation come more or less for free, we don't need to write and maintain separate logic for dirty checking, and eager resource destruction is easier to manage.

Here's a more complete look at the dependencies in the Mosaic shader:
<img width="1338" alt="image" src="https://user-images.githubusercontent.com/63816/230544196-a0b69a85-8c67-47e7-b563-32d08d601d91.png">

We could work out the logic to update the GPU resources and write the update code manually, but it's easier to just add a few annotations and let the library handle it.

The fine grained reactivity libraries built for general web development turn out to be very useful for WebGPU too.

### Status
WebGPU is available in preview releases of Chrome and Firefox today. General release in Chromium based browsers is coming by summer, with Firefox soon to follow. You can try mixing WebGPU and reactivity right now if you use Chrome Canary. The demo site using this example Mosaic shader is available here: [thimbleberry] ([src][thimb-src]).


[reactively]: https://github.com/modderme123/reactively
[preact signals]: https://preactjs.com/guide/v10/signals/
[angular signals]: https://github.com/angular/angular/tree/main/packages/core/src/signals
[fine grained reactivity]: https://dev.to/ryansolid/a-hands-on-introduction-to-fine-grained-reactivity-3ndf
[vue]: https://vuejs.org/guide/extras/reactivity-in-depth.html
[evaluating]: https://dev.to/modderme123/super-charging-fine-grained-reactive-performance-47ph
[flapjax]: https://www.flapjax-lang.org/
[fran]: http://conal.net/papers/icfp97/
[deprecating]: https://infoscience.epfl.ch/record/148043?ln=en
[ryan]: https://www.youtube.com/watch?v=g584AIL1HtI
[elm]: https://elm-lang.org/docs/advanced-topics#functional-reactive-programming
[incremental]: https://www.umut-acar.org/self-adjusting-computation
[solidjs]: https://www.solidjs.com/ 
[thimbleberry]: https://thimbleberry.dev
[thimb-src]: https://github.com/mighdoll/thimbleberry
[lit]: https://lit.dev
[modderme123]: https://moddermeht.ml

