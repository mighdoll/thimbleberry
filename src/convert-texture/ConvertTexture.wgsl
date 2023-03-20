//
// Convert a texture from one format to another. 
// Template substitution is used to compile for different source and destination formats,
// convert color spaces, etc.
//

// source texture 
@group(0) @binding(1) var srcTexture: texture_2d<f32>; //! texture_2d<f32>=srcTextureType 

// dest texture 
@group(0) @binding(2) var dstTexture: texture_storage_2d<r32float, write>; //! r32float=destFormat

@group(0) @binding(11) var<storage, read_write> debug: array<f32>; // buffer to hold debug values

@compute
@workgroup_size(1,1,1)
fn convertTexture(
    @builtin(global_invocation_id) grid: vec3<u32>,    // coords in the global compute grid, one per block
) {
    let texel = textureLoad(srcTexture, vec2<i32>(grid.xy), 0);  //! ", 0"=loadLevel
    let result = processTexel(texel);
    textureStore(dstTexture, vec2<i32>(grid.xy), vec4(result));
}

// typically overriden by a template
fn processTexel(texel: vec4<f32>) -> vec4<f32> { //! f32=srcComponentType f32=destComponentType 
    return vec4(texel.r); //! "return vec4(texel.r);"=processTexel
}