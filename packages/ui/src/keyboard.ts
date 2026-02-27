/** Result of keyboard input processing. */
export interface KeyboardAction {
  type: 'pan' | 'zoom' | 'reset';
  /** Pan delta in image-fraction units (for 'pan' type). */
  dx?: number;
  /** Pan delta in image-fraction units (for 'pan' type). */
  dy?: number;
  /** Zoom factor (multiplicative, for 'zoom' type). */
  zoomDelta?: number;
}

const PAN_STEP = 0.01;       // 1% per keypress
const PAN_LARGE_STEP = 0.05; // 5% with Shift
const ZOOM_STEP = 1.1;       // 10% zoom per keypress

/**
 * Process keyboard input for viewport control.
 * Returns a KeyboardAction or null if the key wasn't handled.
 *
 * - Arrow keys: pan (1% or 5% with Shift)
 * - +/= : zoom in
 * - -/_ : zoom out
 * - 0/Home : reset to fit (zoom=1, pan=0)
 */
export function handleViewportKeyboard(e: KeyboardEvent): KeyboardAction | null {
  const step = e.shiftKey ? PAN_LARGE_STEP : PAN_STEP;

  switch (e.key) {
    case 'ArrowLeft':
      return { type: 'pan', dx: step, dy: 0 };
    case 'ArrowRight':
      return { type: 'pan', dx: -step, dy: 0 };
    case 'ArrowUp':
      return { type: 'pan', dx: 0, dy: step };
    case 'ArrowDown':
      return { type: 'pan', dx: 0, dy: -step };
    case '+':
    case '=':
      return { type: 'zoom', zoomDelta: ZOOM_STEP };
    case '-':
    case '_':
      return { type: 'zoom', zoomDelta: 1 / ZOOM_STEP };
    case '0':
    case 'Home':
      return { type: 'reset' };
    default:
      return null;
  }
}
