import { HasReactive, reactively } from "@reactively/decorate";
import deepEqual from "fast-deep-equal";
import {
  assignParams,
  ValueOrFn,
  placeholderTexture,
  reactiveTrackUse,
  ShaderGroup,
  trackContext,
  Vec2,
} from "thimbleberry/shader-util";
import { ImageShaderComponent } from "./ImagePlugins";

export interface ImageChainParams {
  device: GPUDevice;
  srcTexture?: ValueOrFn<GPUTexture | GPUExternalTexture>;
  srcSize?: ValueOrFn<Vec2>;
  destTexture?: ValueOrFn<GPUTexture>;
}

/** 
 * Chain execution of a series of ImageShaderComponents.
 * 
 * The caller calls dispatch() with the src and dest textures for the entire chain.
 * Intermediate textures are interspersed between the components as necessary.
 */
export class ImageChain extends HasReactive {
  private device!: GPUDevice;
  @reactively({ equals: deepEqual }) components: ImageShaderComponent[] = [];
  @reactively srcTexture!: GPUTexture | GPUExternalTexture;
  @reactively({ equals: deepEqual }) srcSize!: Vec2;
  @reactively destTexture!: GPUTexture;

  private usageContext = trackContext();

  constructor(params: ImageChainParams) {
    super();

    const defaults: Partial<ImageChainParams> = {
      srcTexture: params.srcTexture || placeholderTexture(params.device),
      destTexture: params.destTexture || placeholderTexture(params.device),
      srcSize: [50, 50] as Vec2,
    };

    assignParams<ImageChain>(this, params, defaults);
  }

  destroy(): void {
    this.usageContext.finish();
  }

  dispatch(): void {
    this.stitchChain();
    this.shaderGroup.dispatch();
  }

  @reactively private stitchChain(): void {
    const components = this.components;
    // first and last components use external src and dest
    const first = components.slice(0, 1)[0];
    const last = components.slice(-1)[0];
    first && (first.srcTexture = this.srcTexture);
    last && (last.destTexture = this.destTexture);

    // intermediate components use temp textures
    components.slice(0, -1).forEach((c, i) => {
      if (i % 2 === 0) {
        c.destTexture = this.intermediate1;
      } else {
        c.destTexture = this.intermediate2;
      }
    });
    components.slice(1).forEach((c, i) => {
      if (i % 2 === 0) {
        c.srcTexture = this.intermediate1;
      } else {
        c.srcTexture = this.intermediate2;
      }
    });

    components.forEach((c) => (c.srcSize = this.srcSize));
  }

  @reactively private get shaderGroup(): ShaderGroup {
    return new ShaderGroup(this.device, ...this.components);
  }

  @reactively private get intermediate1(): GPUTexture {
    return this.makeIntermediate("intermediate-1");
  }

  @reactively private get intermediate2(): GPUTexture {
    return this.makeIntermediate("intermediate-2");
  }

  private makeIntermediate(label: string): GPUTexture {
    const tex = this.device.createTexture({
      label: `ImageChain ${label}`,
      size: [this.destTexture.width, this.destTexture.height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING,
    });
    reactiveTrackUse(tex, this.usageContext);
    return tex;
  }
}
