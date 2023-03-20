import { PluginSettingsTray } from './PluginSettingsTray';
import { InitializedPlugin } from './ImagePlugins';
import { HasReactive, reactively } from "@reactively/decorate";

export type DemoSource = "empty" | "image" | "camera" | "video";
export type PlayState = "start" | "stop" | "playing" | "pause";

/** global reactive state for the application */
export class AppState extends HasReactive {
  @reactively srcUrl = "bird.jpg";
  @reactively dirty = true; // true if image needs to be redrawn
  @reactively playState: PlayState = "stop";
  @reactively src: DemoSource = "image"; // source from image, video or camera
  @reactively gpuDevice: GPUDevice | undefined;
  @reactively gpuUnavailable = false;
  @reactively initializedPlugins: InitializedPlugin[] = [];
}

export const appState = new AppState();

/** global registry of key UI elements in the app */
export class AppUI extends HasReactive {
  @reactively srcImage: HTMLImageElement | undefined;
  @reactively srcVideo: HTMLVideoElement | undefined;
  @reactively destCanvas: HTMLCanvasElement | undefined;
  @reactively pluginSettings: PluginSettingsTray | undefined;
}

export const appUI = new AppUI();

/** trigger an image transform refresh */
export function imageDirty(): void {
  appState.dirty = true;
}