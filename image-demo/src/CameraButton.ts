import "@spectrum-web-components/icons-workflow/icons/sp-icon-camera.js";
import { dErr } from "berry-pretty";
import { LitElement } from "lit";
import { html, TemplateResult } from "lit-html";
import { customElement } from "lit/decorators.js";
import { appState, appUI } from "./AppState";
import "./NavButton";

/** camera button, enables webcam when clicked */
@customElement("camera-button")
export class CameraButton extends LitElement {
  private async startCamera(): Promise<void> {
    if (appState.src !== "camera" || appState.playState !== "playing") {
      appState.src = "camera";
      appState.playState = "playing";
      appState.srcUrl = "";
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      const video = appUI.srcVideo;
      if (!video) {
        dErr("no video?!");
        return;
      }
      video.srcObject = mediaStream;
    }
  }

  override render(): TemplateResult {
    return html`
      <nav-button @click=${this.startCamera}>
        Webcam
        <sp-icon-camera slot="icon"></sp-icon-camera>
      </nav-button>
    `;
  }
}
