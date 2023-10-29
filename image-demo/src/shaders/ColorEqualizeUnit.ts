import { reactively } from "@reactively/decorate";
import deepEqual from "fast-deep-equal";
import {
  assignParams,
  ValueOrFn,
  ConvertTemplate,
  minMaxAlphaTemplate,
  minMaxTemplate,
  placeholderTexture,
  reactiveTrackUse,
  HasShaderSequence,
  ComposableShader,
  trackContext,
  Vec2
} from "thimbleberry/shader-util";
import {
  ConvertTextureShader,
  HistogramShader,
  ReduceFrameSequence,
  ScanSequence
} from "thimbleberry/shaders";
import { ScaleUnitColorsShader } from "./ScaleUnitColorsShader";
import {
  f32ExternalToFloat32UnitLength,
  f32ToFloat32UnitLength,
  u32ToFloat32UnitLength
} from "./UnitConvertTemplate";

export interface ColorEqualizeArgs {
  device: GPUDevice;
  srcTexture?: ValueOrFn<GPUTexture | GPUExternalTexture>;
  srcSize?: ValueOrFn<Vec2>;
  destTexture?: ValueOrFn<GPUTexture>;
  numBuckets?: ValueOrFn<number>;
}

const defaults = {
  numBuckets: 256,
};

/**
 * Histogram equalize a color texture.
 * Luminance values are calculated for each pixel.
 * The luminance values are bucketed into a histogram, and the luminance histogram is equalized
 * to distribute as evenly across the luminance range.
 * The equalized luminance values are then re applied to each pixel.
 *
 * Roughly following Garcia-Lamont et. al 2018, the luminance value is calculated as
 * the length of the rgb vector. Adjusting the luminance means adjusting the
 * length of the vector without changing its angle. The authors claim
 * the equalized results are comparable to equalizing in a more perceptually accurate
 * LAB color space and easier to compute.
 *
 * Differing from Garcia-Lamont, we calculate histogram buckets in the min-max range
 * of the image's luminance and expand to the full luminance range.
 */
export class ColorEqualizeUnit extends HasShaderSequence {
  device!: GPUDevice;
  @reactively srcTexture!: GPUTexture | GPUExternalTexture;
  @reactively({ equals: deepEqual }) srcSize!: Vec2;
  @reactively numBuckets!: number;
  @reactively destTexture!: GPUTexture;

  private usageContext = trackContext();

  constructor(args: ColorEqualizeArgs) {
    super();
    const fullDefaults = {
      ...defaults,
      srcTexture: args.srcTexture || placeholderTexture(args.device),
      destTexture: args.destTexture || placeholderTexture(args.device),
      srcSize: [50, 50] as Vec2,
    };
    assignParams<ColorEqualizeUnit>(this, args, fullDefaults);
  }

  override destroy(): void {
    super.destroy();
    this.usageContext.finish();
  }

  @reactively override get shaders(): ComposableShader[] {
    return [
      this.convertToUnitTexture,
      this.reduceFrame,
      this.histogram,
      this.histogramCdf,
      this.rescaleColors,
    ];
  }

  // -- shaders --

  @reactively private get convertToUnitTexture(): ConvertTextureShader {
    return new ConvertTextureShader({
      device: this.device,
      srcTexture: () => this.srcTexture,
      destTexture: () => this.unitLengthTexture,
      template: () => this.convertTemplate,
    });
  }

  @reactively get reduceFrame(): ReduceFrameSequence {
    return new ReduceFrameSequence({
      device: this.device,
      srcTexture: () => this.unitLengthTexture,
      reduceTemplate: minMaxAlphaTemplate,
      loadComponent: "a",
    });
  }

  @reactively get histogram(): HistogramShader {
    return new HistogramShader({
      device: this.device,
      srcTexture: () => this.unitLengthTexture,
      maxBuffer: () => this.reduceFrame.reducedResult,
      loadComponent: "a",
      numBuckets: () => this.numBuckets,
      reduceTemplate: minMaxTemplate,
    });
  }

  @reactively get histogramCdf(): ScanSequence {
    return new ScanSequence({
      device: this.device,
      source: () => this.histogram.histogramBuffer,
    });
  }

  @reactively get rescaleColors(): ScaleUnitColorsShader {
    return new ScaleUnitColorsShader({
      device: this.device,
      srcTexture: () => this.unitLengthTexture,
      maxBuffer: () => this.reduceFrame.reducedResult,
      histogramCDF: () => this.histogramCdf.prefixScan,
      outputTexture: () => this.destTexture,
      numBuckets: () => this.numBuckets,
    });
  }

  // -- gpu allocations --

  @reactively private get unitLengthTexture(): GPUTexture {
    const [width, height] = this.srcSize;
    const texture = this.device.createTexture({
      size: { width, height },
      format: "rgba32float",
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.TEXTURE_BINDING,
    });
    reactiveTrackUse(texture, this.usageContext);
    return texture;
  }

  // -- parameters for shaders --

  @reactively private get convertTemplate(): ConvertTemplate {
    const format = this.srcFormat;
    let template: ConvertTemplate;
    if (format.includes("float") || format.includes("unorm")) {
      if (this.srcTexture instanceof GPUTexture) {
        template = f32ToFloat32UnitLength;
      } else {
        template = f32ExternalToFloat32UnitLength;
      }
    } else if (format.includes("uint")) {
      template = u32ToFloat32UnitLength;
    } else {
      throw new Error(`unsupported format for unit conversion: ${format}`);
    }
    return template;
  }

  @reactively private get srcFormat(): GPUTextureFormat {
    return (this.srcTexture as GPUTexture)?.format || "rgba32float";
  }
}
