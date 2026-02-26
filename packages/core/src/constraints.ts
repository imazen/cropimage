import type { CropRect, PadRect, CropSelection, CropConfig, AspectRatio } from './types.js';
import { ZERO_PAD } from './types.js';

/** Round a number to f32 precision. */
export function f32(v: number): number {
  return Math.fround(v);
}

/** Clamp a value between min and max. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Get the numeric aspect ratio value (w/h). */
function ratioValue(ar: AspectRatio, srcW: number, srcH: number): number {
  // Ratio is in image-space proportions, adjusted for non-square pixels
  // For a 16:9 crop on a 1000x500 image, the crop rect w/h ratio should be:
  // (16/9) * (srcH/srcW) so the crop covers the right proportions
  return (ar.width / ar.height) * (srcH / srcW);
}

/** Apply aspect ratio constraint. Adjusts the lesser-changed dimension. */
function applyAspectRatio(
  crop: CropRect,
  ar: AspectRatio | null,
  srcW: number,
  srcH: number,
  handle: string | null,
): CropRect {
  if (!ar) return crop;

  const targetRatio = ratioValue(ar, srcW, srcH);
  const w = crop.x2 - crop.x1;
  const h = crop.y2 - crop.y1;
  const currentRatio = w / h;

  if (Math.abs(currentRatio - targetRatio) < 1e-6) return crop;

  const cx = (crop.x1 + crop.x2) / 2;
  const cy = (crop.y1 + crop.y2) / 2;

  let newW: number;
  let newH: number;

  // Determine which dimension to adjust based on handle direction
  if (handle === 'n' || handle === 's') {
    // Vertical drag → height is primary, adjust width
    newH = h;
    newW = h * targetRatio;
  } else if (handle === 'e' || handle === 'w') {
    // Horizontal drag → width is primary, adjust height
    newW = w;
    newH = w / targetRatio;
  } else {
    // Corner or move or new: fit within current bounds
    if (currentRatio > targetRatio) {
      // Too wide → shrink width
      newH = h;
      newW = h * targetRatio;
    } else {
      // Too tall → shrink height
      newW = w;
      newH = w / targetRatio;
    }
  }

  // Anchor based on handle
  let x1: number, y1: number, x2: number, y2: number;

  if (handle === 'nw') {
    x2 = crop.x2; y2 = crop.y2;
    x1 = x2 - newW; y1 = y2 - newH;
  } else if (handle === 'ne') {
    x1 = crop.x1; y2 = crop.y2;
    x2 = x1 + newW; y1 = y2 - newH;
  } else if (handle === 'sw') {
    x2 = crop.x2; y1 = crop.y1;
    x1 = x2 - newW; y2 = y1 + newH;
  } else if (handle === 'se' || handle === 'new') {
    x1 = crop.x1; y1 = crop.y1;
    x2 = x1 + newW; y2 = y1 + newH;
  } else if (handle === 'n') {
    x1 = cx - newW / 2; x2 = cx + newW / 2;
    y1 = crop.y2 - newH; y2 = crop.y2;
  } else if (handle === 's') {
    x1 = cx - newW / 2; x2 = cx + newW / 2;
    y1 = crop.y1; y2 = crop.y1 + newH;
  } else if (handle === 'e') {
    x1 = crop.x1; x2 = crop.x1 + newW;
    y1 = cy - newH / 2; y2 = cy + newH / 2;
  } else if (handle === 'w') {
    x1 = crop.x2 - newW; x2 = crop.x2;
    y1 = cy - newH / 2; y2 = cy + newH / 2;
  } else {
    // move or default: center
    x1 = cx - newW / 2; x2 = cx + newW / 2;
    y1 = cy - newH / 2; y2 = cy + newH / 2;
  }

  return { x1, y1, x2, y2 };
}

/** Clamp crop rect to 0..1 bounds (crop mode). Shrinks if necessary. */
function clampBounds(crop: CropRect): CropRect {
  let { x1, y1, x2, y2 } = crop;
  const w = x2 - x1;
  const h = y2 - y1;

  // Clamp width/height to max 1
  const cw = Math.min(w, 1);
  const ch = Math.min(h, 1);

  // Shift into bounds
  if (x1 < 0) { x1 = 0; x2 = cw; }
  if (y1 < 0) { y1 = 0; y2 = ch; }
  if (x2 > 1) { x2 = 1; x1 = 1 - cw; }
  if (y2 > 1) { y2 = 1; y1 = 1 - ch; }

  return { x1: clamp(x1, 0, 1), y1: clamp(y1, 0, 1), x2: clamp(x2, 0, 1), y2: clamp(y2, 0, 1) };
}

/** Convert overflow beyond 0..1 into padding (crop-pad mode). */
function computePadding(crop: CropRect, evenPadding: boolean): CropSelection {
  let pad: PadRect = {
    top: Math.max(0, -crop.y1),
    right: Math.max(0, crop.x2 - 1),
    bottom: Math.max(0, crop.y2 - 1),
    left: Math.max(0, -crop.x1),
  };

  const clampedCrop: CropRect = {
    x1: clamp(crop.x1, 0, 1),
    y1: clamp(crop.y1, 0, 1),
    x2: clamp(crop.x2, 0, 1),
    y2: clamp(crop.y2, 0, 1),
  };

  if (evenPadding) {
    const maxH = Math.max(pad.top, pad.bottom);
    const maxV = Math.max(pad.left, pad.right);
    pad = { top: maxH, bottom: maxH, left: maxV, right: maxV };
  }

  return { crop: clampedCrop, pad };
}

