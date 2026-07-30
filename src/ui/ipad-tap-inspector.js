// Temporary diagnostic retired after confirming that iPad Safari targets the
// correct controls but does not synthesize pointerdown/click for them.
export function installIpadTapInspector() {
  return { destroy() {} };
}
