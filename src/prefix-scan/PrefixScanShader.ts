import { HasReactive, reactively } from "@reactively/decorate";
import { BinOpTemplate, sumTemplateUnsigned } from "../shader-util/BinOpTemplate";
import { createDebugBuffer } from "../shader-util/CreateDebugBuffer";
import { gpuTiming } from "../shader-util/GpuPerf";
import { limitWorkgroupLength } from "../shader-util/LimitWorkgroupLength";
import { Cache } from "../shader-util/MemoMemo";
import {
  ValueOrFn,
  assignParams,
  reactiveTrackUse,
} from "../shader-util/ReactiveUtil";
import { ComposableShader } from "../shader-util/ComposableShader";
import { trackContext } from "../shader-util/TrackUse";
import { getWorkgroupScanPipeline } from "./PrefixScanPipeline";

export interface PrefixScanParams {
  device: GPUDevice;
  source: ValueOrFn<GPUBuffer>;
  emitBlockSums?: ValueOrFn<boolean>;
  workgroupLength?: ValueOrFn<number>;
  label?: ValueOrFn<string>;
  reduceTemplate?: ValueOrFn<BinOpTemplate>;
  pipelineCache?: <T extends object>() => Cache<T>;
}

const defaults: Partial<PrefixScanParams> = {
  emitBlockSums: true,
  pipelineCache: undefined,
  label: "prefix scan",
  reduceTemplate: sumTemplateUnsigned,
};

/**
 * Prefix scan operation on workgroup sized blocks of data.
 *
 * Internally allocates an output buffer for the prefix scan results.
 * The output buffer will be the same dimensions as the input buffer.
 *
 * Optionally allocates a block level summary buffer, containing
 * one summariy entry per input block.
 */
export class PrefixScanShader extends HasReactive implements ComposableShader {
  @reactively source!: GPUBuffer;
  @reactively workgroupLength?: number;
  @reactively reduceTemplate!: BinOpTemplate;
  @reactively emitBlockSums!: boolean;
  @reactively label!: string;

  private device!: GPUDevice;
  private pipelineCache?: <T extends object>() => Cache<T>;
  private usageContext = trackContext();

  constructor(params: PrefixScanParams) {
    super();
    assignParams<PrefixScanShader>(this, params, defaults);
  }

  commands(commandEncoder: GPUCommandEncoder): void {
    const timestampWrites = gpuTiming?.timestampWrites(this.label);
    const passEncoder = commandEncoder.beginComputePass({ timestampWrites });
    passEncoder.label = this.label;
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.dispatchWorkgroups(this.dispatchSize, 1, 1);
    passEncoder.end();
  }

  destroy(): void {
    this.usageContext.finish();
  }

  @reactively private get dispatchSize(): number {
    const sourceElems = this.sourceSize / Uint32Array.BYTES_PER_ELEMENT;
    const dispatchSize = Math.ceil(sourceElems / this.actualWorkgroupLength);
    return dispatchSize;
  }

  @reactively private get pipeline(): GPUComputePipeline {
    return getWorkgroupScanPipeline(
      {
        device: this.device,
        workgroupSize: this.actualWorkgroupLength,
        blockSums: this.emitBlockSums,
        reduceTemplate: this.reduceTemplate,
      },
      this.pipelineCache
    );
  }

  @reactively private get bindGroup(): GPUBindGroup {
    let blockSumsEntry: GPUBindGroupEntry[] = [];
    if (this.emitBlockSums) {
      blockSumsEntry = [{ binding: 3, resource: { buffer: this.blockSums } }];
    }

    return this.device.createBindGroup({
      label: `workgroup scan`,
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 1, resource: { buffer: this.source } },
        { binding: 2, resource: { buffer: this.prefixScan } },
        ...blockSumsEntry,
        { binding: 11, resource: { buffer: this.debugBuffer } },
      ],
    });
  }

  @reactively get sourceSize(): number {
    return this.source.size;
  }

  @reactively get prefixScan(): GPUBuffer {
    const buffer = this.device.createBuffer({
      label: `prefix scan ${this.label}`,
      size: this.sourceSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  @reactively get blockSums(): GPUBuffer {
    // ensure size is a multiple of 4
    const buffer = this.device.createBuffer({
      label: `prefix scan block sums ${this.label}`,
      size: this.dispatchSize * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  @reactively get actualWorkgroupLength(): number {
    return limitWorkgroupLength(this.device, this.workgroupLength);
  }

  @reactively get debugBuffer(): GPUBuffer {
    const buffer = createDebugBuffer(this.device, "Workgroup Scan debug");
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }
}
