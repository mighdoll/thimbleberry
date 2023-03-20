import { ColorArea } from "@spectrum-web-components/color-area";
import "@spectrum-web-components/color-area/sp-color-area.js";
import { ColorSlider } from "@spectrum-web-components/color-slider";
import "@spectrum-web-components/color-slider/sp-color-slider.js";
import "@spectrum-web-components/field-label/sp-field-label.js";
import { Slider } from "@spectrum-web-components/slider";
import "@spectrum-web-components/slider/sp-slider.js";
import { html, LitElement } from "lit";
import { TemplateResult } from "lit-html";
import { customElement } from "lit/decorators.js";
import { InitializedPlugin, PluginSetup } from "../ImagePlugins";
import { MosaicShader } from "../shaders/MosaicShader";

/** settings UI to adjust mosaic shader parameters */
@customElement("mosaic-settings")
class MosaicSettings extends LitElement {
  private mosaic: MosaicShader;
  private imageDirty: () => void;

  constructor(mosaic: MosaicShader, imageDirty: () => void) {
    super();
    this.mosaic = mosaic;
    this.imageDirty = imageDirty;
  }

  private sizeSlide(e: Event): void {
    const size = (e.target as Slider).value;
    this.mosaic.mosaicSize = [size, size];
    this.imageDirty();
  }

  private spacingSlide(e: Event): void {
    const spacing = (e.target as Slider).value;
    this.mosaic.spacing = [spacing, spacing];
    this.imageDirty();
  }

  private colorArea(e: Event & { target: ColorArea }): void {
    const color = e.target.color as string;
    this.setMosaicColor(color);
    this.requestUpdate();
  }

  private colorSlide(e: Event & { target: ColorSlider }): void {
    const color = e.target.color as string;
    this.setMosaicColor(color);
    this.requestUpdate();
  }

  private setMosaicColor(cssColor: string): void {
    const rgb = cssColor.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgb) {
      const r = parseInt(rgb[1]) / 255;
      const g = parseInt(rgb[2]) / 255;
      const b = parseInt(rgb[3]) / 255;
      this.mosaic.backgroundColor = [r, g, b, 1];
      this.imageDirty();
    }
  }

  private cssBackgroundColor(): string {
    const [r, g, b] = this.mosaic.backgroundColor;
    return `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
  }

  render(): TemplateResult {
    return html`
      <div>
        <sp-slider
          label="tile size"
          @input=${this.sizeSlide}
          min="1"
          value=${this.mosaic.mosaicSize[0]}
          max="100">
        </sp-slider>
        <sp-slider
          label="tile spacing"
          @input=${this.spacingSlide}
          min="-2"
          value=${this.mosaic.spacing[0]}
          max="5"
          step=".5">
        </sp-slider>
        <sp-field-label>background color</sp-field-label>
        <div style="padding-left: 2rem">
          <sp-color-area
            @input=${this.colorArea}
            style="width: 200px; height: 200px;"
            color=${this.cssBackgroundColor()}>
          </sp-color-area>
          <sp-color-slider
            @input=${this.colorSlide}
            color=${this.cssBackgroundColor()}
            style="width: 200px;">
          </sp-color-slider>
        </div>
      </div>
    `;
  }
}

/** demo app plugin for mosaic shader and settings */
export function mosaicPlugin(args: PluginSetup): InitializedPlugin {
  const { device, imageDirty } = args;
  const mosaic = new MosaicShader({ device });

  const settingsUI = new MosaicSettings(mosaic, imageDirty);
  return { name: "mosaic", component: mosaic, settingsUI };
}
