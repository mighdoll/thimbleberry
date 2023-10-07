import {
  labeledGpuDevice,
  make3dSequence,
  makeTexture,
  trackUse,
  withAsyncUsage,
  withTextureCopy
} from "thimbleberry";

it("filled texture", () => {
  cy.then(async () => {
    await withAsyncUsage(async () => {
      const device = await labeledGpuDevice();
      trackUse(device);
      const srcData = make3dSequence([4, 4], 4);
      const texture = makeTexture(device, srcData, "rgba8uint", "convert src");
      const expected = srcData.flat(10);
      await withTextureCopy(device, texture, data => {
        expect([...data]).deep.equals(expected);
      });
    });
  });
});
