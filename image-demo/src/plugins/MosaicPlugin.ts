import { ColorArea } from "@spectrum-web-components/color-area";
import "@spectrum-web-components/color-area/sp-color-area.js";
import { ColorSlider } from "@spectrum-web-components/color-slider";
import "@spectrum-web-components/color-slider/sp-color-slider.js";
import "@spectrum-web-components/field-label/sp-field-label.js";
import "@spectrum-web-components/menu/sp-menu-item.js";
import { Picker } from "@spectrum-web-components/picker";
import "@spectrum-web-components/picker/sp-picker.js";
import { Slider } from "@spectrum-web-components/slider";
import "@spectrum-web-components/slider/sp-slider.js";
import { dErr } from "berry-pretty";
import { html, LitElement } from "lit";
import { TemplateResult } from "lit-html";
import { customElement } from "lit/decorators.js";
import { Vec2 } from "thimbleberry/shader-util";
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

  private sizeSlide(e: Event & { target: Slider }): void {
    const targetLength = e.target.value;
    const mosaicSize = this.mosaic.mosaicSize;
    const longSide = Math.max(...mosaicSize);
    const scale = targetLength / longSide;
    this.mosaic.mosaicSize = mosaicSize.map(s => s * scale) as Vec2;
    this.imageDirty();
    this.requestUpdate();
  }

  private widthSlide(e: Event & { target: Slider }): void {
    const width = e.target.value;
    const size = this.mosaic.mosaicSize;
    this.mosaic.mosaicSize = [width, size[1]];
    this.imageDirty();
    this.requestUpdate();
  }

  private heightSlide(e: Event & { target: Slider }): void {
    const height = e.target.value;
    const size = this.mosaic.mosaicSize;
    this.mosaic.mosaicSize = [size[0], height];
    this.imageDirty();
    this.requestUpdate();
  }

  private rowOffsetSlide(e: Event & { target: Slider }): void {
    this.mosaic.rowOffset = e.target.value;
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

  private pickShape(e: Event & { target: Picker }): void {
    const shape = e.target.value;
    if (shape === "circle" || shape == "square") {
      this.mosaic.mosaicShape = shape;
      this.imageDirty();
    } else {
      dErr("unexpected shape", shape);
    }
  }

  render(): TemplateResult {
    return html`
      <div>
        <sp-field-label>tile shape</sp-field-label>
        <sp-picker @change=${this.pickShape} value=${this.mosaic.mosaicShape} size="s">
          <sp-menu-item value="square">square</sp-menu-item>
          <sp-menu-item value="circle">circle</sp-menu-item>
        </sp-picker>
        <sp-slider
          label="size"
          @input=${this.sizeSlide}
          min="1"
          value=${Math.max(...this.mosaic.mosaicSize)}
          max="100">
        </sp-slider>
        <sp-slider
          label="width"
          @input=${this.widthSlide}
          min="1"
          value=${this.mosaic.mosaicSize[0]}
          step="1"
          max="100">
        </sp-slider>
        <sp-slider
          label="height "
          @input=${this.heightSlide}
          min="1"
          value=${this.mosaic.mosaicSize[1]}
          step="1"
          max="100">
        </sp-slider>
        <sp-slider
          label="row offset"
          @input=${this.rowOffsetSlide}
          min="0"
          value=${this.mosaic.rowOffset}
          max="50"
          step="1">
        </sp-slider>
        <sp-slider
          label="spacing"
          @input=${this.spacingSlide}
          min="-10"
          value=${this.mosaic.spacing[0]}
          max="10"
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
