import { BinOpTemplate, sumTemplateUnsigned } from "../shader-util/BinOpTemplate";
import { memoizeWithDevice } from "../shader-util/CacheKeyWithDevice";
import { applyTemplate } from "../shader-util/Template";
import shaderWGSL from "./PrefixScan.wgsl?raw";

interface WorkGroupScanPipelineArgs {
  device: GPUDevice;
  workgroupSize: number;
  blockSums: boolean;
  reduceTemplate: BinOpTemplate;
}

export const getWorkgroupScanPipeline = memoizeWithDevice(createWorkgroupScanPipeline);

function createWorkgroupScanPipeline(
  params: WorkGroupScanPipelineArgs
): GPUComputePipeline {
  const { device, workgroupSize, blockSums = true } = params;
  const { reduceTemplate = sumTemplateUnsigned } = params;
  let blockSumsEntry: GPUBindGroupLayoutEntry[] = [];
  if (blockSums) {
    blockSumsEntry = [
      {
        binding: 3, // output block sums
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
      }
    ];
  }

  const firstBindGroupLayout = device.createBindGroupLayout({
    label: "workgroup scan layout",
    entries: [
      // {
      //   binding: 0, // uniforms
      //   visibility: GPUShaderStage.COMPUTE,
      //   buffer: { type: "uniform" },
      // },
      {
        binding: 1, // src buffer
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" }
      },
      {
        binding: 2, // output prefix sums
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
      },
      ...blockSumsEntry,
      {
        binding: 11, // debug buffer
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
      }
    ]
  });

  const processedWGSL = applyTemplate(shaderWGSL, {
    workgroupSizeX: workgroupSize,
    blockSums,
    ...reduceTemplate
  });

  const module = device.createShaderModule({
    code: processedWGSL
  });

  const pipeline = device.createComputePipeline({
    compute: {
      module,
      entryPoint: "workgroupPrefixScan"
    },
    layout: device.createPipelineLayout({ bindGroupLayouts: [firstBindGroupLayout] })
  });

  return pipeline;
}
