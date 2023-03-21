// draw antialized circles
//
// The color of each shape is determined by sampling the source texture in the center of the circle
//

struct Uniforms {
  backgroundColor: vec4<f32>,    // background color to use when antialiasing
  innerRadius: f32,             // unfeathered part of the radius in pixels
  feather: f32                 // antialias width in pixels
}

struct VertexOutput {
  @builtin(position) spot: vec4<f32>,
  @location(0) @interpolate(flat) color: vec4<f32>,
  @location(1) distanceToCenter: f32, // pixel distance to center of circle
}

@group(0) @binding(0) var<uniform> u:Uniforms;
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

    if xy.x == 0.0 && xy.y == 0.0 {
        out.distanceToCenter = 0.0;
    } else {
        out.distanceToCenter = u.feather + u.innerRadius;
    }
    return out;
}

@fragment 
fn fragMain(
    @builtin(position) fbSpot: vec4<f32>,
    @location(0) @interpolate(flat) color: vec4<f32>,
    @location(1) distanceToCenter: f32
) -> @location(0) vec4<f32> {

    if distanceToCenter > u.innerRadius && u.feather > 0.0 {
        var blend = 1.0 - (distanceToCenter - u.innerRadius) / u.feather;
        blend *= color.a;
        var outColor = blend * color.rgb + (1.0 - blend) * u.backgroundColor.rgb;
        return vec4(outColor, 1.0);
    } else {
        return color;
    }
}