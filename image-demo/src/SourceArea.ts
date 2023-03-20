import { reactively } from "@reactively/decorate";
import { ReactiveLitElement } from "@reactively/lit";
import "@spectrum-web-components/dropzone/sp-dropzone.js";
import { css } from "lit";
import { html, TemplateResult } from "lit-html";
import { ref } from "lit-html/directives/ref.js";
import { customElement } from "lit/decorators.js";
import { appState, appUI } from "./AppState";
import { dropItem } from "./DropHandler";

/** UI component for the source area displaying either
 * an image, video or "empty" message
 */
@customElement("source-area")
export class SourceArea extends ReactiveLitElement {
  static styles = css`
    sp-dropzone {
      display: inline-flex;
      margin: 8px;
      padding: 0px;
    }
    .dropzone-contents {
      width: 600px;
      height: 450px;
      display: flex;
      justify-content: center;
      align-content: center;
      flex-wrap: wrap;
    }
    .dropzone-contents > * {
      object-fit: contain;
      width: 100%;
      height: 100%;
    }
    .hidden {
      display: none;
    }
  `;

  private sourceImageRef(el: Element | undefined): void {
    appUI.srcImage = el as HTMLImageElement;
  }

  private sourceVideoRef(el: Element | undefined): void {
    appUI.srcVideo = el as HTMLVideoElement;
  }

  @reactively private get emptySrc(): TemplateResult {
    const hidden = appState.src == "empty" ? "" : "hidden";
    return html`<div class=${hidden}>drop an image or video here</div>`;
  }

  @reactively private get imageSrc(): TemplateResult {
    const hidden = appState.src == "image" ? "" : "hidden";
    return html`<img
      ${ref(this.sourceImageRef)}
      class=${hidden}
      src=${appState.srcUrl} />`;
  }

  /** automaticaly fires to possibly turn off the video stream
   * when a non-video source becomes active */
  @reactively({ effect: true }) async videoOff(): Promise<void> {
    const src = appState.src;
    const active = src == "camera" || src == "video";
    const srcVideo = appUI.srcVideo;
    if (!active && srcVideo) {
      await pauseVideo(srcVideo);
      appState.playState = "stop";
      // CONSIDER is it necessary to stop the stream?
      const mediaStream = srcVideo.srcObject as MediaStream;
      mediaStream?.getTracks().forEach(t => t.stop());
      srcVideo.srcObject = null;
      srcVideo.src = "";
    }
  }

  @reactively private get videoSrc(): TemplateResult {
    const src = appState.src;
    const active = src == "camera" || src == "video";
    const hidden = active ? "" : "hidden";
    const srcUrl = active ? appState.srcUrl : "";

    return html`
      <video
        ${ref(this.sourceVideoRef)}
        class=${hidden}
        ?autoplay=${active}
        controls
        src=${srcUrl}>
        no video
      </video>
    `;
  }

  private async drop(e: Event): Promise<void> {
    const received = await dropItem(e);
    if (received) {
      if (received.fileType.startsWith("video/")) {
        appState.src = "video";
      } else {
        appState.src = "image";
      }
      appState.srcUrl = received.dataUrl;
      appState.dirty = true;
    }
  }

  override reactiveRender(): TemplateResult {
    return html`
      <sp-dropzone @sp-dropzone-drop=${this.drop}>
        <div class="dropzone-contents">
          ${this.emptySrc} ${this.imageSrc} ${this.videoSrc}
        </div>
      </sp-dropzone>
      <input type="file" style="display: none" />
    `;
  }
}

async function pauseVideo(video: HTMLVideoElement): Promise<void> {
  if (video.paused) {
    return;
  }

  let listener: EventListener;
  const promise = new Promise<void>(resolve => {
    listener = () => resolve();
    video.addEventListener("pause", listener);
  });
  promise.then(() => video.removeEventListener("pause", listener));

  video.pause();

  return promise;
}
