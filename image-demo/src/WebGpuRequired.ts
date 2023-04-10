import { DialogWrapper } from "@spectrum-web-components/dialog";
import "@spectrum-web-components/dialog/sp-dialog-wrapper.js";
import { LitElement } from "lit";
import { html, TemplateResult } from "lit-html";
import { createRef, ref } from "lit-html/directives/ref.js";
import { customElement } from "lit/decorators.js";
import { appState } from "./AppState";

/** Display a warning modal dialog if the browser isn't capable of current webgpu. */
@customElement("webgpu-required")
export class WebGpuRequired extends LitElement {
  private dialogRef = createRef<DialogWrapper>();

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.updateComplete;
    if (appState.gpuUnavailable) {
      const dialog = this.dialogRef.value;
      dialog && (dialog.open = true);
    }
  }

  override render(): TemplateResult {
    return html`
      <sp-dialog-wrapper
        ${ref(this.dialogRef)}
        headline="WebGPU required"
        dismissable
        underlay
        }>
        <p>This demo requires a browser that supports WebGPU.</p>
      </sp-dialog-wrapper>
    `;
  }
}
