import { BinOpTemplate, maxTemplate } from "../shader-util/BinOpTemplate";
import { memoizeWithDevice } from "../shader-util/CacheKeyWithDevice";
import { loadRedComponent, LoadTemplate } from "../shader-util/LoadTemplate";
import { applyTemplate } from "../shader-util/Template";
import { Vec2 } from "../shader-util/Vec";
import shaderWGSL from "./ReduceTexture.wgsl?raw";

/** pipelines are expensive, so cache them persistently */
export const getTextureReducePipeline = memoizeWithDevice(createTextureReducePipeline);

export const maxBinOp = "return max(a, b);";
export const sumBinOp = "return a + b;";

interface TextureReducePipeParams {
  device: GPUDevice;
  workgroupSize?: Vec2;
  blockLength?: number;
  reduceTemplate?: BinOpTemplate;
  loadTemplate?: LoadTemplate;
}

export function createTextureReducePipeline(
  params: TextureReducePipeParams
): GPUComputePipeline {
  const {
    device,
    workgroupSize = [4, 4],
    blockLength = 2,
    reduceTemplate = maxTemplate,
    loadTemplate = loadRedComponent
  } = params;

  const bindGroupLayout = device.createBindGroupLayout({
    label: "reduceTexture",
    entries: [
      {
        binding: 0, // src density texture
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "unfilterable-float"
        }
      },
      {
        binding: 1, // reduced values output (also used as input for intermediate level reductions)
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
    workgroupSizeX: workgroupSize[0],
    workgroupSizeY: workgroupSize[1],
    workgroupThreads: workgroupSize[0] * workgroupSize[1],
    blockLength,
    blockArea: blockLength * blockLength,
    ...reduceTemplate,
    ...loadTemplate
  });

  const module = device.createShaderModule({
    code: processedWGSL
  });

  const reduceTexture = device.createComputePipeline({
    label: "reduceTexture pipeline",
    compute: {
      module,
      entryPoint: "reduceFromTexture"
    },
    layout: device.createPipelineLayout({
      label: "reduceTexture pipeline layout",
      bindGroupLayouts: [bindGroupLayout]
    })
  });

  return reduceTexture;
}
