import { describe, it, expect } from 'vitest';
import {
  GenericRiapiAdapter,
  ImageflowAdapter,
  ImageResizerAdapter,
  buildQuerystring,
  parseQuerystring,
  ZERO_PAD,
  f32,
} from '../src/index.js';
import type { CropSelection } from '../src/index.js';

describe('buildQuerystring / parseQuerystring', () => {
  it('round-trips', () => {
    const params = { crop: '0.1,0.2,0.8,0.9', cropxunits: '1' };
    const qs = buildQuerystring(params);
    expect(qs).toContain('crop=');
    const parsed = parseQuerystring(qs);
    expect(parsed['crop']).toBe('0.1,0.2,0.8,0.9');
    expect(parsed['cropxunits']).toBe('1');
  });

  it('handles empty params', () => {
    expect(buildQuerystring({})).toBe('');
    expect(parseQuerystring('')).toEqual({});
  });
});

describe('GenericRiapiAdapter', () => {
  const adapter = new GenericRiapiAdapter();
  const sel: CropSelection = {
    crop: { x1: 0.1, y1: 0.2, x2: 0.8, y2: 0.9 },
    pad: { ...ZERO_PAD },
  };

  it('toParams produces correct querystring', () => {
    const result = adapter.toParams(sel, 1000, 800);
    expect(result.params['crop']).toBe('0.1,0.2,0.8,0.9');
    expect(result.params['cropxunits']).toBe('1');
    expect(result.params['cropyunits']).toBe('1');
    expect(result.querystring).toContain('crop=0.1%2C0.2%2C0.8%2C0.9');
  });

  it('fromParams round-trips', () => {
    const result = adapter.toParams(sel, 1000, 800);
    const back = adapter.fromParams(result.params, 1000, 800);
    expect(back).not.toBeNull();
    expect(back!.crop.x1).toBeCloseTo(0.1);
    expect(back!.crop.y2).toBeCloseTo(0.9);
  });

  it('fromParams with legacy pixel-based crop', () => {
    const back = adapter.fromParams(
      { crop: '100,200,800,900', cropxunits: '1000', cropyunits: '1000' },
      1000, 1000,
    );
    expect(back).not.toBeNull();
    expect(back!.crop.x1).toBeCloseTo(0.1);
    expect(back!.crop.y1).toBeCloseTo(0.2);
    expect(back!.crop.x2).toBeCloseTo(0.8);
    expect(back!.crop.y2).toBeCloseTo(0.9);
  });

  it('fromParams returns null for missing crop', () => {
    expect(adapter.fromParams({}, 1000, 800)).toBeNull();
  });
});

describe('ImageflowAdapter', () => {
  const adapter = new ImageflowAdapter();

  it('includes s.pad when padding exists', () => {
    const sel: CropSelection = {
      crop: { x1: 0, y1: 0, x2: 1, y2: 1 },
      pad: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
    };
    const result = adapter.toParams(sel, 1000, 800);
    expect(result.params['s.pad']).toBe('80,100,80,100');
  });

  it('round-trips with padding', () => {
    const sel: CropSelection = {
      crop: { x1: 0, y1: 0, x2: 1, y2: 1 },
      pad: { top: 0.1, right: 0.2, bottom: 0.1, left: 0.2 },
    };
    const result = adapter.toParams(sel, 1000, 1000);
    const back = adapter.fromParams(result.params, 1000, 1000);
    expect(back).not.toBeNull();
    expect(back!.pad.top).toBeCloseTo(0.1, 1);
    expect(back!.pad.right).toBeCloseTo(0.2, 1);
  });
});

describe('ImageResizerAdapter', () => {
  const adapter = new ImageResizerAdapter();

  it('uses margin param for padding', () => {
    const sel: CropSelection = {
      crop: { x1: 0, y1: 0, x2: 1, y2: 1 },
      pad: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 },
    };
    const result = adapter.toParams(sel, 1000, 1000);
    expect(result.params['margin']).toBe('50,50,50,50');
  });

  it('omits margin when no padding', () => {
    const sel: CropSelection = {
      crop: { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 },
      pad: { ...ZERO_PAD },
    };
    const result = adapter.toParams(sel, 1000, 1000);
    expect(result.params['margin']).toBeUndefined();
  });
});
