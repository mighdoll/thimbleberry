import { BinOpTemplate, maxTemplate } from "../shader-util/BinOpTemplate";
import { memoizeWithDevice } from "../shader-util/CacheKeyWithDevice";
import { applyTemplate } from "../shader-util/Template";
import shaderWGSL from "./ReduceBuffer.wgsl?raw";

export interface ReduceBufferPipelineArgs {
  device: GPUDevice;
  workgroupThreads: number;
  blockArea: number;
  reduceTemplate: BinOpTemplate;
}
export const getBufferReducePipeline = memoizeWithDevice(createBufferReducePipeline);

function createBufferReducePipeline(
  params: ReduceBufferPipelineArgs
): GPUComputePipeline {
  const { device, workgroupThreads = 4, blockArea = 4 } = params;
  const { reduceTemplate = maxTemplate } = params;

  const bindGroupLayout = device.createBindGroupLayout({
    label: "reduceBuffer",
    entries: [
      {
        binding: 1, // reduced values input
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "read-only-storage"
        }
      },
      {
        binding: 2, // reduced values output
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "storage"
        }
      },
      {
        binding: 11, // debug buffer
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "storage"
        }
      }
    ]
  });

  const processedWGSL = applyTemplate(shaderWGSL, {
    workgroupThreads,
    blockArea,
    ...reduceTemplate
  });

  const module = device.createShaderModule({
    code: processedWGSL
  });

  const pipeline = device.createComputePipeline({
    label: "reduceBuffer",
    compute: {
      module,
      entryPoint: "reduceFromBuffer"
    },
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] })
  });

  return pipeline;
}
