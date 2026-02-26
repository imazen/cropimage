/** Crop rectangle with coordinates as fractions of source image (0..1 range). */
export interface CropRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Padding amounts as fractions of source image dimensions (0..1 range). */
export interface PadRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Combined crop + pad selection. */
export interface CropSelection {
  crop: CropRect;
  pad: PadRect;
}

/** Aspect ratio definition. */
export interface AspectRatio {
  width: number;
  height: number;
  label?: string;
}

/** Configuration for the crop constraint engine. */
export interface CropConfig {
  mode: 'crop' | 'crop-pad';
  aspectRatio: AspectRatio | null;
  aspectRatios: AspectRatio[] | null;
  minSize: { width: number; height: number } | null;
  maxSize: { width: number; height: number } | null;
  edgeSnapThreshold: number;
  evenPadding: boolean;
  sourceWidth: number;
  sourceHeight: number;
}

/** Which edge or corner is being dragged. */
export type DragHandle =
  | 'n' | 's' | 'e' | 'w'
  | 'ne' | 'nw' | 'se' | 'sw'
  | 'move'
  | 'new';

/** Interaction state for the crop UI. */
export interface CropState {
  selection: CropSelection;
  activeHandle: DragHandle | null;
  dragStartSelection: CropSelection | null;
  dragStartPoint: { x: number; y: number } | null;
}

export const ZERO_PAD: PadRect = { top: 0, right: 0, bottom: 0, left: 0 };

export const DEFAULT_CROP: CropRect = { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 };

export function defaultConfig(): CropConfig {
  return {
    mode: 'crop',
    aspectRatio: null,
    aspectRatios: null,
    minSize: null,
    maxSize: null,
    edgeSnapThreshold: 0.02,
    evenPadding: false,
    sourceWidth: 0,
    sourceHeight: 0,
  };
}

export function defaultSelection(): CropSelection {
  return { crop: { ...DEFAULT_CROP }, pad: { ...ZERO_PAD } };
}

export function defaultState(): CropState {
  return {
    selection: defaultSelection(),
    activeHandle: null,
    dragStartSelection: null,
    dragStartPoint: null,
  };
}
