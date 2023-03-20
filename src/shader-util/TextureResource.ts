/** return a resource entry for binding to either a gpu texture or an external texture.  */
export function textureResource(
  src?: GPUTexture | GPUExternalTexture
): GPUTextureView | GPUExternalTexture {
  if (src instanceof GPUTexture) {
    return src.createView({
      label: `view ${src.label}`
    });
  } else if (src instanceof GPUExternalTexture) {
    return src;
  } else {
    throw new Error("provide an externalSrc or a srcTexture");
  }
}
