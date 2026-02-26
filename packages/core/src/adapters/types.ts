import type { CropSelection } from '../types.js';

export interface RiapiResult {
  params: Record<string, string>;
  querystring: string;
}

export interface RiapiAdapter {
  /** Convert a crop selection to RIAPI query parameters. */
  toParams(sel: CropSelection, srcW: number, srcH: number): RiapiResult;
  /** Parse RIAPI query parameters back to a crop selection. Returns null if params are missing/invalid. */
  fromParams(params: Record<string, string>, srcW: number, srcH: number): CropSelection | null;
}

/** Build a querystring from key-value pairs. */
export function buildQuerystring(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/** Parse a querystring into key-value pairs. */
export function parseQuerystring(qs: string): Record<string, string> {
  const params: Record<string, string> = {};
  const str = qs.startsWith('?') ? qs.slice(1) : qs;
  if (!str) return params;
  for (const part of str.split('&')) {
    const [k, v] = part.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return params;
}