/** Enforce minimum/maximum crop size. Sizes are fractions of source dimensions. */
function applyMinMax(
  crop: CropRect,
  config: CropConfig,
): CropRect {
  let { x1, y1, x2, y2 } = crop;
  let w = x2 - x1;
  let h = y2 - y1;

  if (config.minSize && config.sourceWidth > 0 && config.sourceHeight > 0) {
    const minW = config.minSize.width / config.sourceWidth;
    const minH = config.minSize.height / config.sourceHeight;
    if (w < minW) { const cx = (x1 + x2) / 2; x1 = cx - minW / 2; x2 = cx + minW / 2; w = minW; }
    if (h < minH) { const cy = (y1 + y2) / 2; y1 = cy - minH / 2; y2 = cy + minH / 2; h = minH; }
  }

  if (config.maxSize && config.sourceWidth > 0 && config.sourceHeight > 0) {
    const maxW = config.maxSize.width / config.sourceWidth;
    const maxH = config.maxSize.height / config.sourceHeight;
    if (w > maxW) { const cx = (x1 + x2) / 2; x1 = cx - maxW / 2; x2 = cx + maxW / 2; }
    if (h > maxH) { const cy = (y1 + y2) / 2; y1 = cy - maxH / 2; y2 = cy + maxH / 2; }
  }

  return { x1, y1, x2, y2 };
}

/** Snap edges that are within threshold of 0 or 1. */
function applyEdgeSnap(crop: CropRect, threshold: number): CropRect {
  const { x1, y1, x2, y2 } = crop;
  return {
    x1: x1 < threshold ? 0 : x1,
    y1: y1 < threshold ? 0 : y1,
    x2: x2 > 1 - threshold ? 1 : x2,
    y2: y2 > 1 - threshold ? 1 : y2,
  };
}

/** Round all values in a CropSelection to f32 precision. */
function roundSelection(sel: CropSelection): CropSelection {
  return {
    crop: {
      x1: f32(sel.crop.x1),
      y1: f32(sel.crop.y1),
      x2: f32(sel.crop.x2),
      y2: f32(sel.crop.y2),
    },
    pad: {
      top: f32(sel.pad.top),
      right: f32(sel.pad.right),
      bottom: f32(sel.pad.bottom),
      left: f32(sel.pad.left),
    },
  };
}

/**
 * Full constraint pipeline.
 * Takes a raw crop rect and config, returns a fully constrained CropSelection.
 */
export function constrain(
  rawCrop: CropRect,
  config: CropConfig,
  handle: string | null = null,
): CropSelection {
  // 1. Aspect ratio lock
  let crop = applyAspectRatio(rawCrop, config.aspectRatio, config.sourceWidth, config.sourceHeight, handle);

  // 2 & 3. Bounds / padding
  let pad: PadRect;
  if (config.mode === 'crop-pad') {
    const result = computePadding(crop, config.evenPadding);
    crop = result.crop;
    pad = result.pad;
  } else {
    crop = clampBounds(crop);
    pad = { ...ZERO_PAD };
  }

  // 4. Min/max size
  crop = applyMinMax(crop, config);

  // 5. Edge snapping (only in crop mode where it makes sense)
  if (config.mode === 'crop' && config.edgeSnapThreshold > 0) {
    crop = applyEdgeSnap(crop, config.edgeSnapThreshold);
  }

  // 6. f32 rounding
  return roundSelection({ crop, pad });
}

/**
 * Apply a move delta to a crop selection.
 * Returns a new CropRect shifted by (dx, dy) in fractional coordinates.
 */
export function moveCrop(crop: CropRect, dx: number, dy: number): CropRect {
  return {
    x1: crop.x1 + dx,
    y1: crop.y1 + dy,
    x2: crop.x2 + dx,
    y2: crop.y2 + dy,
  };
}

/**
 * Apply a resize delta to a specific handle.
 * Returns a new CropRect with the handle's edges moved by (dx, dy).
 */
export function resizeCrop(
  crop: CropRect,
  handle: string,
  dx: number,
  dy: number,
): CropRect {
  const { x1, y1, x2, y2 } = crop;

  switch (handle) {
    case 'n':  return { x1, y1: y1 + dy, x2, y2 };
    case 's':  return { x1, y1, x2, y2: y2 + dy };
    case 'e':  return { x1, y1, x2: x2 + dx, y2 };
    case 'w':  return { x1: x1 + dx, y1, x2, y2 };
    case 'nw': return { x1: x1 + dx, y1: y1 + dy, x2, y2 };
    case 'ne': return { x1, y1: y1 + dy, x2: x2 + dx, y2 };
    case 'sw': return { x1: x1 + dx, y1, x2, y2: y2 + dy };
    case 'se': return { x1, y1, x2: x2 + dx, y2: y2 + dy };
    default:   return crop;
  }
}

/**
 * Normalize a crop rect (ensure x1 < x2, y1 < y2).
 */
export function normalizeCrop(crop: CropRect): CropRect {
  return {
    x1: Math.min(crop.x1, crop.x2),
    y1: Math.min(crop.y1, crop.y2),
    x2: Math.max(crop.x1, crop.x2),
    y2: Math.max(crop.y1, crop.y2),
  };
}
