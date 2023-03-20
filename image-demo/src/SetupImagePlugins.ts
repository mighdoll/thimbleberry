import { derr } from "berry-pretty";
import { Vec2 } from "thimbleberry/shader-util";
import { appState, appUI, imageDirty } from "./AppState";
import { ImageChain } from "./ImageChain";
import { ImageShaderComponent, plugins } from "./ImagePlugins";
import { TransformFrame } from "./ImageProcessing";

export interface TransformImage {
  transformFrame: TransformFrame;
}

/** Intialize the image transform plugins to setup the shaders and UI controls 
 * 
 * stores thie initalized plugins in global app state
 * 
 * @returns a transformFrame function that runs all of the currently enabled shaders 
 *  to transform a source texture to destination texture.
*/
export function setupImagePlugins(): TransformImage {
  const device = appState.gpuDevice!;
  if (!device) {
    throw new Error("gpuDevice not defined");
  }

  const pluginParams = {
    device,
    imageDirty,
  };

  // initialize plugins
  const initPlugins = plugins.map(plugin => plugin(pluginParams));
  appState.initializedPlugins = initPlugins;

  const chain = new ImageChain({ device });

  function transformFrame(
    srcTexture: GPUTexture | GPUExternalTexture,
    srcSize: Vec2,
    destTexture: GPUTexture
  ): void {
    chain.components = enabledComponents();
    chain.srcTexture = srcTexture;
    chain.srcSize = srcSize;
    chain.destTexture = destTexture;
    chain.dispatch();
  }

  return { transformFrame };
}

function enabledComponents(): ImageShaderComponent[] {
  const tray = appUI.pluginSettings;
  if (tray) {
    return tray.enabledComponents();
  } else {
    derr("no tray, no components");
    return [];
  }
}
