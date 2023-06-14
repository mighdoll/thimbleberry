import { HasReactive, reactively } from "@reactively/decorate";
import deepEqual from "fast-deep-equal";
import { BufferReduceShader } from "../reduce-buffer/ReduceBufferShader";
import { BinOpTemplate, maxTemplate } from "../shader-util/BinOpTemplate";
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
import { TextureReduceShader } from "./ReduceTextureShader";

export interface ReduceFrameParams {
  device: GPUDevice;
  srcTexture: ValueOrFn<GPUTexture>;
  blockLength?: ValueOrFn<number>;
  workThreads?: ValueOrFn<number>;
  reduceTemplate?: ValueOrFn<BinOpTemplate>;
  loadComponent?: ValueOrFn<LoadableComponent>;
  pipelineCache?: <T extends object>() => Cache<T>;
}

const defaults: Partial<ReduceFrameParams> = {
  blockLength: 2,
  reduceTemplate: maxTemplate,
  loadComponent: "r",
  workThreads: undefined,
  pipelineCache: undefined
};

/**
 * A sequence of shader dispatches that reduces a source texture to a single value
 * according to a specified binary operation (e.g. min, max, or sum).
 *
 * Two underlying shaders are used:
 *   . one to reduce the source texture to a smaller buffer
 *   . one to reduce a buffer to smaller buffer
 *
 * When executed, FrameReduceSequence will dispatch a sufficient number of times
 * to end with a single value. The final result is stored in a single element
 * `reducedResult` buffer.
 */
export class ReduceFrameSequence extends HasReactive implements ComposableShader {
  @reactively srcTexture!: GPUTexture;
  @reactively blockLength!: number;
  @reactively workThreads: number | undefined;
  @reactively reduceTemplate!: BinOpTemplate;
  @reactively loadComponent!: LoadableComponent;

  private device!: GPUDevice;
  private usageContext = trackContext();
  private pipelineCache?: <T extends object>() => Cache<T>;

  constructor(params: ReduceFrameParams) {
    super();
    assignParams<ReduceFrameSequence>(this, params, defaults);
  }

  commands(commandEncoder: GPUCommandEncoder): void {
    this.shaders.forEach(s => s.commands(commandEncoder));
  }

  destroy(): void {
    this.usageContext.finish();
  }

  /** result of the final reduction pass, one element in size */
  @reactively get reducedResult(): GPUBuffer {
    return this.reductionBuffers[this.reductionBuffers.length - 1];
  }

  /** all shaders needed to reduce the texture to a single reduced value */
  @reactively get shaders(): ComposableShader[] {
    return [this.textureReduce, ...this.bufShaders()];
  }

  @reactively get textureReduce(): TextureReduceShader {
    const shader = new TextureReduceShader({
      device: this.device,
      srcTexture: this.srcTexture,
      reducedResult: this.reductionBuffers[0],
      blockLength: this.blockLength,
      workgroupSize: this.textureWorkSize(),
      dispatchSize: this.textureDispatch(),
      reduceTemplate: this.reduceTemplate,
      loadTemplate: this.loadTemplate,
      pipelineCache: this.pipelineCache
    });
    reactiveTrackUse(shader, this.usageContext);
    return shader;
  }

  /** number of workgroups dispatched for each phase of buffer reduce */
  @reactively private bufDispatches(): number[] {
    const { blockLength } = this;
    const dispatches = [];
    const reductionFactor = blockLength * this.bufWorkLength();
    for (let reducedSize = this.texReducedSize(); reducedSize > 1; ) {
      reducedSize = Math.ceil(reducedSize / reductionFactor);
      dispatches.push(reducedSize);
    }

    return dispatches;
  }

  /** one reduction buffer per buffer to buffer dispatch,
   * plus one buffer for the texture to buffer dispatch */
  @reactively get reductionBuffers(): GPUBuffer[] {
    const reducedSizes = [this.texReducedSize(), ...this.bufDispatches()];
    return reducedSizes.map(elems => {
      const size = elems * this.reduceTemplate.elementSize;
      return this.reductionBuffer(size);
    });
  }

