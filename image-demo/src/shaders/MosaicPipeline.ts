import {
  applyTemplate,
  memoizeWithDevice,
  SampledTextureType2D,
} from "thimbleberry/shader-util";
import shaderWGSL from "./Mosaic.wgsl?raw";

export interface MosaicPipelineArgs {
  device: GPUDevice;
  destFormat: GPUTextureFormat;
  srcTextureType: SampledTextureType2D;
  srcSampleType?: GPUTextureSampleType;
}

export const mosaicPipeline = memoizeWithDevice(createMosaicPipeline);

export function createMosaicPipeline(params: MosaicPipelineArgs): GPURenderPipeline {
  const { device, destFormat, srcTextureType, srcSampleType } = params;

  let srcLayout: GPUTextureBindingLayout | GPUExternalTextureBindingLayout;

  if (srcTextureType === "texture_external") {
    srcLayout = {
      externalTexture: {},
    };
  } else {
    srcLayout = {
      texture: {
        sampleType: srcSampleType || "unfilterable-float",
      },
    };
  }
  const firstBindGroupLayout = device.createBindGroupLayout({
    label: "mosaic layout",
    entries: [
      {
        binding: 0, // uniforms
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      {
        binding: 1, // src texture
        visibility: GPUShaderStage.VERTEX,
        ...srcLayout,
      },
      {
        binding: 11, // debug buffer
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "storage" },
      },
    ],
  });

  const processedWGSL: string = applyTemplate(shaderWGSL, {
    srcTextureType,
    loadLevel: srcTextureType === "texture_external" ? "" : ", 0",
  });

  const module = device.createShaderModule({
    code: processedWGSL,
  });

  const target: GPUColorTargetState = {
    format: destFormat,
  };

  const pipeline = device.createRenderPipeline({
    label: "Mosaic Pipeline",
    vertex: {
      module,
      entryPoint: "vertMain",
      buffers: [
        {
          // instance vertices (shared by every instance)
          arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x2",
            },
          ],
        },
        {
          // shape positions, one per instance
          stepMode: "instance",
          arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
          attributes: [
            {
              shaderLocation: 1,
              offset: 0,
              format: "float32x2",
            },
          ],
        },
      ],
    },
    fragment: {
      module,
      entryPoint: "fragMain",
      targets: [target],
    },
    primitive: {
      topology: "triangle-strip",
    },
    layout: device.createPipelineLayout({
      bindGroupLayouts: [firstBindGroupLayout],
    }),
  });

  return pipeline;
}
