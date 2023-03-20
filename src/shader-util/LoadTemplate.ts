/** wgsl template for loading a value from a wgsl vec4 */
export interface LoadTemplate {
  loadOp: string;
}

export type LoadableComponent = "r" | "g" | "b" | "a";

export const loadRedComponent: LoadTemplate = {
  loadOp: "return a.r;"
};

export const loadGreenComponent: LoadTemplate = {
  loadOp: "return a.g;"
};

export const loadBlueComponent: LoadTemplate = {
  loadOp: "return a.b;"
};

export const loadAlphaComponent: LoadTemplate = {
  loadOp: "return a.a;"
};

export function loaderForComponent(component: LoadableComponent): LoadTemplate {
  switch (component) {
    case "r":
      return loadRedComponent;
    case "g":
      return loadGreenComponent;
    case "b":
      return loadBlueComponent;
    case "a":
      return loadAlphaComponent;
  }
}
