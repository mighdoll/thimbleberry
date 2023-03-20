import { Vec2 } from "thimbleberry/shader-util";

export function insertCanvas(
  fbSize: Vec2,
  id = "destCanvas"
): Cypress.Chainable<JQuery<HTMLCanvasElement>> {
  cy.get("body").then((body) => {
    body[0].innerHTML = `<canvas id="${id}"
      width="${fbSize[0]}" height="${fbSize[1]}"
      style="background-color:green; image-rendering:pixelated; border:solid; width:400px; height:400px;">
      </canvas>`;
  });
  return cy.get(`canvas#${id}`);
}
