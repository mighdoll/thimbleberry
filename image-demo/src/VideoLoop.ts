import { appState } from "./AppState";

/** Listen for events on a video element and call a function on each video frame */
export function registerVideoLoop(
  video: HTMLVideoElement,
  frameCallback: () => void
): void {
  let looping = false; // true while video is playing

  video.setAttribute("registered", "1");
  video.addEventListener("playing", () => {
    looping = true;
    appState.playState = "playing";
    frameLoop();
  });

  video.addEventListener("pause", () => {
    looping = false;
    appState.playState = "pause";
  });

  video.addEventListener("seeked", () => {
    const playState = appState.playState;
    if (playState === "pause" || playState === "stop") {
      appState.dirty = true;
    }
  });

  function frameLoop(): void {
    if (looping) {
      // is this needed anymore?
      if (video.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
        frameCallback();
      }
      requestAnimationFrame(frameLoop);
    }
  }
}
