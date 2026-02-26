import type { DragHandle } from '@imazen/crop-image-core';

export interface PointerState {
  pointerId: number | null;
  handle: DragHandle | null;
}

/**
 * Convert a pointer event's clientX/Y to fractional (0..1) coordinates
 * relative to the overlay SVG element.
 */
export function pointerToFractional(
  e: PointerEvent,
  svgRect: DOMRect,
): { x: number; y: number } {
  const x = (e.clientX - svgRect.left) / svgRect.width;
  const y = (e.clientY - svgRect.top) / svgRect.height;
  return { x, y };
}

/**
 * Determine which handle (if any) is under the pointer.
 */
export function hitTestHandle(target: EventTarget | null): DragHandle | null {
  if (!(target instanceof Element)) return null;

  // Check the target and its ancestors for a data-handle attribute
  const handleEl = target.closest('[data-handle]');
  if (!handleEl) return null;

  return handleEl.getAttribute('data-handle') as DragHandle;
}
