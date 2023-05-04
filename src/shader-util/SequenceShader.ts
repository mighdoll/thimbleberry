import { HasReactive } from "@reactively/decorate";
import { ShaderComponent } from "./ShaderComponent.js";

/** A sequence of shaders exposed as a single ShaderComponent */
export abstract class SequenceShader extends HasReactive implements ShaderComponent {
  encodeCommands(encoder: GPUCommandEncoder): void {
    this.shaders.forEach(s => s.encodeCommands(encoder));
  }

  destroy(): void {
    this.shaders.forEach(s => s.destroy?.());
  }

  abstract get shaders(): ShaderComponent[];
}
