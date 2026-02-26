import { describe, it, expect } from 'vitest';
import {
  cropReducer,
  defaultState,
  defaultConfig,
  defaultSelection,
  ZERO_PAD,
} from '../src/index.js';
import type { CropAction, CropConfig, CropState } from '../src/index.js';

const config: CropConfig = {
  ...defaultConfig(),
  sourceWidth: 1000,
  sourceHeight: 1000,
};

describe('cropReducer', () => {
  it('SET_SELECTION updates selection', () => {
    const state = defaultState();
    const sel = { crop: { x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8 }, pad: { ...ZERO_PAD } };
    const next = cropReducer(state, { type: 'SET_SELECTION', selection: sel }, config);
    expect(next.selection.crop.x1).toBe(0.2);
  });

  it('DRAG_START sets handle and start state', () => {
    const state = defaultState();
    const sel = defaultSelection();
    const next = cropReducer(
      state,
      { type: 'DRAG_START', handle: 'se', point: { x: 0.9, y: 0.9 }, selection: sel },
      config,
    );
    expect(next.activeHandle).toBe('se');
    expect(next.dragStartPoint).toEqual({ x: 0.9, y: 0.9 });
  });

  it('DRAG_MOVE with move handle shifts selection', () => {
    let state = defaultState();
    const sel = { crop: { x1: 0.2, y1: 0.2, x2: 0.6, y2: 0.6 }, pad: { ...ZERO_PAD } };
    state = cropReducer(
      state,
      { type: 'DRAG_START', handle: 'move', point: { x: 0.4, y: 0.4 }, selection: sel },
      config,
    );
    state = cropReducer(
      state,
      { type: 'DRAG_MOVE', point: { x: 0.5, y: 0.5 } },
      config,
    );
    // Moved by (0.1, 0.1)
    expect(state.selection.crop.x1).toBeCloseTo(0.3, 1);
    expect(state.selection.crop.y1).toBeCloseTo(0.3, 1);
  });

  it('DRAG_END clears active handle', () => {
    let state = defaultState();
    state = { ...state, activeHandle: 'se', dragStartPoint: { x: 0, y: 0 }, dragStartSelection: defaultSelection() };
    state = cropReducer(state, { type: 'DRAG_END' }, config);
    expect(state.activeHandle).toBeNull();
    expect(state.dragStartPoint).toBeNull();
  });

  it('NEW_SELECTION_START creates a zero-area selection', () => {
    const state = defaultState();
    const next = cropReducer(
      state,
      { type: 'NEW_SELECTION_START', point: { x: 0.3, y: 0.3 } },
      config,
    );
    expect(next.activeHandle).toBe('new');
    expect(next.selection.crop.x1).toBe(0.3);
    expect(next.selection.crop.y1).toBe(0.3);
  });

  it('RESET returns default state', () => {
    const state: CropState = {
      selection: { crop: { x1: 0.5, y1: 0.5, x2: 0.9, y2: 0.9 }, pad: { ...ZERO_PAD } },
      activeHandle: 'se',
      dragStartPoint: { x: 0, y: 0 },
      dragStartSelection: null,
    };
    const next = cropReducer(state, { type: 'RESET' }, config);
    expect(next.activeHandle).toBeNull();
    expect(next.selection.crop.x1).toBeCloseTo(0.1);
  });
});
