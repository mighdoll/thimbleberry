import { memoMemo } from "./MemoMemo";

/** a default texture, in case a user doesn't provided an expected texture to a shader. */
export const placeholderTexture = memoMemo(makePlaceholderTexture);

export function makePlaceholderTexture(device: GPUDevice): GPUTexture {
  return device.createTexture({
    label: "placeholder texture",
    size: [50, 50],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC
  });
}
