import { OverlayTrigger } from "@spectrum-web-components/overlay";
import { html, TemplateResult } from "lit-html";
import { LitElement } from "lit";
import { createRef, ref } from "lit-html/directives/ref.js";
import { customElement } from "lit/decorators.js";
import "@spectrum-web-components/overlay/overlay-trigger.js";
import "@spectrum-web-components/popover/sp-popover.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-help-outline.js";
import "@spectrum-web-components/link/sp-link.js";
import "./NavButton";
import { savedSettings, updateSavedSettings } from "./SavedSettings";

/** Help button and help contents */
@customElement("app-help")
export class AppHelp extends LitElement {
  private triggerRef = createRef<OverlayTrigger>();

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.updateComplete;
    const trigger = this.triggerRef.value;

    /** show help when the user first starts the app */
    if (!savedSettings().helpSeen) {
      trigger && (trigger.open = "click");
      updateSavedSettings({ helpSeen: true });
    }
  }

  render(): TemplateResult {
    // LATER is there a way to style the popover with css?
    return html`
      <overlay-trigger ${ref(this.triggerRef)}>
        <nav-button slot="trigger">
          Help
          <sp-icon-help-outline slot="icon"></sp-icon-help-outline>
        </nav-button>
        <sp-popover
          style="max-width: 40rem"
          slot="click-content"
          tip
          dialog
          placement="right">
          <div style="display:flex; justify-content:center;">
            <b>Thimbleberry Image Transformer</b>
          </div>

          <p style="padding-left:2rem">
            <i> Transform images and video in the browser, powered by WebGPU. </i>
          </p>
          <p>
            To start, choose a source from the samples. Or drag and drop your own file. Or
            use the camera button. Then have fun playing with the image transforms!
          </p>

          <p>
            Want to write your own image transform? See the
            <sp-link
              href="https://github.com/mighdoll/thimbleberry/tree/main/doc/Image-Transforms.md"
              >documentation</sp-link
            >.
          </p>
        </sp-popover>
      </overlay-trigger>
    `;
  }
}
