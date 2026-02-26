import type { CropRect, DragHandle } from '@imazen/crop-image-core';
import { resizeCrop, moveCrop } from '@imazen/crop-image-core';

const STEP = 0.01;       // 1% per keypress
const LARGE_STEP = 0.05; // 5% with Shift

/**
 * Handle keyboard input on a focused resize handle.
 * Returns a new CropRect or null if the key wasn't handled.
 */
export function handleKeyboard(
  e: KeyboardEvent,
  crop: CropRect,
  handle: DragHandle,
): CropRect | null {
  const step = e.shiftKey ? LARGE_STEP : STEP;

  let dx = 0;
  let dy = 0;

  switch (e.key) {
    case 'ArrowLeft':  dx = -step; break;
    case 'ArrowRight': dx = step;  break;
    case 'ArrowUp':    dy = -step; break;
    case 'ArrowDown':  dy = step;  break;
    default: return null;
  }

  if (handle === 'move') {
    return moveCrop(crop, dx, dy);
  }

  return resizeCrop(crop, handle, dx, dy);
}
