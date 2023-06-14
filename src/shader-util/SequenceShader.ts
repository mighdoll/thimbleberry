import { HasReactive } from "@reactively/decorate";
import { ShaderComponent } from "./ComposableShader.js";

/** A sequence of shaders exposed as a single ShaderComponent */
export abstract class SequenceShader extends HasReactive implements ShaderComponent {
  commands(encoder: GPUCommandEncoder): void {
    this.shaders.forEach(s => s.commands(encoder));
  }

  destroy(): void {
    this.shaders.forEach(s => s.destroy?.());
  }

  abstract get shaders(): ShaderComponent[];
}
