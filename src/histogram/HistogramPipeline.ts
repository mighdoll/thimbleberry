import { BinOpTemplate, minMaxTemplate } from "../shader-util/BinOpTemplate";
import { memoizeWithDevice } from "../shader-util/CacheKeyWithDevice";
import { loadRedComponent, LoadTemplate } from "../shader-util/LoadTemplate";
import { applyTemplate } from "../shader-util/Template";
import { Vec2 } from "../shader-util/Vec";
import shaderWGSL from "./Histogram.wgsl?raw";

export interface HistogramPipelineParams {
  device: GPUDevice;
  workgroupSize: Vec2;
  numBuckets: number;
  reduceTemplate?: BinOpTemplate;
  loadTemplate?: LoadTemplate;
}

/** pipelines are expensive, so cache them persistently */
export const getHistogramPipeline = memoizeWithDevice(createHistogramPipeline);

export function createHistogramPipeline(
  params: HistogramPipelineParams
): GPUComputePipeline {
  const { device, workgroupSize, numBuckets } = params;
  const { reduceTemplate = minMaxTemplate } = params;
  const { loadTemplate = loadRedComponent } = params;

  const firstBindGroupLayout = device.createBindGroupLayout({
    label: "histogram layout",
    entries: [
      {
        binding: 0, // src density texture
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "unfilterable-float" }
      },
      {
        binding: 1, // max buffer (from earlier frame reduce)
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" }
      },
      {
        binding: 2, // output histogram
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
      },
      {
        binding: 3, // uniforms
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" }
      },
      {
        binding: 4, // output sum
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
      },
      {
        binding: 11, // debug buffer
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
      }
    ]
  });

  const processedWGSL = applyTemplate(shaderWGSL, {
    workgroupSizeX: workgroupSize[0],
    workgroupSizeY: workgroupSize[1],
    numBuckets,
    ...loadTemplate,
    ...reduceTemplate
  });

  const module = device.createShaderModule({
    code: processedWGSL
  });

  const pipeline = device.createComputePipeline({
    compute: {
      module,
      entryPoint: "histogram"
    },
    layout: device.createPipelineLayout({ bindGroupLayouts: [firstBindGroupLayout] })
  });

  return pipeline;
}
