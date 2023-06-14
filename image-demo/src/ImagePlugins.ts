import { TemplateResult } from "lit-html";
import { ComposableShader, Vec2 } from "thimbleberry/shader-util";
import { equalizeUnitPlugin } from "./plugins/EqualizePlugin";
import { mosaicPlugin } from "./plugins/MosaicPlugin";

/** current plugins in the image demo app */
export const plugins: SetupPlugin[] = [mosaicPlugin, equalizeUnitPlugin];

/** function to initialize an image transform plugin */
export type SetupPlugin = (params: PluginSetup) => InitializedPlugin;

/** passed to plugins to initialize */
export interface PluginSetup {
  device: GPUDevice;
  imageDirty: () => void;
}

/** an image transfroming shader with an optional settings UI */
export interface InitializedPlugin {
  component: ImageShaderComponent;
  name: string;
  settingsUI?: HTMLElement | TemplateResult | string;
}

/** a shader component that transforms an input texture to an output texture */
export interface ImageShaderComponent extends ComposableShader {
  srcTexture: GPUTexture | GPUExternalTexture;
  destTexture: GPUTexture;
  srcSize: Vec2;
}
