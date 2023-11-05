import { CompletedSpan, withTimestampGroup } from "./GpuPerf";
import { ComposableShader } from "./ComposableShader";

let frameNumber = 0;

/** A collection of shader components that can be dispatched.  */
export class ShaderGroup {
  private shaders: ComposableShader[];
  private device: GPUDevice;

  constructor(device: GPUDevice, ...shaders: ComposableShader[]) {
    this.device = device;
    this.shaders = shaders;
  }

  dispatch(): CompletedSpan | undefined {
    const { device } = this;
    const label = `frame ${frameNumber++}`;
    const stampRange = withTimestampGroup(label, () => {
      const commands = device.createCommandEncoder({ label });
      this.shaders.forEach(s => s.commands(commands));
      device.queue.submit([commands.finish()]);
    });
    return stampRange.span;
  }

  destroyAll(): void {
    this.shaders.forEach(s => s.destroy?.());
  }
}
