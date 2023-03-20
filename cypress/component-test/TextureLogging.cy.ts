import { labeledGpuDevice } from "thimbleberry/shader-util";
import { trackUse, withAsyncUsage } from "thimbleberry/shader-util";
import { imageArrayToString, withTextureCopy } from "thimbleberry/shader-util";
import { numComponents } from "thimbleberry/shader-util";
import { makeTexture } from "./util/MakeTexture";

it("read/write r16float ", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const srcData = [
      [0, 0, 1, 1],
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 4, 4],
    ];

    const texture = makeTexture(device, srcData, "r16float");
    await withTextureCopy(device, texture, (data) => {
      expect([...data]).to.deep.equal(srcData.flat());
    });
  });
});

it("read/write r32float", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const srcData = [
      [0, 0, 1, 1],
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 4, 4],
    ];
    const texture = makeTexture(device, srcData, "r32float");
    await withTextureCopy(device, texture, (data) => {
      expect([...data]).to.deep.equal(srcData.flat());
    });
  });
});

it("texture to String", async () => {
  await withAsyncUsage(async () => {
    const device = await labeledGpuDevice();
    trackUse(device);

    const srcData = [
      [0, 1],
      [2, 3],
    ];
    // prettier-ignore
    const expected = [
      `   0:    0   1`, 
      `   1:    2   3`].join("\n");
    const texture = makeTexture(device, srcData, "r16float");
    const components = numComponents(texture.format);
    await withTextureCopy(device, texture, (data) => {
      const s = imageArrayToString(data, texture.height, components, 0);
      expect(s).to.equal(expected);
    });
  });
});
