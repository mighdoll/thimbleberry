/** An interface for modular shaders */
export interface ComposableShader {
  /** add gpu passes and gpu commands to the shared gpu execution queue for the current frame */
  commands(encoder: GPUCommandEncoder): void;

  /** std interface to pass flags to control logging  */
  debugLogging?: (debugFlags: Record<string, unknown>) => void;

  /** cleanup unused gpu resources */
  destroy?: () => void;
}
