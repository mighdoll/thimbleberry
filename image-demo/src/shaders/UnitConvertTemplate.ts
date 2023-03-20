import { ConvertTemplate } from "thimbleberry/shader-util";

// following Garcia-Lamont et al. 2018
export const u32ToFloat32UnitLength: ConvertTemplate = {
  srcComponentType: "u32",
  srcTextureType: "texture_2d<u32>",
  destFormat: "rgba32float",
  destComponentType: "f32",
  processTexel: `
  let t = vec4<f32>(f32(texel.r), f32(texel.g), f32(texel.b), f32(texel.a));
  let length = sqrt(t.r * t.r + t.g * t.g + t.b * t.b);
  let normalized = t / length;
  let result = vec4(normalized.rgb, length); // we overwrite alpha with the vector length
  return result;
  `,
};

export const f32ToFloat32UnitLength: ConvertTemplate = {
  ...u32ToFloat32UnitLength,
  srcComponentType: "f32",
  srcTextureType: "texture_2d<f32>",
};

export const f32ExternalToFloat32UnitLength: ConvertTemplate = {
  ...f32ToFloat32UnitLength,
  srcTextureType: "texture_external",
};
