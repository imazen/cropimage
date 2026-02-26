import type { CropSelection } from '../types.js';
import { ZERO_PAD } from '../types.js';
import type { RiapiAdapter, RiapiResult } from './types.js';
import { buildQuerystring } from './types.js';
import { f32 } from '../constraints.js';

/**
 * Imageflow Server RIAPI adapter.
 *
 * Crop: ?crop=x1,y1,x2,y2&cropxunits=1&cropyunits=1
 * Padding: &s.pad=top,right,bottom,left (in source pixels)
 */
export class ImageflowAdapter implements RiapiAdapter {
  toParams(sel: CropSelection, srcW: number, srcH: number): RiapiResult {
    const { x1, y1, x2, y2 } = sel.crop;
    const params: Record<string, string> = {
      crop: `${x1},${y1},${x2},${y2}`,
      cropxunits: '1',
      cropyunits: '1',
    };

    const { top, right, bottom, left } = sel.pad;
    const hasPadding = top > 0 || right > 0 || bottom > 0 || left > 0;
    if (hasPadding) {
      // Imageflow's s.pad is in source pixels
      const pTop = Math.round(top * srcH);
      const pRight = Math.round(right * srcW);
      const pBottom = Math.round(bottom * srcH);
      const pLeft = Math.round(left * srcW);
      params['s.pad'] = `${pTop},${pRight},${pBottom},${pLeft}`;
    }

    return { params, querystring: buildQuerystring(params) };
  }

  fromParams(params: Record<string, string>, srcW: number, srcH: number): CropSelection | null {
    const cropStr = params['crop'];
    if (!cropStr) return null;

    const parts = cropStr.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return null;

    const xunits = Number(params['cropxunits'] || '1');
    const yunits = Number(params['cropyunits'] || '1');

    const [x1, y1, x2, y2] = parts;

    let pad = { ...ZERO_PAD };
    const padStr = params['s.pad'];
    if (padStr && srcW > 0 && srcH > 0) {
      const padParts = padStr.split(',').map(Number);
      if (padParts.length === 4 && !padParts.some(isNaN)) {
        pad = {
          top: f32(padParts[0] / srcH),
          right: f32(padParts[1] / srcW),
          bottom: f32(padParts[2] / srcH),
          left: f32(padParts[3] / srcW),
        };
      }
    }

    return {
      crop: {
        x1: f32(x1 / xunits),
        y1: f32(y1 / yunits),
        x2: f32(x2 / xunits),
        y2: f32(y2 / yunits),
      },
      pad,
    };
  }
}
