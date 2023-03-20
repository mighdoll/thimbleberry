import { TemplateResult } from "lit-html";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import "@spectrum-web-components/action-button/sp-action-button.js";

/** A styled button for the left naviation array */
@customElement("nav-button")
export class NavButton extends LitElement {
  override render(): TemplateResult {
    return html`
      <sp-action-button style="display:flex; justify-content:flex-start">
        <slot></slot>
        <slot slot="icon" name="icon"></slot>
      </sp-action-button>
    `;
  }
}
