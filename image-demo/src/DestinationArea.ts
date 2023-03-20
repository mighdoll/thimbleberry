import { appUI } from './AppState';
import { ref } from "lit-html/directives/ref.js";
import { html, TemplateResult } from "lit-html";
import { css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import "@spectrum-web-components/dropzone/sp-dropzone.js";

/** destination canvas for the image/video transformations */
@customElement("destination-area")
export class DestinationArea extends LitElement {
  static styles = css`
    canvas {
      border: solid;
      width: 600px;
      height: 450px;
      margin: 8px;
      object-fit: contain;
    }
  `;

  private canvasRef(el: Element | undefined): void {
    appUI.destCanvas = el as HTMLCanvasElement | undefined;
  }


  override render(): TemplateResult {
    return html`<canvas ${ref(this.canvasRef)} width="1200" height="900">
    </canvas> `;
  }
}
