import { HasReactive, reactively } from "@reactively/decorate";
import { BinOpTemplate, sumTemplateUnsigned } from "../shader-util/BinOpTemplate";
import { limitWorkgroupLength } from "../shader-util/LimitWorkgroupLength";
import { Cache } from "../shader-util/MemoMemo";
import {
  assignParams,
  ValueOrFn,
  reactiveTrackUse
} from "../shader-util/ReactiveUtil";
import { ComposableShader } from "../shader-util/ComposableShader";
import { trackContext, trackUse } from "../shader-util/TrackUse";
import { ApplyScanBlocksShader } from "./ApplyScanBlocksShader";
import { PrefixScanShader } from "./PrefixScanShader";

export interface ScanSequenceArgs {
  device: GPUDevice;
  source: ValueOrFn<GPUBuffer>;
  reduceTemplate?: ValueOrFn<BinOpTemplate>;
  workgroupLength?: ValueOrFn<number>;
  pipelineCache?: <T extends object>() => Cache<T>;
}

const defaults: Partial<ScanSequenceArgs> = {
  workgroupLength: undefined,
  reduceTemplate: sumTemplateUnsigned,
  pipelineCache: undefined
};

/**
 * A cascade of shaders to do a prefix scan operation, based on a shader that
 * does a prefix scan of a workgroup sized chunk of data (e.g. perhaps 64 or 256 elements).
 * 
 * The scan operation is parameterized by a template mechanism. The user can 
 * instantiate a ScanSequence with sum to get prefix-sum, or use another template for
 * other parallel scan applications.
 *
 * For small data sets that fit in workgroup, only a single shader pass is needed.
 *
 * For larger data sets, a sequence of shaders is orchestrated as follows:
 * 1 one shader does a prefix scan on each workgroup sized chunk of data
 *   . it emits a partial prefix sum for each workgroup and single block level sum from each workgroup
 * 2 another instance of the same shader does a prefix scan on the block sums from the previous shader
 *   . the end result is a set of block level prefix sums
 * 3 a final shader sums the block prefix sums back with the partial prefix sums
 *
 * For for very large data sets, steps 2 and 3 repeat heirarchically.
 * Each level of summing reduces the data set by a factor of the workgroup size.
 * So three levels handles e.g. 16M elements (256 ** 3).
 */
export class ScanSequence extends HasReactive implements ComposableShader {
  @reactively reduceTemplate!: BinOpTemplate;
  @reactively source!: GPUBuffer;
  @reactively workgroupLength?: number;

  private device!: GPUDevice;
  private usageContext = trackContext();
  private pipelineCache?: <T extends object>() => Cache<T>;

  constructor(args: ScanSequenceArgs) {
    super();
    assignParams<ScanSequence>(this, args, defaults);
  }

  commands(commandEncoder: GPUCommandEncoder): void {
    this.shaders.forEach(s => s.commands(commandEncoder));
  }

  destroy(): void {
    this.usageContext.finish();
  }

  @reactively get prefixScan(): GPUBuffer {
    if (this.fitsInWorkGroup) {
      return this.sourceScan.prefixScan;
    } else {
      return this.applyScans.slice(-1)[0].prefixScan;
    }
  }

  @reactively private get shaders(): ComposableShader[] {
    return [this.sourceScan, ...this.blockScans, ...this.applyScans];
  }

  @reactively get sourceScan(): PrefixScanShader {
    const shader = new PrefixScanShader({
      device: this.device,
      source: this.source,
      emitBlockSums: true,
      reduceTemplate: this.reduceTemplate,
      workgroupLength: this.workgroupLength,
      label: "sourceScan",
      pipelineCache: this.pipelineCache
    });
    reactiveTrackUse(shader, this.usageContext);
    return shader;
  }

  @reactively get blockScans(): PrefixScanShader[] {
    const sourceElements = this.sourceSize / Uint32Array.BYTES_PER_ELEMENT;
    const wl = this.actualWorkgroupLength;
    const shaders: PrefixScanShader[] = [];

    // stitch a chain: blockSums as sources for scans
    let source = this.sourceScan.blockSums;
    let labelNum = 0;
    for (let elements = wl; elements < sourceElements; elements *= wl) {
      const last = elements * wl >= sourceElements;
      const blockScan = new PrefixScanShader({
        device: this.device,
        source,
        emitBlockSums: !last,
        reduceTemplate: this.reduceTemplate,
        workgroupLength: this.workgroupLength,
        label: `blockToBlock ${labelNum++}`,
        pipelineCache: this.pipelineCache
      });
      source = blockScan.blockSums;
      shaders.push(blockScan);
    }
    shaders.forEach(s => trackUse(s, this.usageContext));

    return shaders;
  }

  @reactively get sourceSize():number {
    return this.source.size;
  }

  @reactively get fitsInWorkGroup(): boolean {
    const sourceElems = this.sourceSize / Uint32Array.BYTES_PER_ELEMENT;
    return sourceElems <= this.sourceScan.actualWorkgroupLength;
  }

  @reactively get actualWorkgroupLength(): number {
    return limitWorkgroupLength(this.device, this.workgroupLength);
  }

  @reactively get applyScans(): ApplyScanBlocksShader[] {
    if (this.fitsInWorkGroup) {
      return [];
    }
    // block shaders output a prefixScan

    // list of all block producing shaders in reverse order
    const blockShadersReverse = [...this.blockScans].reverse();

    const blockPrefixesReverse = blockShadersReverse.map(s => s.prefixScan);
    // list of partial prefix scans to which we'll sum with the block prefixes
    const targetPrefixes = [...blockPrefixesReverse.slice(1), this.sourceScan.prefixScan];

    // stitch chain, with completed block prefixes as sources to the next applyBlock shader
    let blockSums = this.blockScans.slice(-1)[0].prefixScan;
    const allApplyBlocks = blockShadersReverse.map((s, i) => {
      const applyBlocks = new ApplyScanBlocksShader({
        device: this.device,
        partialScan: targetPrefixes[i],
        blockSums,
        reduceTemplate: this.reduceTemplate,
        workgroupLength: this.actualWorkgroupLength,
        label: `applyBlock ${i}`,
        pipelineCache: this.pipelineCache
      });
      blockSums = applyBlocks.prefixScan;
      return applyBlocks;
    });
    allApplyBlocks.forEach(s => trackUse(s, this.usageContext));
    return allApplyBlocks;
  }
}
