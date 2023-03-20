import { renderAttachable } from "./TextureFormats";

export async function textureFromImageUrl(
  device: GPUDevice,
  url: string,
  format?: GPUTextureFormat,
  gpuUsage?: GPUTextureUsageFlags
): Promise<GPUTexture> {
  const response = await fetch(url);
  const blob = await response.blob();
  const imgBitmap = await createImageBitmap(blob);

  // TODO: resource cleanup
  return bitmapToTexture(device, imgBitmap, format, gpuUsage, url);
}

export function bitmapToTexture(
  device: GPUDevice,
  source: ImageBitmap,
  format?: GPUTextureFormat,
  gpuUsage?: GPUTextureUsageFlags,
  label?: string
): GPUTexture {
  const resolvedFormat = format || navigator.gpu.getPreferredCanvasFormat();

  let usage: GPUTextureUsageFlags;
  if (gpuUsage) {
    usage = gpuUsage;
  } else {
    usage =
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC;
    if (renderAttachable(resolvedFormat)) {
      usage |= GPUTextureUsage.RENDER_ATTACHMENT;
    }
  }

  const textureDescriptor: GPUTextureDescriptor = {
    size: { width: source.width, height: source.height },
    format: resolvedFormat,
    usage,
    label
  };
  const texture = device.createTexture(textureDescriptor);

  device.queue.copyExternalImageToTexture(
    { source },
    { texture },
    textureDescriptor.size
  );

  return texture;
}
