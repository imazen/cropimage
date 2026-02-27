import type { CropRect, CropSelection, CropConfig } from '@imazen/crop-image-core';
import { constrain, ZERO_PAD } from '@imazen/crop-image-core';

/** UI-only state for the viewport pan/zoom model. */
export interface ViewportState {
  /** Zoom level >= 1.0. At 1.0 the image just covers the frame. */
  zoom: number;
  /** Horizontal offset from center in image-fraction units. 0 = centered. */
  panX: number;
  /** Vertical offset from center in image-fraction units. 0 = centered. */
  panY: number;
}

/** Rectangle in container pixel coordinates. */
export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** CSS transform values for an image element. */
export interface ImageTransform {
  /** translate X in container pixels */
  x: number;
  /** translate Y in container pixels */
  y: number;
  /** CSS scale factor (from natural image dimensions) */
  scale: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Compute the visible crop region for a given viewport state.
 *
 * frameAR and imageAR are both width/height ratios in pixel space.
 * Returns a CropRect in image-fraction coordinates (0..1).
 */
export function viewportToCropRect(
  vp: ViewportState,
  frameAR: number,
  imageAR: number,
): CropRect {
  const z = vp.zoom;
  let visW: number;
  let visH: number;

  if (imageAR > frameAR) {
    // Image wider than frame: height is the constraining dimension at zoom=1
    visH = 1 / z;
    visW = (frameAR / imageAR) / z;
  } else {
    // Image taller or same: width is the constraining dimension at zoom=1
    visW = 1 / z;
    visH = (imageAR / frameAR) / z;
  }

  const cx = 0.5 + vp.panX;
  const cy = 0.5 + vp.panY;

  return {
    x1: cx - visW / 2,
    y1: cy - visH / 2,
    x2: cx + visW / 2,
    y2: cy + visH / 2,
  };
}

/**
 * Convert a CropRect back to a ViewportState.
 * If the crop rect's aspect ratio doesn't match the frame AR exactly,
 * uses the more constraining dimension (larger zoom = tighter crop).
 */
export function cropRectToViewport(
  crop: CropRect,
  frameAR: number,
  imageAR: number,
): ViewportState {
  const cropW = crop.x2 - crop.x1;
  const cropH = crop.y2 - crop.y1;
  const cx = (crop.x1 + crop.x2) / 2;
  const cy = (crop.y1 + crop.y2) / 2;

  let zoom: number;
  if (imageAR > frameAR) {
    const zFromW = (frameAR / imageAR) / cropW;
    const zFromH = 1 / cropH;
    zoom = Math.max(zFromW, zFromH);
  } else {
    const zFromW = 1 / cropW;
    const zFromH = (imageAR / frameAR) / cropH;
    zoom = Math.max(zFromW, zFromH);
  }

  return {
    zoom: Math.max(1, zoom),
    panX: cx - 0.5,
    panY: cy - 0.5,
  };
}

/**
 * Clamp a viewport state so the crop rect stays valid.
 *
 * In "crop" mode: crop rect must stay within 0..1 (image always covers frame).
 * In "crop-pad" mode: no pan clamping (overflow becomes padding).
 */
export function clampViewport(
  vp: ViewportState,
  frameAR: number,
  imageAR: number,
  mode: 'crop' | 'crop-pad',
  maxZoom: number,
): ViewportState {
  let { zoom, panX, panY } = vp;
  zoom = clamp(zoom, 1, maxZoom);

  if (mode === 'crop') {
    let visW: number;
    let visH: number;

    if (imageAR > frameAR) {
      visH = 1 / zoom;
      visW = (frameAR / imageAR) / zoom;
    } else {
      visW = 1 / zoom;
      visH = (imageAR / frameAR) / zoom;
    }

    // cx = 0.5 + panX, crop x1 = cx - visW/2 >= 0 => panX >= visW/2 - 0.5
    // crop x2 = cx + visW/2 <= 1 => panX <= 0.5 - visW/2
    const maxPanX = Math.max(0, 0.5 - visW / 2);
    const maxPanY = Math.max(0, 0.5 - visH / 2);
    panX = clamp(panX, -maxPanX, maxPanX);
    panY = clamp(panY, -maxPanY, maxPanY);
  }

  return { zoom, panX, panY };
}

/**
 * Compute the CSS transform for an image element given the viewport state
 * and frame position within the container.
 *
 * Returns { x, y, scale } for use with:
 *   transform-origin: 0 0;
 *   transform: translate(x px, y px) scale(scale);
 */
export function computeImageTransform(
  vp: ViewportState,
  frameRect: FrameRect,
  imgNatW: number,
  imgNatH: number,
): ImageTransform {
  const imageAR = imgNatW / imgNatH;
  const frameAR = frameRect.w / frameRect.h;

  // Cover scale: image exactly covers the frame at zoom=1
  const coverScale = imageAR > frameAR
    ? frameRect.h / imgNatH
    : frameRect.w / imgNatW;

  const scale = coverScale * vp.zoom;

  // Frame center in container pixels
  const fcx = frameRect.x + frameRect.w / 2;
  const fcy = frameRect.y + frameRect.h / 2;

  // Image center in fraction coords
  const cx = 0.5 + vp.panX;
  const cy = 0.5 + vp.panY;

  // Position so (cx, cy) in image maps to frame center
  const x = fcx - cx * imgNatW * scale;
  const y = fcy - cy * imgNatH * scale;

  return { x, y, scale };
}

/**
 * Compute the frame rectangle within the container.
 *
 * - Free mode (frameAR = null): frame fills the container.
 * - Aspect ratio set: frame is centered at ~80% of the constraining dimension.
 */
export function computeFrameRect(
  containerW: number,
  containerH: number,
  frameAR: number | null,
): FrameRect {
  if (frameAR === null || containerW <= 0 || containerH <= 0) {
    return { x: 0, y: 0, w: containerW, h: containerH };
  }

  const containerAR = containerW / containerH;
  let frameW: number;
  let frameH: number;

  if (containerAR > frameAR) {
    // Container wider than frame AR: height constrains
    frameH = containerH * 0.8;
    frameW = frameH * frameAR;
  } else {
    // Container taller or same: width constrains
    frameW = containerW * 0.8;
    frameH = frameW / frameAR;
  }

  return {
    x: (containerW - frameW) / 2,
    y: (containerH - frameH) / 2,
    w: frameW,
    h: frameH,
  };
}

/**
 * Compute the maximum zoom level.
 * Ensures the crop region is at least minCropPx pixels in each dimension.
 */
export function getMaxZoom(imgNatW: number, imgNatH: number, minCropPx: number = 50): number {
  if (imgNatW <= 0 || imgNatH <= 0) return 1;
  return Math.max(1, Math.min(imgNatW, imgNatH) / minCropPx);
}

/**
 * Convert the current viewport state into a fully constrained CropSelection.
 * This is the bridge between the viewport UI model and the core constraint engine.
 */
export function viewportToSelection(
  vp: ViewportState,
  frameAR: number,
  imageAR: number,
  config: CropConfig,
): CropSelection {
  const crop = viewportToCropRect(vp, frameAR, imageAR);
  return constrain(crop, config);
}

/**
 * Compute the effective frame AR, accounting for the shape attribute.
 * Circle mode forces 1:1. Otherwise uses the config aspect ratio or null for free mode.
 */
export function effectiveFrameAR(
  config: CropConfig,
  shape: 'rect' | 'circle',
  imgNatW: number,
  imgNatH: number,
): number | null {
  if (shape === 'circle') {
    // Circle = 1:1 in pixel space
    return 1;
  }
  if (config.aspectRatio) {
    // AR is specified as width:height in pixel space
    return config.aspectRatio.width / config.aspectRatio.height;
  }
  return null; // free mode
}

/**
 * Get the image-space frame AR for coordinate math.
 * When frameAR is null (free mode), uses container AR as the frame.
 */
export function resolveFrameAR(
  frameAR: number | null,
  containerW: number,
  containerH: number,
): number {
  if (frameAR !== null) return frameAR;
  if (containerH <= 0) return 1;
  return containerW / containerH;
}

/**
 * Zoom toward a specific point in container pixel coordinates.
 * Returns a new ViewportState that keeps the point stationary on screen.
 */
export function zoomToward(
  vp: ViewportState,
  newZoom: number,
  pointX: number,
  pointY: number,
  frameRect: FrameRect,
  imgNatW: number,
  imgNatH: number,
): ViewportState {
  // Find the image-fraction coordinate under the pointer at the current zoom
  const oldTransform = computeImageTransform(vp, frameRect, imgNatW, imgNatH);
  const imgFracX = (pointX - oldTransform.x) / (imgNatW * oldTransform.scale);
  const imgFracY = (pointY - oldTransform.y) / (imgNatH * oldTransform.scale);

  // After zoom change, we want the same image-fraction to be under the same screen point.
  // New transform: pointX = fcx - cx_new * imgNatW * newScale + imgFracX * imgNatW * newScale
  // Simplifying: cx_new such that imgFracX stays under pointX

  const imageAR = imgNatW / imgNatH;
  const frameAR = frameRect.w / frameRect.h;
  const coverScale = imageAR > frameAR
    ? frameRect.h / imgNatH
    : frameRect.w / imgNatW;
  const newScale = coverScale * newZoom;

  const fcx = frameRect.x + frameRect.w / 2;
  const fcy = frameRect.y + frameRect.h / 2;

  // We want: pointX = fcx - newCx * imgNatW * newScale + imgFracX * imgNatW * newScale
  // But actually the transform is: x = fcx - cx * imgNatW * scale
  // And pointX maps to imgFracX via: imgFracX = (pointX - x) / (imgNatW * scale)
  // For the new state: pointX = newX + imgFracX * imgNatW * newScale
  //                    newX = fcx - newCx * imgNatW * newScale
  // So: pointX = fcx - newCx * imgNatW * newScale + imgFracX * imgNatW * newScale
  //     newCx = (fcx + imgFracX * imgNatW * newScale - pointX) / (imgNatW * newScale)
  //     newCx = imgFracX + (fcx - pointX) / (imgNatW * newScale)

  const newCx = imgFracX + (fcx - pointX) / (imgNatW * newScale);
  const newCy = imgFracY + (fcy - pointY) / (imgNatH * newScale);

  return {
    zoom: newZoom,
    panX: newCx - 0.5,
    panY: newCy - 0.5,
  };
}
