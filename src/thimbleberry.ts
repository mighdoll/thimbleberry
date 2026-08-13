// The main entry point. Matches `build`, which bundles shader-util into
// dist/thimbleberry.js. The shaders are published separately as
// `thimbleberry/shaders`, built by `build:shaders`.
//
// Use an explicit /index.js path: dist/shaders.js (the shaders bundle) sits
// next to the dist/shaders/ declarations, and a bare "./shader-util" style
// import would let a sibling .js file shadow the directory.
export * from "./shader-util/index.js";
