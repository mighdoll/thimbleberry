import { HasReactive } from "@reactively/decorate";
import { ComposableShader } from "./ComposableShader.js";

/** A sequence of shaders exposed as a single ShaderComponent */
export abstract class SequenceShader extends HasReactive implements ComposableShader {
  commands(encoder: GPUCommandEncoder): void {
    this.shaders.forEach(s => s.commands(encoder));
  }

  destroy(): void {
    this.shaders.forEach(s => s.destroy?.());
  }

  abstract get shaders(): ComposableShader[];
}
