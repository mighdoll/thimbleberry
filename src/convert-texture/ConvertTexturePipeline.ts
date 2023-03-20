import { memoizeWithDevice } from "../shader-util/CacheKeyWithDevice";
import { ConvertTemplate } from "../shader-util/ConvertTemplate";
import { applyTemplate } from "../shader-util/Template";
import shaderWGSL from "./ConvertTexture.wgsl?raw";

interface ConvertTextureParams {
  device: GPUDevice;
  srcSampleType: GPUTextureSampleType;
  template: ConvertTemplate;
  externalSrc?: boolean;
}

/** pipelines are expensive, so cache them persistently */
export const getConvertTexturePipeline = memoizeWithDevice(createConvertTexturePipeline);

function createConvertTexturePipeline(params: ConvertTextureParams): GPUComputePipeline {
  const { device, srcSampleType, template } = params;

  let srcLayout: GPUTextureBindingLayout | GPUExternalTextureBindingLayout;

  if (template.srcTextureType === "texture_external") {
    srcLayout = {
      externalTexture: {}
    };
  } else {
    srcLayout = {
      texture: {
        sampleType: srcSampleType
      }
    };
  }

  const bindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout({
    label: "convertTexture",
    entries: [
      {
        binding: 1, // src density texture
        visibility: GPUShaderStage.COMPUTE,
        ...srcLayout
      },
      {
        binding: 2, // reduced values output (also used as input for intermediate level reductions)
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          format: template.destFormat
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

  const processedWGSL: string = applyTemplate(shaderWGSL, {
    ...template,
    loadLevel: template.srcTextureType === "texture_external" ? "" : ", 0"
  });

  const module: GPUShaderModule = device.createShaderModule({
    code: processedWGSL
  });

  return device.createComputePipeline({
    label: "convertTexture pipeline",
    compute: {
      module,
      entryPoint: "convertTexture"
    },
    layout: device.createPipelineLayout({
      label: "convertTexture pipeline layout",
      bindGroupLayouts: [bindGroupLayout]
    })
  });
}
