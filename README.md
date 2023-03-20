**Thimbleberry**

Thimbleberry is a collection of reusable WebGPU shaders and library support functions.

- Thimbleberry approaches some of the practical engineering problems that come up in writing WebGPU programs: modularization, debugging, testing, performance tracking, templating, resource cleanup, etc.

- Thimbleberry also includes some sample shaders that might be useful for you: reduce, prefix scan, histogram equalization, etc.

- A demo image processing app using Thimbleberry is available at [https://thimbleberry.dev](https://thimbleberry.dev). 

It’s early days in WebGPU land. 
I hope the ideas in Thimbleberry will help you along as you get started with WebGPU. 
Have you discovered some handy approaches to putting together browser WebGPU programs?
I hope you’ll share your ideas. 
Contributions are welcome.

**Utilities**

- [Utilities Introduction](./doc/Utilities.md)
- [Debug Logging / Testing](./doc/Utilities.md#Debug-logging--testing)
- [Shader Components](./doc/Utilities.md#Shader-Components)
- [Reactively](./doc/Utilities.md#Reactively)
- [Resource Management](./doc/Utilities.md#Resource-Management)
- [Caching Compiled Shaders](./doc/Utilities.md#Caching-Compiled-Shaders)
- [WGSL templates](./doc/Utilities.md#WGSL-templates)
- [GPU Performance Reports](./doc/Utilities.md#CPU-Performance-Reports)
- [Cypress Component Tests](./doc/Utilities.md#Cypress-Component-Tests)

**Image Transformer Demo App**

- [Adding an Image Transform](./doc/Image-Transforms.md)

**Sample Shaders**

- [reduce-buffer](./src/reduce-buffer/) - Reduce a buffer to a single value (e.g. min, max, or sum).
- [reduce-texture](./src/reduce-texture/) - Reduce a texture to a single value. 
Uses reduce-buffer internally for larger textures.
- [prefix-scan](./src/prefix-scan/) - Useful for many purposes including radix sorts and histogram equalization.
(Also called prefix sum or parallel scan.) 
- [convert-texture](./src/convert-texture/) - Template based conversion, e.g. for converting RGB to HSV.
