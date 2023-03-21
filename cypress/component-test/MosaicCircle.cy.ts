import {
  configureCanvas,
  labeledGpuDevice,
  mapN,
  printBuffer,
  printTexture,
  ShaderGroup,
  Vec2,
} from "thimbleberry/shader-util";
import { MosaicShader } from "./../../image-demo/src/shaders/MosaicShader";
import { insertCanvas } from "./util/InsertCanvas";
import { makeTexture } from "./util/MakeTexture";

it("render circle mosaic", async () => {
  console.clear();
  const size: Vec2 = [100,100];
  const device = await labeledGpuDevice();
  const redData = mapN(size[1], () => mapN(size[0], () => [255, 0, 0, 255]));
  const srcTexture = makeTexture(device, redData, "rgba8unorm", "srcTexture");

  insertCanvas(size).then(async canvasSelection => {
    const canvas = canvasSelection[0];
    const canvasContext = configureCanvas(device, canvas, true);
    const destTexture = canvasContext.getCurrentTexture();
    destTexture.label = "destTexture";
    const mosaic = new MosaicShader({
      device,
      srcTexture,
      destTexture,
      mosaicSize: size,
      spacing: [0, 0],
      backgroundColor: [0, 0, 1, 1],
      mosaicShape: "circle",
    });

    const shaderGroup = new ShaderGroup(device, mosaic);
    shaderGroup.dispatch();

    // await printTexture(device, srcTexture, 0);
    // await printTexture(device, mosaic.destTexture, 2);
    // await printBuffer(device, mosaic.debugBuffer);
  });
});