  /** allocate one reduction buffer  */
  private reductionBuffer(size: number): GPUBuffer {
    const buffer = this.device.createBuffer({
      label: `reductionBuffer ${size}`,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      size
    });
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  /** all the buffer to buffer reduction shaders */
  @reactively bufShaders(): BufferReduceShader[] {
    const buffers = this.reductionBuffers;
    return this.bufDispatches().map((size, i) =>
      this.bufShader(size, buffers[i], buffers[i + 1])
    );
  }

  /** create one buffer to buffer reduction shader */
  private bufShader(
    dispatchLength: number,
    source: GPUBuffer,
    reducedResult: GPUBuffer
  ): BufferReduceShader {
    const shader = new BufferReduceShader({
      source,
      reducedResult,
      device: this.device,
      blockLength: this.blockLength,
      workgroupLength: this.bufWorkLength(),
      reduceTemplate: this.reduceTemplate,
      dispatchLength,
      pipelineCache: this.pipelineCache
    });
    reactiveTrackUse(shader, this.usageContext);
    return shader;
  }

  /** number of threads in each workgroup for the texture reduce phase */
  @reactively({ equals: deepEqual }) private textureWorkSize(): Vec2 {
    const maxThreads = this.device.limits.maxComputeInvocationsPerWorkgroup;
    const { workThreads = maxThreads, srcTexture, blockLength, device } = this;
    const fbSize: Vec2 = [srcTexture.width, srcTexture.height];

    const w = Math.floor(Math.sqrt(workThreads));
    const proposedSize = [w, w] as Vec2;

    const offeredSize = proposedSize || proposeTextureGroupSize(fbSize, blockLength);
    return limitWorkgroupSize(device, offeredSize);
  }

  /** @return the number of workgroups dispatched for the texture reduce phase */
  @reactively({ equals: deepEqual }) private textureDispatch(): Vec2 {
    const { srcTexture, blockLength } = this;
    const fbSize: Vec2 = [srcTexture.width, srcTexture.height];
    const workSize = this.textureWorkSize();
    const dispatch = [0, 1].map(i =>
      Math.ceil(fbSize[i] / (workSize[i] * blockLength))
    ) as Vec2;
    return dispatch;
  }

  /** number of reduced elements produced by the texture reduce phase */
  @reactively texReducedSize(): number {
    return this.textureDispatch().reduce((a, b) => a * b);
  }

  /** number of threads per workgroup for the buffer reduce phases */
  @reactively private bufWorkLength(): number {
    const { device, workThreads: suggestWorkThreads } = this;
    const maxThreads = device.limits.maxComputeInvocationsPerWorkgroup;
    return suggestWorkThreads ? Math.min(suggestWorkThreads, maxThreads) : maxThreads;
  }

  /** reduction template for loading src data from the texture */
  @reactively private get loadTemplate(): LoadTemplate {
    return loaderForComponent(this.loadComponent);
  }
}

/** @return ideal size of the workgroups for the reduction from the source texture */
function proposeTextureGroupSize(fbSize: Vec2, blockLength: number): Vec2 {
  // try for a workgroup big enough to to cover the framebuffer
  return fbSize.map(size => Math.ceil(size / blockLength)) as Vec2;
}

/** modify a workgroupSize to stay within device limits */
function limitWorkgroupSize(device: GPUDevice, proposed: Vec2): Vec2 {
  const { limits } = device;
  const threads = proposed[0] * proposed[1];

  // shrink if too many total threads
  const maxThreads = limits.maxComputeInvocationsPerWorkgroup;
  const shinkFactor = threads > maxThreads ? threads / maxThreads : 1;
  const shrunk = proposed.map(size => Math.floor(size / shinkFactor)) as Vec2;

  // shrink further if workgroup axis is too big
  const maxX = limits.maxComputeWorkgroupSizeX;
  const maxY = limits.maxComputeWorkgroupSizeY;
  const size = [maxX, maxY].map((max, i) => Math.min(shrunk[i], max)) as Vec2;

  return size;
}
