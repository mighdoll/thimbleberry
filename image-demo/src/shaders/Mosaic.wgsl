// draw repeated shapes to the destination texture. 
//
// The color of each shape is determined by sampling the source texture in the same location

struct VertexOutput {
  @builtin(position) spot: vec4<f32>,
  @location(0) @interpolate(flat) color: vec4<f32>,
}

@group(0) @binding(1) var srcTexture: texture_2d<f32>;  //! texture_2d<f32>=srcTextureType 
@group(0) @binding(11) var<storage, read_write> debug: array<f32>; 

@vertex
fn vertMain(
    @builtin(vertex_index) vertDex: u32,
    @builtin(instance_index) instanceDex: u32,
    @location(0) xy: vec2<f32>,                        // vertex position in [-1,1] coords
    @location(1) instanceCenter: vec2<f32>
) -> VertexOutput {

    let ndcVert = xy + instanceCenter;      // vert in [-1,1] coords

    var out: VertexOutput;
    out.spot = vec4<f32>(ndcVert, 0.0, 1.0);
    let srcSize = vec2<f32>(textureDimensions(srcTexture));
    let centerZeroTop = vec2<f32>(instanceCenter[0], -instanceCenter[1]);
    let uvUnit = (centerZeroTop + 1.0) / 2.0;   // center in [0,1] coords
    let uv = vec2<i32>(uvUnit * srcSize);       // center in [0, size] coords
    out.color = textureLoad(srcTexture, uv, 0);            //! ", 0"=loadLevel
    // LATER baseClampToEdge

    return out;
}

@fragment 
fn fragMain(
    @builtin(position) spot: vec4<f32>,
    @location(0) @interpolate(flat) color: vec4<f32>
) -> @location(0) vec4<f32> {

    return color;
}