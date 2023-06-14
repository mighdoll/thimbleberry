import { HasReactive, reactively } from "@reactively/decorate";
import deepEqual from "fast-deep-equal";
import { BinOpTemplate } from "../shader-util/BinOpTemplate";
import { createDebugBuffer } from "../shader-util/CreateDebugBuffer";
import { gpuTiming } from "../shader-util/GpuPerf";
import {
  LoadableComponent,
  loaderForComponent,
  LoadTemplate
} from "../shader-util/LoadTemplate";
import { Cache } from "../shader-util/MemoMemo";
import {
  assignParams,
  ValueOrFn,
  reactiveTrackUse
} from "../shader-util/ReactiveUtil";
import { ComposableShader } from "../shader-util/ComposableShader";
import { trackContext } from "../shader-util/TrackUse";
import { Vec2 } from "../shader-util/Vec";
import { getHistogramPipeline } from "./HistogramPipeline";

export const defaultNumBuckets = 2 ** 8;

export interface HistogramShaderArgs {
  device: GPUDevice;
  srcTexture: ValueOrFn<GPUTexture>;
  maxBuffer: ValueOrFn<GPUBuffer>;
  reduceTemplate: ValueOrFn<BinOpTemplate>;
  workgroupSize?: Vec2; // allow setting workgroup size for testing
  numBuckets?: ValueOrFn<number>;
  loadComponent?: ValueOrFn<LoadableComponent>;
  pipelineCache?: <T extends object>() => Cache<T>;
}

const defaults = {
  numBuckets: defaultNumBuckets,
  loadComponent: "r",
  pipelineCache: undefined
};

/**
 * Calculate the histogram of a density texture.
 *
 * The buckets are evenly distributed between 0 and the max value, which is
 * produced by an earlier compute (reduction) pass and read here
 * from the last float in the maxBuffer texture.
 *
 * Density values of 0 are ignored, only values > 0 are counted.
 *
 * Currently, one workgroup is dispatched with perhaps 256 thread invocations.
 * Each invocation in the workgroup reads a block of pixels and accumulates
 * histogram counts in workgroup memory.
 * When all invocations complete, one thread in the workgroup copies the
 * workgroup histogram to an output histogram GPUBuffer.
 */
export class HistogramShader extends HasReactive implements ComposableShader {
  private device!: GPUDevice;
  @reactively srcTexture!: GPUTexture;
  @reactively maxBuffer!: GPUBuffer;
  @reactively numBuckets!: number;
  @reactively loadComponent!: LoadableComponent;
  @reactively reduceTemplate!: BinOpTemplate;

  private pipelineCache?: () => Cache<any>;
  private workgroupSize?: Vec2;

  private usageContext = trackContext();

  constructor(params: HistogramShaderArgs) {
    super();
    assignParams<HistogramShader>(this, params, defaults);
  }

  commands(commandEncoder: GPUCommandEncoder): void {
    const timestampWrites = gpuTiming?.timestampWrites("histogram");
    this.updateUniforms();
    const passEncoder = commandEncoder.beginComputePass({ timestampWrites });
    passEncoder.label = "histogram";
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.dispatchWorkgroups(this.dispatchSize[0], this.dispatchSize[1]);
    passEncoder.end();
  }

  destroy(): void {
    this.usageContext.finish();
  }

  @reactively private updateUniforms(): void {
    this.device.queue.writeBuffer(this.uniforms, 0, new Uint32Array(this.blockSize));
  }

  @reactively private get uniforms(): GPUBuffer {
    const uniforms = this.device.createBuffer({
      label: "histogram uniforms",
      size: Uint32Array.BYTES_PER_ELEMENT * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    reactiveTrackUse(uniforms, this.usageContext);
    return uniforms;
  }

  /** number of thread invocations in each workgroup */
  @reactively({ equals: deepEqual }) private get actualWorkgroupSize(): Vec2 {
    if (this.workgroupSize) {
      return this.workgroupSize;
    }

    const {
      maxComputeWorkgroupSizeX: maxX,
      maxComputeWorkgroupSizeY: maxY,
      maxComputeInvocationsPerWorkgroup: maxInvocations
    } = this.device.limits;
    const proposedMax = Math.floor(Math.sqrt(maxInvocations));
    const workgroupSize = [maxX, maxY].map(m => Math.min(m, proposedMax));
    return workgroupSize as Vec2;
  }

  /** each invocation reads a block of pixels of these dimensions */
  @reactively({ equals: deepEqual }) private get blockSize(): Vec2 {
    const workSize = this.actualWorkgroupSize;
    const imageSize = [this.srcTexture.width, this.srcTexture.height];

    const size = imageSize.map((size, dex) => Math.ceil(size / workSize[dex]));
    return size as Vec2;
  }

  /** number of workgroups to dispatch
   * (1 if we're not doing an additional histogram reduction step)  */
  @reactively({ equals: deepEqual }) private get dispatchSize(): Vec2 {
    const { width, height } = this.srcTexture;
    const workSize = this.actualWorkgroupSize;
    const blockSize = this.blockSize;
    const dispatchSize = [width, height].map((s, i) =>
      Math.ceil(s / (workSize[i] * blockSize[i]))
    ) as Vec2;

    return dispatchSize;
  }

  @reactively private get pipeline(): GPUComputePipeline {
    const { device } = this;
    return getHistogramPipeline(
      {
        device,
        workgroupSize: this.actualWorkgroupSize,
        numBuckets: this.numBuckets,
        reduceTemplate: this.reduceTemplate,
        loadTemplate: this.loadTemplate
      },
      this.pipelineCache
    );
  }

  @reactively get loadTemplate(): LoadTemplate {
    return loaderForComponent(this.loadComponent);
  }

  @reactively get histogramBuffer(): GPUBuffer {
    const { device } = this;
    const buffer = device.createBuffer({
      label: "histogramBuffer",
      size: this.numBuckets * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  @reactively get sumBuffer(): GPUBuffer {
    const { device } = this;
    const buffer = device.createBuffer({
      label: "histogram sum Buffer",
      size: this.numBuckets * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  @reactively get debugBuffer(): GPUBuffer {
    const buffer = createDebugBuffer(this.device, "Histogram debug");
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  @reactively private get bindGroup(): GPUBindGroup {
    console.assert(this.srcTexture != undefined);
    console.assert(this.maxBuffer != undefined);
    const srcView = this.srcTexture!.createView();
    return this.device.createBindGroup({
      label: "histogramRenderGroup",
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: srcView },
        { binding: 1, resource: { buffer: this.maxBuffer! } },
        { binding: 2, resource: { buffer: this.histogramBuffer } },
        { binding: 3, resource: { buffer: this.uniforms } },
        { binding: 4, resource: { buffer: this.sumBuffer } },
        { binding: 11, resource: { buffer: this.debugBuffer } }
      ]
    });
  }
}
