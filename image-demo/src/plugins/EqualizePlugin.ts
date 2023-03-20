import "@spectrum-web-components/color-slider/sp-color-slider.js";
import { Slider } from "@spectrum-web-components/slider";
import { html } from "lit";
import { TemplateResult } from "lit-html";
import { InitializedPlugin, PluginSetup } from "../ImagePlugins";
import { ColorEqualizeUnit } from "./../shaders/ColorEqualizeUnit";

export function equalizeUnitPlugin(params: PluginSetup): InitializedPlugin {
  const { device, imageDirty } = params;
  const colorEqualizeUnit = new ColorEqualizeUnit({ device });

  return {
    component: colorEqualizeUnit,
    name: "equalize unit histogram",
    settingsUI: equalizeUnitSettings(colorEqualizeUnit, imageDirty),
  };
}

function equalizeUnitSettings(
  colorEqualizeUnit: ColorEqualizeUnit,
  imageDirty: () => void
): TemplateResult {
  function slide(e: Event): void {
    colorEqualizeUnit.numBuckets = (e.target as Slider).value;
    imageDirty();
  }

  return html`
    <sp-slider
      @input=${slide}
      label="histogram bins"
      min="2"
      value=${colorEqualizeUnit.numBuckets}
      max="400"
      editable></sp-slider>
  `;
}
