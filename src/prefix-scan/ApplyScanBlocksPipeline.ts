import { BinOpTemplate, sumTemplateUnsigned } from "../shader-util/BinOpTemplate";
import { memoizeWithDevice } from "../shader-util/CacheKeyWithDevice";
import { applyTemplate } from "../shader-util/Template";
import shaderWGSL from "./ApplyScanBlocks.wgsl?raw";

export interface ApplyScanBlocksPipelineArgs {
  device: GPUDevice;
  workgroupLength: number;
  reduceTemplate?: BinOpTemplate;
}

export const getApplyBlocksPipeline = memoizeWithDevice(createApplyBlocksPipeline);

function createApplyBlocksPipeline(
  args: ApplyScanBlocksPipelineArgs
): GPUComputePipeline {
  const { device, workgroupLength, reduceTemplate = sumTemplateUnsigned } = args;
  const firstBindGroupLayout = device.createBindGroupLayout({
    label: "apply scan blocks",
    entries: [
      {
        binding: 2, // input partial prefix scan
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" }
      },
      {
        binding: 3, // input block sums
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" }
      },
      {
        binding: 4, // output prefix sums
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
    workgroupSizeX: workgroupLength,
    ...reduceTemplate
  });

  const module = device.createShaderModule({
    code: processedWGSL
  });

  const pipeline = device.createComputePipeline({
    compute: {
      module,
      entryPoint: "applyScanBlocks"
    },
    layout: device.createPipelineLayout({ bindGroupLayouts: [firstBindGroupLayout] })
  });

  return pipeline;
}
