import { HasReactive, reactively } from "@reactively/decorate";
import { dsert } from "berry-pretty";
import deepEqual from "fast-deep-equal";
import {
  assignParams,
  ValueOrFn,
  circleStrip,
  createDebugBuffer,
  filledGPUBuffer,
  gpuTiming,
  placeholderTexture,
  reactiveTrackUse,
  SampledTextureType2D,
  ComposableShader,
  textureResource,
  trackContext,
  Vec2,
  Vec4,
} from "thimbleberry/shader-util";
import { mosaicPipeline, RenderShape } from "./MosaicPipeline";

const squareVertsNDC: Vec2[] = [
  [-1, 1],
  [-1, -1],
  [1, 1],
  [1, -1],
];

export interface MosaicShaderArgs {
  device: GPUDevice;
  srcTexture?: ValueOrFn<GPUTexture | GPUExternalTexture>;
  destTexture?: ValueOrFn<GPUTexture>;
  mosaicSize?: ValueOrFn<Vec2>;
  spacing?: ValueOrFn<Vec2>;
  backgroundColor?: ValueOrFn<Vec4>;
  srcSize?: ValueOrFn<Vec2>;
  mosaicShape?: ValueOrFn<MosaicShape>;
  rowOffset?: ValueOrFn<number>;
}

const defaults: Partial<MosaicShaderArgs> = {
  mosaicShape: "square",
  mosaicSize: [18, 12],
  backgroundColor: [0.1, 0.3, 0.4, 1],
  spacing: [0.5, 0.5],
  rowOffset: 10,
};

const placeholderSize: Vec2 = [50, 50];

const circleFeather = 1; // width in pixels to antialias (only for circle reandering)

type MosaicShape = "square" | "circle";

export class MosaicShader extends HasReactive implements ComposableShader {
  device!: GPUDevice;
  @reactively destTexture!: GPUTexture;
  @reactively srcTexture!: GPUTexture | GPUExternalTexture;
  @reactively({ equals: deepEqual }) mosaicSize!: Vec2;
  @reactively({ equals: deepEqual }) spacing!: Vec2;
  @reactively({ equals: deepEqual }) backgroundColor!: Vec4;
  @reactively({ equals: deepEqual }) srcSize!: Vec2;
  @reactively mosaicShape!: MosaicShape;
  @reactively rowOffset!: number;

  private usageContext = trackContext();

  constructor(args: MosaicShaderArgs) {
    super();
    const fullDefaults = {
      ...defaults,
      srcTexture: args.srcTexture || placeholderTexture(args.device),
      destTexture: args.destTexture || placeholderTexture(args.device),
      srcSize: args.srcSize || placeholderSize,
    };
    assignParams<MosaicShader>(this, args, fullDefaults);
  }

  destroy(): void {
    this.usageContext.finish();
  }

  commands(commandEncoder: GPUCommandEncoder): void {
    this.updateUniforms();
    const timestampWrites = gpuTiming?.timestampWrites("mosaic");
    const passEncoder = commandEncoder.beginRenderPass({
      label: "Mosaic shader render pass",
      colorAttachments: this.colorAttachments,
      timestampWrites,
    });
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.setVertexBuffer(1, this.positionsBuffer);
    passEncoder.setBindGroup(0, this.bindGroup);
    const numVerts = this.vertexBuffer.size / (2 * Float32Array.BYTES_PER_ELEMENT);
    passEncoder.draw(numVerts, this.tilePositions.length);
    passEncoder.end();
  }

  @reactively private get pipeline(): GPURenderPipeline {
    return mosaicPipeline({
      device: this.device,
      destFormat: this.destFormat,
      srcTextureType: this.srcTextureType,
      renderShape: this.renderShape,
    });
  }

  @reactively private get destFormat(): GPUTextureFormat {
    return this.destTexture.format;
  }

  @reactively private get renderShape(): RenderShape {
    const spacing = this.spacing;
    if (this.mosaicShape === "circle" && spacing[0] >= 0 && spacing[1] >= 0) {
      return "circle";
    } else {
      return "polygon";
    }
  }

  @reactively private get srcTextureType(): SampledTextureType2D {
    if (this.srcTexture instanceof GPUTexture) {
      return "texture_2d<f32>";
    } else if (this.srcTexture instanceof GPUExternalTexture) {
      return "texture_external";
    } else {
      throw new Error(`Unknown texture type ${this.srcTexture}`);
    }
  }

