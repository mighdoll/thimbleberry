import "@spectrum-web-components/accordion/sp-accordion.js";
import "@spectrum-web-components/action-button/sp-action-button.js";
import "@spectrum-web-components/action-group/sp-action-group.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-camera.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-gauge4.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-gears.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-image-add.js";
import { css, LitElement } from "lit";
import { html, TemplateResult } from "lit-html";
import { customElement } from "lit/decorators.js";
import "./AppHelp";
import "./DebugSettings";
import "./PluginSettingsTray";
import "./SampleMedia";
import "./WebGpuRequired";
import "./CameraButton";
import "./NavButton";

/** Buttons on the left side of the screen */
@customElement("left-nav")
export class LeftNav extends LitElement {
  static styles = css``;

  override render(): TemplateResult {
    return html`
      <sp-action-group vertical>
        <app-help></app-help>
        <overlay-trigger>
          <nav-button slot="trigger">
            Image Transform
            <sp-icon-gears slot="icon"></sp-icon-gears>
          </nav-button>
          <sp-popover slot="click-content" dialog placement="right" open>
            <plugin-settings-tray> </plugin-settings-tray>
          </sp-popover>
        </overlay-trigger>
        <overlay-trigger>
          <nav-button slot="trigger">
            Sample Media
            <sp-icon-image-add slot="icon"></sp-icon-image-add>
          </nav-button>
          <sp-popover slot="click-content" tip dialog placement="right">
            <sample-media></sample-media>
          </sp-popover>
        </overlay-trigger>
        <camera-button></camera-button>
        <overlay-trigger>
          <nav-button slot="trigger">
            Debug
            <sp-icon-gauge4 slot="icon"></sp-icon-gauge4>
          </nav-button>
          <sp-popover slot="click-content" dialog placement="right" open>
            <debug-settings></debug-settings>
          </sp-popover>
        </overlay-trigger>
      </sp-action-group>
    `;
  }
}
