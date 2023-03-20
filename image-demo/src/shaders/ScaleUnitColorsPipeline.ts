import { applyTemplate, memoizeWithDevice } from "thimbleberry/shader-util";
import shaderWGSL from "./ScaleUnitColors.wgsl?raw";

export interface ScaleUnitPipelineArgs {
  device: GPUDevice;
  destFormat: GPUTextureFormat;
  numBuckets: number;
}

export const getScaleUnitColorsPipeline = memoizeWithDevice(createScaleUnitPipeline);

function createScaleUnitPipeline(params: ScaleUnitPipelineArgs): GPURenderPipeline {
  const { device, destFormat, numBuckets } = params;
  const target: GPUColorTargetState = {
    format: destFormat,
    blend: { // TODO do we need all this?
      color: {
        operation: "add",
        srcFactor: "src-alpha",
        dstFactor: "one-minus-src-alpha",
      },
      alpha: {
        operation: "add",
        srcFactor: "src-alpha",
        dstFactor: "one-minus-src-alpha",
      },
    },
  };

  const firstBindGroupLayout = device.createBindGroupLayout({
    label: "scale unit colors layout",
    entries: [
      {
        // unit colors texture
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "unfilterable-float" },
      },
      {
        binding: 5, // min/max buffer (from earlier frame reduce)
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 6, // histogramCDF buffer
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 11, // debug buffer
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "storage" },
      },
    ],
  });

  const processedWGSL = applyTemplate(shaderWGSL, {
    numBuckets,
  });

  const module = device.createShaderModule({
    code: processedWGSL,
  });

  const pipeline = device.createRenderPipeline({
    label: "scaleUnitColors pipeline",
    vertex: {
      module,
      entryPoint: "vertMain",
      buffers: [
        {
          arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x2",
            },
          ],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({ // TODO use module above
        code: processedWGSL,
      }),
      entryPoint: "fragMain",
      targets: [target],
    },
    primitive: {
      topology: "triangle-strip",
    },
    layout: device.createPipelineLayout({ bindGroupLayouts: [firstBindGroupLayout] }),
  });

  return pipeline;
}
