## Plugins for the Thimbleberry Image Transform Demo 
[mosaic plugin]: ../image-demo/src/plugins/MosaicPlugin.ts
[plugin api]: ../image-demo/src/ImagePlugins.ts
[main doc]: ../README.md

The Thimbleberry image demo application includes a simple [plugin api][] to add image transforms.

1. Your plugin initialization function is passed two arguments:
   a `GPUDevice` and an `imageDirty()` function.
    - Use the provided `GPUDevice` to create your image transform shader.
    - Your shader should export the following properties:
      - `.srcTexture`, `.srcSize`, and `.destTexture` as mutable properties. 
      Read the latest values of these properties when rendering,
      the app may change them with every frame.
      - `.commands()` - implement this function to add the rendering commands for
      your shader to a provided `GPUCommandEncoder`.
      The app will call `commands()` so your shader can participate in rendering each frame.
    - Return your shader and its name.
1. Edit the app's list of image transform plugins to include yours:
    ```
    /** current plugins in the image demo app */
    export const plugins: SetupPlugin[] = [mosaicPlugin, equalizeUnitPlugin, /* your plugin here */];
    ```
1. Optionally, create some UI controls so that the demo user can modify your shader's settings.
    - Along with your shader, return the settings UI as an HTML element or partially rendered Lit component.
    - Call `imageDirty()` if the settings change so that the image will update.

Here's an example image transform plugin, the [mosaic plugin][]:

```
export function mosaicPlugin(args: PluginSetup): InitializedPlugin {
  const { device, imageDirty } = args;
  const mosaic = new MosaicShader({ device });               // create the shader
  const settingsUI = new MosaicSettings(mosaic, imageDirty); // create some ui controls
  return { name: "mosaic", component: mosaic, settingsUI};   // return the name, shader, and ui
}
```

Send a pull request if you write an image transform that you'd like to show in the demo app.

## Thimbleberry Documentation
See the [main doc][] for other useful things in Thimbleberry.