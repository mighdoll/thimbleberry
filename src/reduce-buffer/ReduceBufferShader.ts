import { HasReactive, reactively } from "@reactively/decorate";
import { BinOpTemplate, maxTemplate } from "../shader-util/BinOpTemplate";
import { createDebugBuffer } from "../shader-util/CreateDebugBuffer";
import { gpuTiming } from "../shader-util/GpuPerf";
import { Cache } from "../shader-util/MemoMemo";
import {
  assignParams,
  ValueOrFn,
  reactiveTrackUse
} from "../shader-util/ReactiveUtil";
import { ComposableShader } from "../shader-util/ComposableShader";
import { trackContext } from "../shader-util/TrackUse";
import { getBufferReducePipeline } from "./ReduceBufferPipeline";

export interface BufferReduceParams {
  device: GPUDevice;
  source: ValueOrFn<GPUBuffer>;
  reducedResult: ValueOrFn<GPUBuffer>;
  dispatchLength: ValueOrFn<number>;
  sourceStart?: ValueOrFn<number>;
  sourceEnd?: ValueOrFn<number>;
  blockLength?: ValueOrFn<number>;
  workgroupLength?: ValueOrFn<number>;
  reduceTemplate?: ValueOrFn<BinOpTemplate>;
  pipelineCache?: <T extends object>() => Cache<T>;
}

const defaults: Partial<BufferReduceParams> = {
  blockLength: 4,
  sourceStart: 0,
  reduceTemplate: maxTemplate,
  workgroupLength: undefined,
  sourceEnd: undefined
};

/** 
 * Reduce workgroup sized blocks of data to single elements. 
 * 
 * A full reduction requires running this shader repeatedly, each time 
 * reducing the previously reduced buffer until only a single workgroup 
 * sized block remains. Then the final reduction will reduce one block to 
 * a buffer containing only a single element.
 * 
 * The reduce operation is controlled by template: could be sum,min,max, etc.
*/
export class BufferReduceShader extends HasReactive implements ComposableShader {
  @reactively source!: GPUBuffer;
  @reactively reducedResult!: GPUBuffer;
  @reactively dispatchLength!: number;
  @reactively blockLength!: number;
  @reactively workgroupLength?: number;
  @reactively reduceTemplate!: BinOpTemplate;

  private device!: GPUDevice;
  private usageContext = trackContext();
  private pipelineCache?: <T extends object>() => Cache<T>;

  constructor(params: BufferReduceParams) {
    super();
    assignParams<BufferReduceShader>(this, params, defaults);
  }

  commands(commandEncoder: GPUCommandEncoder): void {
    const bindGroup = this.bindGroup();

    const elems = this.source.size;
    const label = `bufferReduce ${elems}`;
    const timestampWrites = gpuTiming?.timestampWrites(label);
    const passEncoder = commandEncoder.beginComputePass({ timestampWrites });
    passEncoder.label = label;
    passEncoder.setPipeline(this.pipeline());
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(this.dispatchLength, 1, 1);
    passEncoder.end();
  }

  destroy(): void {
    this.usageContext.finish();
  }

  @reactively get debugBuffer(): GPUBuffer {
    const buffer = createDebugBuffer(this.device, "BufferReduce debug");
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  @reactively private pipeline(): GPUComputePipeline {
    return getBufferReducePipeline(
      {
        device: this.device,
        workgroupThreads: this.actualWorkgroupLength(),
        blockArea: this.blockLength,
        reduceTemplate: this.reduceTemplate
      },
      this.pipelineCache
    );
  }

  @reactively private bindGroup(): GPUBindGroup {
    const srcSize = this.source.size;
    return this.device.createBindGroup({
      label: `bufferReduce ${srcSize}`,
      layout: this.pipeline().getBindGroupLayout(0),
      entries: [
        { binding: 1, resource: { buffer: this.source } },
        { binding: 2, resource: { buffer: this.reducedResult } },
        { binding: 11, resource: { buffer: this.debugBuffer } }
      ]
    });
  }

  @reactively private actualWorkgroupLength(): number {
    const { device } = this;
    const workgroupLength = this.workgroupLength;
    const maxThreads = device.limits.maxComputeInvocationsPerWorkgroup;
    if (!workgroupLength || workgroupLength > maxThreads) {
      return maxThreads;
    } else {
      return workgroupLength;
    }
  }
}
