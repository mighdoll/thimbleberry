import { HasReactive, reactively } from "@reactively/decorate";
import deepEqual from "fast-deep-equal";
import { BinOpTemplate, maxTemplate } from "../shader-util/BinOpTemplate";
import { createDebugBuffer } from "../shader-util/CreateDebugBuffer";
import { gpuTiming } from "../shader-util/GpuPerf";
import { loadRedComponent, LoadTemplate } from "../shader-util/LoadTemplate";
import { Cache } from "../shader-util/MemoMemo";
import { assignParams, reactiveTrackUse } from "../shader-util/ReactiveUtil";
import { ComposableShader } from "../shader-util/ComposableShader";
import { trackContext } from "../shader-util/TrackUse";
import { Vec2 } from "../shader-util/Vec";
import { getTextureReducePipeline } from "./ReduceTexturePipeline";

export interface TextureReduceParams {
  device: GPUDevice;
  srcTexture: GPUTexture;
  reducedResult: GPUBuffer;
  blockLength: number; // src blocks are fetched in square tiles of this length
  workgroupSize: Vec2;
  dispatchSize: Vec2;
  reduceTemplate: BinOpTemplate;
  loadTemplate: LoadTemplate;
  pipelineCache?: <T extends object>() => Cache<T>;
}

const defaults: Partial<TextureReduceParams> = {
  loadTemplate: loadRedComponent,
  reduceTemplate: maxTemplate,
  pipelineCache: undefined
};

/** 
 * Reduce workgroup sized blocks of a texture to a buffer.
 * 
 * A full reduction typically requires reducing the resulting buffer 
 * twice more to reduce to a single value.
 * 
 * The reduction operation is controlled by template (e.g. min,max);
*/
export class TextureReduceShader extends HasReactive implements ComposableShader {
  @reactively srcTexture!: GPUTexture;
  @reactively({ equals: deepEqual }) dispatchSize!: Vec2;
  @reactively({ equals: deepEqual }) workgroupSize!: Vec2;
  @reactively reducedResult!: GPUBuffer;
  @reactively blockLength!: number;
  @reactively reduceTemplate!: BinOpTemplate;
  @reactively loadTemplate!: LoadTemplate;

  private device!: GPUDevice;
  private pipelineCache?: () => Cache<any>;
  private usageContext = trackContext();

  constructor(params: TextureReduceParams) {
    super();

    assignParams<TextureReduceShader>(this, params, defaults);
  }

  commands(commandEncoder: GPUCommandEncoder): void {
    const { dispatchSize } = this;

    const timestampWrites = gpuTiming?.timestampWrites("reduceTexture"); 
    const passEncoder = commandEncoder.beginComputePass({ timestampWrites });
    passEncoder.label = "textureReduce pass";
    passEncoder.setPipeline(this.pipeline());
    passEncoder.setBindGroup(0, this.bindGroup());
    passEncoder.dispatchWorkgroups(...dispatchSize);
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

  @reactively private pipeline(): GPUComputePipeline {
    return getTextureReducePipeline(
      {
        device: this.device,
        workgroupSize: this.workgroupSize,
        blockLength: this.blockLength,
        reduceTemplate: this.reduceTemplate,
        loadTemplate: this.loadTemplate
      },
      this.pipelineCache
    );
  }

  @reactively private bindGroup(): GPUBindGroup {
    const srcView = this.srcTexture.createView({ label: "texture reduce src view" });
    return this.device.createBindGroup({
      label: "textureReduce binding",
      layout: this.pipeline().getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: srcView },
        { binding: 1, resource: { buffer: this.reducedResult } },
        { binding: 11, resource: { buffer: this.debugBuffer } }
      ]
    });
  }
}
