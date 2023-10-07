import { labeledGpuDevice } from "thimbleberry/shader-util";
import {
  trackRelease,
  trackUse,
  withAsyncUsage,
  withLeakTrack,
} from "thimbleberry/shader-util";
import { Vec2 } from "thimbleberry/shader-util";
import { ConvertTextureShader } from "thimbleberry/shaders";
import { withTextureCopy } from "thimbleberry/shader-util";
import { ShaderGroup } from "thimbleberry/shader-util";
import { rgbaFloatRedToFloat, rgbaUintRedToFloat } from "thimbleberry/shader-util";
import { make3dSequence, makeEmptyTexture, makeTexture } from "./util/MakeTexture";
import { mapN } from "../../src/shader-util/MapN";

it("rgba8unorm to r32float", () => {
  cy.then(async () => {
    await withAsyncUsage(async () => {
      const device = await labeledGpuDevice();
      trackUse(device);
      const data = make3dSequence([4, 4], 4);
      const srcTexture = makeTexture(device, data, "rgba8unorm", "convert src");
      const size = [srcTexture.width, srcTexture.height] as Vec2;
      const destTexture = makeEmptyTexture(device, size, "convert dest", "r32float");
      await withLeakTrack(async () => {
        const convertTexture = new ConvertTextureShader({
          device,
          srcTexture,
          destTexture,
          template: rgbaFloatRedToFloat,
        });
        trackUse(convertTexture);
        const group = new ShaderGroup(device, convertTexture);
        group.dispatch();
        const expected = mapN(16, (i) => i);
        await withTextureCopy(device, destTexture, (data) => {
          expect([...data]).deep.equals(expected);
        });
        trackRelease(convertTexture);
      });
    });
  });
});

it("rgba8uint to r32float", () => {
  cy.then(async () => {
    await withAsyncUsage(async () => {
      const device = await labeledGpuDevice();
      trackUse(device);
      const data = make3dSequence([4, 4], 4);
      const srcTexture = makeTexture(device, data, "rgba8uint", "convert src");
      const size = [srcTexture.width, srcTexture.height] as Vec2;
      const destTexture = makeEmptyTexture(device, size, "convert dest", "r32float");
      const convertTexture = new ConvertTextureShader({
        device,
        srcTexture,
        destTexture,
        template: rgbaUintRedToFloat,
      });
      const group = new ShaderGroup(device, convertTexture);
      group.dispatch();
      const expected = mapN(16, (i) => i);
      await withTextureCopy(device, destTexture, (data) => {
        expect([...data]).deep.equals(expected);
      });
    });
  });
});
