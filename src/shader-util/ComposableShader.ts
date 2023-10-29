/** An interface for modular shaders */
export interface ComposableShader {
  /** Add compute or render passes for this shader to the provided GPUCommandEncoder */
  commands(encoder: GPUCommandEncoder): void;

  /** std interface to pass flags to control logging  */
  debugLogging?: (debugFlags: Record<string, unknown>) => void;

  /** cleanup gpu resources */
  destroy?: () => void;

  /** optional name for logging and benchmarking */
  name?: string;
}
