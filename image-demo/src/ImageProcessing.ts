import { HasReactive, reactively } from "@reactively/decorate";
import { dErr } from "berry-pretty";
import {
  Vec2,
  configureCanvas,
  csvReport,
  gpuTiming,
  textureFromImageUrl,
} from "thimbleberry/shader-util";
import { appState, appUI } from "./AppState";
import { registerVideoLoop } from "./VideoLoop";
import { withTimingAsync } from "./WithTiming";

export type TransformFrame = (
  srcTexture: GPUTexture | GPUExternalTexture,
  srcSize: Vec2,
  destTexture: GPUTexture
) => void;

/**
 * Controller to trigger image transformations from a souce image element
 * and a source video element to an output canvasContext.
 * A user provided callback function is called once per image or video frame.
 *
 * Since source and destination textures may change with every frame,
 * the user should fetch the textures via the provided
 * textureAccessors in the callback function.
 */
export class ImageProcessing extends HasReactive {
  private transformFrame: TransformFrame;

  // loop counters and flags
  private inFrame = false; // reentrancy guard for frame loop
  private externalCount = 0;
  private canvasCount = 0;
  private timedFrames = 0;

  @reactively private get canvasContext(): GPUCanvasContext {
    if (appState.gpuDevice && appUI.destCanvas) {
      return configureCanvas(appState.gpuDevice, appUI.destCanvas, true);
    } else {
      throw new Error("not yet initialized");
    }
  }

  constructor(transformFrame: TransformFrame) {
    super();
    this.transformFrame = transformFrame;
  }

  @reactively({ effect: true }) transform(): void {
    const src = appState.src;
    if (appState.dirty) {
      if (src === "image") {
        this.transformImage();
      } else if (
        (src === "video" || src === "camera") &&
        appState.playState === "pause"
      ) {
        this.transformVideoFrame();
      }
      appState.dirty = false;
    }
  }

  @reactively({ effect: true }) setupVideo(): void {
    const video = appUI.srcVideo;
    if (!video) {
      return;
    }

    // callback triggers once per frame when video stream is playing
    registerVideoLoop(video, this.transformVideoFrame.bind(this));
  }

  /** transform one src image */
  private async transformImage(): Promise<void> {
    const device = appState.gpuDevice;
    if (!device) {
      dErr("no device");
      return;
    }

    // TODO cache texture (after chrome bug with texture loading is fixed)
    const imageTexture = await textureFromImageUrl(device, appState.srcUrl);
    const srcSize = [imageTexture.width, imageTexture.height] as Vec2;
    this.nextFrame(imageTexture, srcSize);
  }

  /** transform one video frame  */
  private async transformVideoFrame(): Promise<void> {
    const video = appUI.srcVideo;
    if (!video) {
      dErr("no video");
      return;
    }
    const device = appState.gpuDevice;
    if (!device) {
      dErr("no device");
      return;
    }

    const srcTexture = device.importExternalTexture({ source: video });
    srcTexture.label = `external texture ${this.externalCount++}`;
    const srcSize: Vec2 = [video.videoWidth, video.videoHeight];
    await this.nextFrame(srcTexture, srcSize);
  }

  /** transform one src image or video frame */
  private async nextFrame(
    srcTexture: GPUTexture | GPUExternalTexture,
    srcSize: Vec2
  ): Promise<void> {
    if (this.inFrame) {
      // dlog("skipping frame, not completed previous", this.canvasCount++);
      return;
    }
    const { time: clockTime } = await withTimingAsync(async () => {
      this.inFrame = true;
      // ensure internal canvas size matches src size so shader needn't resize
      const canvas = this.canvasContext.canvas as HTMLCanvasElement;
      canvas.width = srcSize[0];
      canvas.height = srcSize[1];

      // fetch the current canvas texture
      const destTexture = this.canvasContext.getCurrentTexture();
      destTexture.label = `canvas current texture ${this.canvasCount++}`;

      // trigger callback
      this.transformFrame(srcTexture, srcSize, destTexture);
      if (gpuTiming) {
        await appState.gpuDevice!.queue.onSubmittedWorkDone();
      }
    });
    await this.reportTiming(srcTexture instanceof GPUTexture, clockTime);
    this.inFrame = false;
  }

  private async reportTiming(noSampling: boolean, clockTime: number): Promise<void> {
    if (gpuTiming) {
      this.timedFrames++;
      if (noSampling || this.timedFrames % 60 === 1) {
        const report = await gpuTiming.results();
        const csvText = csvReport(report, { clockTime: clockTime.toFixed(2) });
        console.log(csvText);
      }
    }
    gpuTiming?.restart();
  }
}
