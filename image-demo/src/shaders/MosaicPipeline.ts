import {
  applyTemplate,
  memoizeWithDevice,
  SampledTextureType2D,
} from "thimbleberry/shader-util";
import polygonWGSL from "./Mosaic.wgsl?raw";
import circleWGSL from "./MosaicCircle.wgsl?raw";

export type RenderShape = "polygon" | "circle";

export interface MosaicPipelineArgs {
  device: GPUDevice;
  destFormat: GPUTextureFormat;
  srcTextureType: SampledTextureType2D;
  srcSampleType?: GPUTextureSampleType;
  renderShape?: RenderShape;
}

export const mosaicPipeline = memoizeWithDevice(createMosaicPipeline);

export function createMosaicPipeline(params: MosaicPipelineArgs): GPURenderPipeline {
  const { device, destFormat, srcTextureType, srcSampleType } = params;
  const { renderShape = "polygon" } = params;

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

  const srcWGSL = renderShape === "polygon" ? polygonWGSL : circleWGSL;

  const processedWGSL: string = applyTemplate(srcWGSL, {
    srcTextureType,
    loadLevel: srcTextureType === "texture_external" ? "" : ", 0",
  });

  const module = device.createShaderModule({
    code: processedWGSL,
  });

  const target: GPUColorTargetState = {
    format: destFormat,
    blend: {
      color: {
        operation: "add",
        srcFactor: "one",
        dstFactor: "one-minus-src-alpha",
      },
      alpha: {
        operation: "add",
        srcFactor: "zero",
        dstFactor: "one",
      },
    },
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