  @reactively get debugBuffer(): GPUBuffer {
    const buffer = createDebugBuffer(this.device, "MosaicShader debug");
    return buffer;
  }

  @reactively private get colorAttachments(): GPURenderPassColorAttachment[] {
    const destTexture = this.destTexture;
    const view = destTexture.createView({ label: "view-" + destTexture.label });

    return [
      {
        view,
        clearValue: this.backgroundColor,
        storeOp: "store",
        loadOp: "clear",
      },
    ];
  }

  @reactively private get vertexBuffer(): GPUBuffer {
    const verts = this.shapeVerts;
    const usage = GPUBufferUsage.VERTEX;
    const buffer = filledGPUBuffer(this.device, verts, usage, "mosaic-verts");
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  /** scale the shape to the requested size
   * returns verts in NDC coords [-1,1] */
  @reactively private get shapeVerts(): number[] {
    const window = this.destSize;
    const [xt, yt] = this.mosaicSize.map((tile, i) => tile / window[i]);

    const scaledVertsNDC = this.rawVerts.map(([x, y]) => [x * xt, y * yt]);
    return scaledVertsNDC.flat();
  }

  @reactively({ equals: deepEqual }) private get destSize(): Vec2 {
    const { width, height } = this.destTexture;
    return [width, height];
  }

  @reactively private get rawVerts(): Vec2[] {
    const shapeType = this.mosaicShape;
    if (shapeType == "circle") {
      return circleStrip(this.circleRadius);
    } else {
      dsert(shapeType === "square");
      return squareVertsNDC;
    }
  }

  @reactively private get circleRadius(): number {
    const maxDim = Math.max(...this.mosaicSize);
    const radius = Math.max(maxDim / 2, 0.5);
    return radius;
  }

  @reactively private get positionsBuffer(): GPUBuffer {
    const usage = GPUBufferUsage.VERTEX;
    const positions = this.tilePositions;
    const buffer = this.device.createBuffer({
      label: "mosaic-positions",
      size: positions.length * Float32Array.BYTES_PER_ELEMENT * 2,
      usage,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(positions.flat());
    buffer.unmap();
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  /** tile to cover with mosaics
   *
   * return center of shapes in NDC coords [-1,1] */
  @reactively private get tilePositions(): Vec2[] {
    const spots: Vec2[] = [];
    const [width, height] = this.destSize;
    const [sizeX, sizeY] = this.mosaicSize;
    const [spaceX, spaceY] = this.spacing;

    const sizeXndc = (2 * sizeX) / width;
    const sizeYndc = (2 * sizeY) / height;
    const spaceXndc = (4 * spaceX) / width; // 2x for space on both sides
    const spaceYndc = (4 * spaceY) / height;

    const minStep = 2 / Math.max(width, height); // ensure tiles are at least 1x1 pixel

    const dx = Math.max(sizeXndc + spaceXndc, minStep);
    const dy = Math.max(sizeYndc + spaceYndc, minStep);
    const halfDx = dx / 2;
    const halfDy = dy / 2;

    const rowOffsetNdc = (this.rowOffset * 2) / width;
    const xStart = -1 + sizeXndc / 2 + spaceYndc;
    const yStart = -1 + sizeYndc / 2 + spaceXndc;
    let rowStart = xStart;
    for (let y = yStart; y < 1 + halfDy; y += dy) {
      for (let x = rowStart; x < 1 + halfDx; x += dx) {
        spots.push([x, y]);
      }
      rowStart -= rowOffsetNdc;
      if (rowStart < xStart - sizeXndc) {
        rowStart = xStart;
      }
    }
    return spots;
  }

  @reactively private get uniforms(): GPUBuffer {
    const buffer = this.device.createBuffer({
      label: "mosaic-uniforms",
      size: Float32Array.BYTES_PER_ELEMENT * 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    reactiveTrackUse(buffer, this.usageContext);
    return buffer;
  }

  @reactively private updateUniforms(): void {
    if (this.mosaicShape === "circle") {
      const color = this.backgroundColor;
      const innerRadius = this.circleRadius - circleFeather;
      const floats = new Float32Array([...color, innerRadius, circleFeather]);
      this.device.queue.writeBuffer(this.uniforms, 0, floats);
    }
  }

  @reactively private get bindGroup(): GPUBindGroup {
    const srcResource = textureResource(this.srcTexture);

    return this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniforms } },
        { binding: 1, resource: srcResource },
        { binding: 11, resource: { buffer: this.debugBuffer } },
      ],
    });
  }
}
