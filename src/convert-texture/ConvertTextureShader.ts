import { HasReactive, reactively } from "@reactively/decorate";
import { dsert } from "berry-pretty";
import deepEqual from "fast-deep-equal";
import { ConvertTemplate } from "../shader-util/ConvertTemplate";
import { createDebugBuffer } from "../shader-util/CreateDebugBuffer";
import { gpuTiming } from "../shader-util/GpuPerf";
import {
  assignParams,
  ValueOrFn,
  reactiveTrackUse
} from "../shader-util/ReactiveUtil";
import { ComposableShader } from "../shader-util/ComposableShader";
import { textureSampleType } from "../shader-util/TextureFormats";
import { textureResource } from "../shader-util/TextureResource";
import { trackContext } from "../shader-util/TrackUse";
import { Vec2 } from "../shader-util/Vec";
import { Cache } from "./../shader-util/MemoMemo";
import { getConvertTexturePipeline } from "./ConvertTexturePipeline";

export interface ConvertTextureParams {
  device: GPUDevice;
  srcTexture: ValueOrFn<GPUTexture | GPUExternalTexture>;
  destTexture: ValueOrFn<GPUTexture>;
  template: ValueOrFn<ConvertTemplate>;
  pipelineCache?: <T extends object>() => Cache<T>;
}

const defaults: Partial<ConvertTextureParams> = {
  srcTexture: undefined,
  pipelineCache: undefined
};

/** 
 * A simple shader that copies an input to an output texture
 * 
 * The conversion is guided by a template, so the shader can be parameterized 
 * to convert between different WebGPU texture formats, and perform simple 
 * transformations like color space conversion.
 * 
 * Input and output textures must be the same size.
*/
export class ConvertTextureShader extends HasReactive implements ComposableShader {
  @reactively srcTexture?: GPUTexture | GPUExternalTexture;
  @reactively destTexture!: GPUTexture;
  @reactively template!: ConvertTemplate;

  private pipelineCache?: () => Cache<any>;
  private device!: GPUDevice;
  private usageContext = trackContext();

  constructor(params: ConvertTextureParams) {
    super();
    assignParams<ConvertTextureShader>(this, params, defaults);
  }

  commands(commandEncoder: GPUCommandEncoder): void {
    const timestampWrites = gpuTiming?.timestampWrites("convertTexture");
    const passEncoder = commandEncoder.beginComputePass({ timestampWrites });
    passEncoder.label = "convertTexture pass";
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.dispatchWorkgroups(...this.dispatchSize);
    passEncoder.end();
  }

  destroy(): void {
    this.usageContext.finish();
  }

  @reactively get debugBuffer(): GPUBuffer {
    const buffer = createDebugBuffer(this.device, "TextureReduce debug");
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  @reactively({ equals: deepEqual }) get dispatchSize(): Vec2 {
    const destSize = [this.destTexture.width, this.destTexture.height] as Vec2;
    if (this.srcTexture instanceof GPUTexture) {
      const src = this.srcTexture as GPUTexture;
      const srcSize = [src.width, src.height] as Vec2;
      dsert(
        srcSize[0] === destSize[0] && srcSize[1] === destSize[1],
        "src and dest textures must have same size"
      );
      // dlog({ srcSize, destSize });
    }
    return destSize;
  }

  @reactively get srcSampleType(): GPUTextureSampleType {
    if (this.srcTexture instanceof GPUTexture) {
      return textureSampleType(this.srcTexture.format);
    } else {
      // TODO per spec, always float. Should it be unfilterable?
      return "unfilterable-float";
    }
  }

  @reactively get pipeline(): GPUComputePipeline {
    return getConvertTexturePipeline(
      {
        device: this.device,
        srcSampleType: this.srcSampleType,
        template: this.template
      },
      this.pipelineCache
    );
  }

  @reactively private get bindGroup(): GPUBindGroup {
    const srcResource = textureResource(this.srcTexture);

    const destView = this.destTexture.createView({
      label: "convert texture dest view"
    });
    return this.device.createBindGroup({
      label: "convertTexture binding",
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 1, resource: srcResource },
        { binding: 2, resource: destView },
        { binding: 11, resource: { buffer: this.debugBuffer } }
      ]
    });
  }
}
