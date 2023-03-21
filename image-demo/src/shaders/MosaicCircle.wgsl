// draw antialized circles
//
// The color of each shape is determined by sampling the source texture in the same location

struct Uniforms {
  innerRadius: f32, // unfeathered radius in pixels
  feather: f32  // antialias width in pixels
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
    var blend = 1.0;

    if distanceToCenter > u.innerRadius && u.feather > 0.0 {
        blend -= (distanceToCenter - u.innerRadius) / u.feather;
    }
    blend *= color.a;
    // if fbSpot.y == 0.5 && fbSpot.x == 1.5 {
    //     debug[0] = fbSpot.x;
    //     debug[1] = fbSpot.y;
    //     debug[2] = distanceToCenter;
    //     debug[3] = blend;
    //     debug[4] = u.feather;
    //     debug[5] = u.radius;
    //     debug[6] = 99.0;
    //     debug[7] = color.r;
    //     debug[8] = color.g;
    //     debug[9] = color.b;
    //     debug[10] = color.a;
    // }

    return vec4(color.rgb * blend, 1.0); 
}