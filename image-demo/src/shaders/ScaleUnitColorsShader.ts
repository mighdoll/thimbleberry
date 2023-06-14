import { HasReactive, reactively } from "@reactively/decorate";
import {
  assignParams,
  ValueOrFn,
  createDebugBuffer,
  fullFrameVertexBuffer,
  gpuTiming,
  Cache,
  reactiveTrackUse,
  ComposableShader,
  trackContext,
} from "thimbleberry/shader-util";
import { defaultNumBuckets } from "thimbleberry/shaders";
import { getScaleUnitColorsPipeline } from "./ScaleUnitColorsPipeline";

export interface ScaleUnitColorsArgs {
  device: GPUDevice;
  srcTexture: ValueOrFn<GPUTexture>;
  outputTexture: ValueOrFn<GPUTexture>;
  maxBuffer: ValueOrFn<GPUBuffer>;
  histogramCDF: ValueOrFn<GPUBuffer>;
  numBuckets?: ValueOrFn<number>;
  outputFormat?: ValueOrFn<GPUTextureFormat>;
  pipelineCache?: <T extends object>() => Cache<T>;
}

const defaults = {
  numBuckets: defaultNumBuckets,
  outputFormat: undefined,
  pipelineCache: undefined,
};

export class ScaleUnitColorsShader extends HasReactive implements ComposableShader {
  @reactively srcTexture!: GPUTexture;
  @reactively outputTexture!: GPUTexture;
  @reactively maxBuffer!: GPUBuffer;
  @reactively histogramCDF!: GPUBuffer;
  @reactively numBuckets!: number;
  @reactively outputFormat!: GPUTextureFormat | undefined;

  private device!: GPUDevice;
  private usageContext = trackContext();
  private pipelineCache?: <T extends object>() => Cache<T>;

  constructor(params: ScaleUnitColorsArgs) {
    super();
    assignParams<ScaleUnitColorsShader>(this, params, defaults);
  }

  commands(commandEncoder: GPUCommandEncoder): void {
    const timestampWrites = gpuTiming?.timestampWrites("scaleUnitColors");
    const verts = fullFrameVertexBuffer({ device: this.device });

    const passEncoder = commandEncoder.beginRenderPass({
      label: "scaleUnitColors render pass",
      colorAttachments: this.colorAttachments,
      timestampWrites,
    });
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setVertexBuffer(0, verts);
    passEncoder.setBindGroup(0, this.bindGroup);
    const numVerts = verts.size / (2 * Float32Array.BYTES_PER_ELEMENT);
    passEncoder.draw(numVerts);
    passEncoder.end();
  }

  destroy(): void {
    this.usageContext.finish();
  }

  private get colorAttachments(): GPURenderPassColorAttachment[] {
    const destTexture = this.outputTexture;
    const view = destTexture.createView({ label: "view-" + destTexture.label });

    return [
      {
        view,
        storeOp: "store",
        loadOp: "load",
      },
    ];
  }

  @reactively private get pipeline(): GPURenderPipeline {
    return getScaleUnitColorsPipeline(
      {
        device: this.device,
        destFormat: this.outputTexture.format,
        numBuckets: this.numBuckets,
      },
      this.pipelineCache
    );
  }

  @reactively get bindGroup(): GPUBindGroup {
    const srcView = this.srcTexture.createView();

    return this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 2, resource: srcView },
        { binding: 5, resource: { buffer: this.maxBuffer } },
        { binding: 6, resource: { buffer: this.histogramCDF } },
        { binding: 11, resource: { buffer: this.debugBuffer } },
      ],
    });
  }

  @reactively get debugBuffer(): GPUBuffer {
    const buffer = createDebugBuffer(this.device, "ScaleUnitColors debug");
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }
}
