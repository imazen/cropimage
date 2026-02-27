export { CropImageElement } from './crop-image.js';
export { CropImagePreviewElement } from './preview.js';

// Viewport math (useful for programmatic control)
export type { ViewportState, FrameRect, ImageTransform } from './viewport-math.js';

// Re-export core types for convenience
export type {
  CropRect,
  PadRect,
  CropSelection,
  AspectRatio,
  CropConfig,
  RiapiAdapter,
  RiapiResult,
} from '@imazen/crop-image-core';

export {
  GenericRiapiAdapter,
  ImageflowAdapter,
  ImageResizerAdapter,
  constrain,
  buildQuerystring,
  parseQuerystring,
} from '@imazen/crop-image-core';
