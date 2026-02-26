import type { CropState, CropSelection, CropConfig, DragHandle, CropRect } from './types.js';
import { defaultState, ZERO_PAD } from './types.js';
import { constrain, moveCrop, resizeCrop, normalizeCrop } from './constraints.js';

export type CropAction =
  | { type: 'SET_SELECTION'; selection: CropSelection }
  | { type: 'DRAG_START'; handle: DragHandle; point: { x: number; y: number }; selection: CropSelection }
  | { type: 'DRAG_MOVE'; point: { x: number; y: number } }
  | { type: 'DRAG_END' }
  | { type: 'NEW_SELECTION_START'; point: { x: number; y: number } }
  | { type: 'RESET' };

/**
 * Immutable state reducer for crop interactions.
 * All geometric values are in 0..1 fractional coordinates.
 */
export function cropReducer(
  state: CropState,
  action: CropAction,
  config: CropConfig,
): CropState {
  switch (action.type) {
    case 'SET_SELECTION':
      return { ...state, selection: action.selection };

    case 'DRAG_START':
      return {
        ...state,
        activeHandle: action.handle,
        dragStartSelection: { ...action.selection, crop: { ...action.selection.crop }, pad: { ...action.selection.pad } },
        dragStartPoint: action.point,
      };

    case 'DRAG_MOVE': {
      if (!state.activeHandle || !state.dragStartSelection || !state.dragStartPoint) {
        return state;
      }

      const dx = action.point.x - state.dragStartPoint.x;
      const dy = action.point.y - state.dragStartPoint.y;
      const startCrop = state.dragStartSelection.crop;

      let newCrop: CropRect;

      if (state.activeHandle === 'move') {
        newCrop = moveCrop(startCrop, dx, dy);
      } else if (state.activeHandle === 'new') {
        // Creating a new selection from dragStartPoint
        newCrop = normalizeCrop({
          x1: state.dragStartPoint.x,
          y1: state.dragStartPoint.y,
          x2: action.point.x,
          y2: action.point.y,
        });
      } else {
        newCrop = resizeCrop(startCrop, state.activeHandle, dx, dy);
        newCrop = normalizeCrop(newCrop);
      }

      const constrained = constrain(newCrop, config, state.activeHandle);

      return {
        ...state,
        selection: constrained,
      };
    }

    case 'DRAG_END':
      return {
        ...state,
        activeHandle: null,
        dragStartSelection: null,
        dragStartPoint: null,
      };

    case 'NEW_SELECTION_START': {
      const newSelection: CropSelection = {
        crop: { x1: action.point.x, y1: action.point.y, x2: action.point.x, y2: action.point.y },
        pad: { ...ZERO_PAD },
      };
      return {
        selection: newSelection,
        activeHandle: 'new',
        dragStartSelection: newSelection,
        dragStartPoint: action.point,
      };
    }

    case 'RESET':
      return defaultState();

    default:
      return state;
  }
}
