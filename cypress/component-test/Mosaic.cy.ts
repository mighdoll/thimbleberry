import {
  configureCanvas,
  imageArrayToRows,
  labeledGpuDevice,
  ShaderGroup,
  Sliceable,
  Vec2,
  Vec4,
  withTextureCopy
} from "thimbleberry/shader-util";
import { MosaicShader } from "./../../image-demo/src/shaders/MosaicShader";
import { insertCanvas } from "./util/InsertCanvas";
import { sequenceTexture } from "./util/SequenceTexture.js";

it("render simple mosaic", async () => {
  const size: Vec2 = [6, 6];
  const device = await labeledGpuDevice();
  const st = sequenceTexture(device, size, "rgba8unorm", 1.5);
  const { texture: srcTexture, data: srcData } = st;

  insertCanvas(size).then(async (canvasSelection) => {
    const canvas = canvasSelection[0];
    const canvasContext = configureCanvas(device, canvas, true);
    const mosaic = new MosaicShader({
      device,
      srcTexture,
      destTexture: canvasContext.getCurrentTexture(),
      mosaicSize: [3, 3],
      spacing: [0, 0],
    });

    const shaderGroup = new ShaderGroup(device, mosaic);
    shaderGroup.dispatch();

    // we expect sample from center of each src tile
    const srcRows = imageArrayToRows(srcData, size[1], 4, 1);
    const [ul, ur, ll, lr] = fourCenters(srcRows);

    // verify
    await withTextureCopy(device, mosaic.destTexture, (data) => {
      const rows = imageArrayToRows(data, size[1], 4, 1);
      expect(rows[0]).deep.equals([ul, ul, ul, ur, ur, ur]);
      expect(rows[4]).deep.equals([ll, ll, ll, lr, lr, lr]);
    });

    // debug (comment out awaited test above so outputTexture doesn't expire)
    // await printTexture(device, srcTexture, 1);
    // await printTexture(device, mosaic.outputTexture, 1);
    // await printBuffer(device, mosaic.debugBuffer);
  });
});

it("simple mosaic with border", async () => {
  const size: Vec2 = [6, 6];
  const device = await labeledGpuDevice();
  const st = sequenceTexture(device, size, "rgba8unorm", 1.5);
  const { texture: srcTexture, data: srcData } = st;

  insertCanvas(size).then(async (canvasSelection) => {
    const canvas = canvasSelection[0];
    const canvasContext = configureCanvas(device, canvas, true);
    const mosaic = new MosaicShader({
      device,
      srcTexture,
      destTexture: canvasContext.getCurrentTexture(),
      mosaicSize: [1, 1],
      spacing: [1, 1],
    });

    const shaderGroup = new ShaderGroup(device, mosaic);
    shaderGroup.dispatch();

    // we expect sample from center of each src tile
    const srcRows = imageArrayToRows(srcData, size[1], 4, 1);
    const [ul, ur, ll, lr] = fourCenters(srcRows);

    // verify
    await withTextureCopy(device, mosaic.destTexture, (data) => {
      const rows = imageArrayToRows(data, size[1], 4, 1);
      expect(rows[1]).deep.equals([0, ul, 0, 0, ur, 0]);
      expect(rows[4]).deep.equals([0, ll, 0, 0, lr, 0]);
    });
  });
});

function fourCenters(rows: Sliceable<number>[]): Vec4 {
  const ul = Math.trunc(rows[1][1]);
  const ur = Math.trunc(rows[1][4]);
  const ll = Math.trunc(rows[4][1]);
  const lr = Math.trunc(rows[4][4]);
  return [ul, ur, ll, lr];
}
