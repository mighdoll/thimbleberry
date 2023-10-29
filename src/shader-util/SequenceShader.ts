import { HasReactive } from "@reactively/decorate";
import { ComposableShader } from "./ComposableShader.js";

/** Support for a sequence of shaders exposed as a single ShaderComponent */
export abstract class HasShaderSequence extends HasReactive implements ComposableShader {
  commands(encoder: GPUCommandEncoder): void {
    this.shaders.forEach(s => s.commands(encoder));
  }

  destroy(): void {
    this.shaders.forEach(s => s.destroy?.());
  }

  abstract get shaders(): ComposableShader[];
}

/** A sequence of shaders exposed as a single ShaderComponent */
export class SequenceShader extends HasShaderSequence {
  shaders: ComposableShader[];

  name: string;

  constructor(shaders: ComposableShader[], name?: string) {
    super();
    this.shaders = shaders;
    this.name = name || "SequenceShader";
  }
}
