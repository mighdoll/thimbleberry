import { autoStabilize } from "@reactively/core";
import { reactively } from "@reactively/decorate";
import { ReactiveLitElement } from "@reactively/lit";
import "@spectrum-web-components/theme/sp-theme.js";
import "@spectrum-web-components/theme/src/themes.js";
import { css } from "lit";
import { html, TemplateResult } from "lit-html";
import { customElement } from "lit/decorators.js";
import { appState } from "./AppState";
import "./DestinationArea";
import { ImageProcessing } from "./ImageProcessing";
import "./LeftNav";
import { PluginSettingsTray } from "./PluginSettingsTray";
import { setupImagePlugins } from "./SetupImagePlugins";
import "./SourceArea";
import "./WebGpuRequired";

/** root element for the image transformation demo app */
@customElement("main-app")
export class MainApp extends ReactiveLitElement {
  static styles = css`
    .main-columns {
      display: flex;
    }
  `;

  constructor() {
    super();
    autoStabilize();
  }

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.updateComplete;
    const device = await requestDevice();
    if (device) {
      appState.gpuDevice = device;
      const { transformFrame } = setupImagePlugins();
      new ImageProcessing(transformFrame);
    } else {
      appState.gpuUnavailable = true;
    }
  }

  @reactively private tray: PluginSettingsTray | undefined;

  override reactiveRender(): TemplateResult {
    return html` <sp-theme theme="spectrum" color="light" scale="large">
      <webgpu-required></webgpu-required>
      <div class="main-columns">
        <left-nav></left-nav>
        <source-area></source-area>
        <destination-area></destination-area>
      </div>
    </sp-theme>`;
  }
}

/** get the gpu device, with timestamp queries enabled if possible */
async function requestDevice(): Promise<GPUDevice | undefined> {
  const gpu = navigator.gpu;
  if (!gpu) {
    return undefined;
  }
  const adapter = await gpu.requestAdapter();
  const requiredFeatures: GPUFeatureName[] = [];
  const timestamps = adapter?.features.has("timestamp-query");
  timestamps && requiredFeatures.push("timestamp-query");
  const device = await adapter!.requestDevice({
    requiredFeatures,
  });

  return device;
}
