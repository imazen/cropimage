import type { CropSelection } from '../types.js';
import { ZERO_PAD } from '../types.js';
import type { RiapiAdapter, RiapiResult } from './types.js';
import { buildQuerystring } from './types.js';
import { f32 } from '../constraints.js';

/**
 * Generic RIAPI adapter.
 * Uses fractional units (cropxunits=1, cropyunits=1) so crop values map directly
 * to 0..1 fractions.
 *
 * Output: ?crop=x1,y1,x2,y2&cropxunits=1&cropyunits=1
 */
export class GenericRiapiAdapter implements RiapiAdapter {
  toParams(sel: CropSelection, _srcW: number, _srcH: number): RiapiResult {
    const { x1, y1, x2, y2 } = sel.crop;
    const params: Record<string, string> = {
      crop: `${x1},${y1},${x2},${y2}`,
      cropxunits: '1',
      cropyunits: '1',
    };
    return { params, querystring: buildQuerystring(params) };
  }

  fromParams(params: Record<string, string>, _srcW: number, _srcH: number): CropSelection | null {
    const cropStr = params['crop'];
    if (!cropStr) return null;

    const parts = cropStr.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return null;

    const xunits = Number(params['cropxunits'] || '1');
    const yunits = Number(params['cropyunits'] || '1');

    const [x1, y1, x2, y2] = parts;

    return {
      crop: {
        x1: f32(x1 / xunits),
        y1: f32(y1 / yunits),
        x2: f32(x2 / xunits),
        y2: f32(y2 / yunits),
      },
      pad: { ...ZERO_PAD },
    };
  }
}
