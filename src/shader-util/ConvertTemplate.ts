import { SampledTextureType2D } from "./TextureFormats";
/** templates for the ConvertTexture shader */
export interface ConvertTemplate {
  srcComponentType: string;
  destComponentType: string;
  destFormat: GPUTextureFormat;
  processTexel: string;
  srcTextureType: SampledTextureType2D;
}

export const rgbaFloatRedToFloat: ConvertTemplate = {
  srcTextureType: "texture_2d<f32>",
  srcComponentType: "f32",
  destFormat: "r32float",
  destComponentType: "f32",
  processTexel: "return vec4(texel.r * 255.0, 0.0, 0.0, 0.0);"
};

export const rgbaUintRedToFloat: ConvertTemplate = {
  srcComponentType: "u32",
  srcTextureType: "texture_2d<u32>",
  destFormat: "r32float",
  destComponentType: "f32",
  processTexel: "return vec4(f32(texel.r), 0.0, 0.0, 0.0);"
};
