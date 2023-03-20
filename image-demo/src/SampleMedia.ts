import "@spectrum-web-components/action-button/sp-action-button.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-help-outline.js";
import "@spectrum-web-components/link/sp-link.js";
import "@spectrum-web-components/overlay/overlay-trigger.js";
import "@spectrum-web-components/popover/sp-popover.js";
import { css, LitElement } from "lit";
import { html, TemplateResult } from "lit-html";
import { customElement } from "lit/decorators.js";
import { appState, appUI } from "./AppState";

/** preloaded image and video content */
@customElement("sample-media")
export class SampleMedia extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      flex-wrap: nowrap;
    }
    .sample-media {
      width: 120px;
      height: 90px;
      padding: 8px;
    }
    .thumb {
      padding: 4px;
    }
    .thumb-label {
      justify-content: center;
      display: flex;
      margin: 0;
    }
  `;

  private image(e: Event & { target: HTMLImageElement }): void {
    appState.src = "image";
    appState.srcUrl = e.target.src;
    appState.dirty = true;
  }

  private video(e: Event & { target: HTMLVideoElement }): void {
    appState.src = "video";
    appState.srcUrl = e.target.src;
    appState.dirty = true;
    appUI.srcVideo && (appUI.srcVideo.srcObject = null);
  }

  override render(): TemplateResult {
    return html`
      <div class="thumb">
        <img @click=${this.image} src="bird.jpg" class="sample-media" />
        <p class="thumb-label">bird</p>
      </div>
      <div class="thumb">
        <img @click=${this.image} src="bugs.jpg" class="sample-media" />
        <p class="thumb-label">bugs</p>
      </div>
      <div class="thumb">
        <video @click=${this.video} src="jump.mp4" type="video/mp4" class="sample-media">
          no-video
        </video>
        <p class="thumb-label">jump</p>
      </div>
    `;
  }
}
