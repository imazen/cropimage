import { describe, it, expect } from 'vitest';
import {
  constrain,
  moveCrop,
  resizeCrop,
  normalizeCrop,
  f32,
  defaultConfig,
  defaultSelection,
  ZERO_PAD,
} from '../src/index.js';
import type { CropRect, CropConfig, CropSelection } from '../src/index.js';

function approx(a: number, b: number, eps = 1e-5): void {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

describe('f32', () => {
  it('rounds to float32 precision', () => {
    const v = f32(0.1 + 0.2);
    expect(v).toBe(Math.fround(0.1 + 0.2));
  });
});

describe('normalizeCrop', () => {
  it('swaps inverted coordinates', () => {
    const r = normalizeCrop({ x1: 0.8, y1: 0.9, x2: 0.2, y2: 0.1 });
    expect(r.x1).toBe(0.2);
    expect(r.y1).toBe(0.1);
    expect(r.x2).toBe(0.8);
    expect(r.y2).toBe(0.9);
  });

  it('leaves normal rects unchanged', () => {
    const r = normalizeCrop({ x1: 0.1, y1: 0.2, x2: 0.8, y2: 0.9 });
    expect(r.x1).toBe(0.1);
    expect(r.y1).toBe(0.2);
  });
});

describe('moveCrop', () => {
  it('shifts crop by delta', () => {
    const r = moveCrop({ x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5 }, 0.1, 0.2);
    approx(r.x1, 0.2);
    approx(r.y1, 0.3);
    approx(r.x2, 0.6);
    approx(r.y2, 0.7);
  });
});

describe('resizeCrop', () => {
  const crop: CropRect = { x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8 };

  it('moves north edge', () => {
    const r = resizeCrop(crop, 'n', 0, -0.1);
    expect(r.y1).toBeCloseTo(0.1);
    expect(r.y2).toBe(0.8);
  });

  it('moves se corner', () => {
    const r = resizeCrop(crop, 'se', 0.1, 0.1);
    expect(r.x2).toBeCloseTo(0.9);
    expect(r.y2).toBeCloseTo(0.9);
    expect(r.x1).toBe(0.2);
    expect(r.y1).toBe(0.2);
  });
});

describe('constrain - crop mode', () => {
  const config: CropConfig = {
    ...defaultConfig(),
    sourceWidth: 1000,
    sourceHeight: 1000,
  };

  it('clamps to bounds', () => {
    const sel = constrain({ x1: -0.1, y1: -0.1, x2: 0.5, y2: 0.5 }, config);
    expect(sel.crop.x1).toBeGreaterThanOrEqual(0);
    expect(sel.crop.y1).toBeGreaterThanOrEqual(0);
  });

  it('snaps edges near boundary', () => {
    const cfg = { ...config, edgeSnapThreshold: 0.02 };
    const sel = constrain({ x1: 0.01, y1: 0.01, x2: 0.99, y2: 0.99 }, cfg);
    expect(sel.crop.x1).toBe(0);
    expect(sel.crop.y1).toBe(0);
    expect(sel.crop.x2).toBe(1);
    expect(sel.crop.y2).toBe(1);
  });

  it('does not snap edges beyond threshold', () => {
    const cfg = { ...config, edgeSnapThreshold: 0.02 };
    const sel = constrain({ x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 }, cfg);
    approx(sel.crop.x1, 0.05);
    approx(sel.crop.y1, 0.05);
  });

  it('enforces aspect ratio', () => {
    const cfg: CropConfig = {
      ...config,
      aspectRatio: { width: 1, height: 1 },
    };
    // Non-square rect on a square image → should become square
    const sel = constrain({ x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.5 }, cfg);
    const w = sel.crop.x2 - sel.crop.x1;
    const h = sel.crop.y2 - sel.crop.y1;
    approx(w, h, 0.001);
  });

  it('enforces min size', () => {
    const cfg: CropConfig = {
      ...config,
      minSize: { width: 400, height: 400 },
    };
    const sel = constrain({ x1: 0.4, y1: 0.4, x2: 0.5, y2: 0.5 }, cfg);
    const w = sel.crop.x2 - sel.crop.x1;
    const h = sel.crop.y2 - sel.crop.y1;
    expect(w).toBeGreaterThanOrEqual(0.4 - 0.001);
    expect(h).toBeGreaterThanOrEqual(0.4 - 0.001);
  });

  it('produces zero padding', () => {
    const sel = constrain({ x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8 }, config);
    expect(sel.pad).toEqual(ZERO_PAD);
  });

  it('all outputs are f32', () => {
    const sel = constrain({ x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 }, config);
    expect(sel.crop.x1).toBe(Math.fround(sel.crop.x1));
    expect(sel.crop.y1).toBe(Math.fround(sel.crop.y1));
    expect(sel.crop.x2).toBe(Math.fround(sel.crop.x2));
    expect(sel.crop.y2).toBe(Math.fround(sel.crop.y2));
  });
});

describe('constrain - crop-pad mode', () => {
  const config: CropConfig = {
    ...defaultConfig(),
    mode: 'crop-pad',
    sourceWidth: 1000,
    sourceHeight: 1000,
  };

  it('converts overflow to padding', () => {
    const sel = constrain({ x1: -0.1, y1: 0.0, x2: 1.0, y2: 1.0 }, config);
    expect(sel.pad.left).toBeGreaterThan(0);
    expect(sel.crop.x1).toBe(0);
  });

  it('produces even padding when configured', () => {
    const cfg = { ...config, evenPadding: true };
    const sel = constrain({ x1: -0.1, y1: 0.0, x2: 1.0, y2: 1.0 }, cfg);
    expect(sel.pad.left).toBe(sel.pad.right);
    expect(sel.pad.top).toBe(sel.pad.bottom);
  });
});

describe('constrain - aspect ratio on non-square image', () => {
  it('16:9 on 1920x1080 image', () => {
    const cfg: CropConfig = {
      ...defaultConfig(),
      aspectRatio: { width: 16, height: 9 },
      sourceWidth: 1920,
      sourceHeight: 1080,
    };
    const sel = constrain({ x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 }, cfg);
    const w = sel.crop.x2 - sel.crop.x1;
    const h = sel.crop.y2 - sel.crop.y1;
    // On a 16:9 image with 16:9 aspect ratio, w should equal h
    // because (16/9) * (1080/1920) = 1.0
    approx(w, h, 0.01);
  });

  it('1:1 on 1920x1080 image', () => {
    const cfg: CropConfig = {
      ...defaultConfig(),
      aspectRatio: { width: 1, height: 1 },
      sourceWidth: 1920,
      sourceHeight: 1080,
    };
    const sel = constrain({ x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 }, cfg);
    const w = sel.crop.x2 - sel.crop.x1;
    const h = sel.crop.y2 - sel.crop.y1;
    // 1:1 square output means crop w*srcW = h*srcH → w/h = srcH/srcW ≈ 0.5625
    const expectedRatio = 1080 / 1920;
    approx(w / h, expectedRatio, 0.01);
  });
});
