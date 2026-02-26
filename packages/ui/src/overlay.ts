import type { CropSelection, CropConfig } from '@imazen/crop-image-core';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface OverlayElements {
  svg: SVGSVGElement;
  dimMask: SVGRectElement;
  cropHole: SVGRectElement;
  cropBorder: SVGRectElement;
  guides: SVGGElement;
  padGroup: SVGGElement;
  handles: Map<string, SVGRectElement>;
  cropArea: SVGRectElement;
}

const HANDLE_NAMES = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as const;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const [k, v] of Object.entries(attrs)) {
    e.setAttribute(k, v);
  }
  return e;
}

export function createOverlay(): OverlayElements {
  const svg = el('svg', { viewBox: '0 0 1 1', preserveAspectRatio: 'none' });

  // Defs for the mask
  const defs = el('defs');
  const mask = el('mask', { id: 'crop-mask' });
  const maskBg = el('rect', { x: '0', y: '0', width: '1', height: '1', fill: 'white' });
  const cropHole = el('rect', { fill: 'black' });
  mask.append(maskBg, cropHole);
  defs.append(mask);
  svg.append(defs);

  // Dimming layer
  const dimMask = el('rect', {
    x: '0', y: '0', width: '1', height: '1',
    fill: 'var(--crop-overlay-color, rgba(0,0,0,0.5))',
    mask: 'url(#crop-mask)',
  });
  svg.append(dimMask);

  // Padding zone indicators
  const padGroup = el('g', { class: 'pad-zones' });
  svg.append(padGroup);

  // Crop area (invisible hit target for moving)
  const cropArea = el('rect', {
    class: 'crop-area',
    fill: 'transparent',
    'data-handle': 'move',
  });
  svg.append(cropArea);

  // Crop border
  const cropBorder = el('rect', {
    fill: 'none',
    stroke: 'var(--crop-border-color, rgba(255,255,255,0.7))',
    'stroke-width': '0.002',
    'vector-effect': 'non-scaling-stroke',
  });
  svg.append(cropBorder);

  // Rule-of-thirds guides
  const guides = el('g', { class: 'guides' });
  for (let i = 1; i <= 2; i++) {
    // Vertical lines
    guides.append(el('line', {
      class: 'guide-v',
      stroke: 'var(--crop-guide-color, rgba(255,255,255,0.3))',
      'stroke-width': '0.001',
      'vector-effect': 'non-scaling-stroke',
    }));
    // Horizontal lines
    guides.append(el('line', {
      class: 'guide-h',
      stroke: 'var(--crop-guide-color, rgba(255,255,255,0.3))',
      'stroke-width': '0.001',
      'vector-effect': 'non-scaling-stroke',
    }));
  }
  svg.append(guides);

  // Resize handles
  const handles = new Map<string, SVGRectElement>();
  for (const name of HANDLE_NAMES) {
    const handle = el('rect', {
      class: `handle handle-${name}`,
      'data-handle': name,
      width: '0.02',
      height: '0.02',
      rx: '0.002',
      tabindex: '0',
      role: 'slider',
      'aria-label': `${name} resize handle`,
    });
    handles.set(name, handle);
    svg.append(handle);
  }

  return { svg, dimMask, cropHole, cropBorder, guides, padGroup, handles, cropArea };
}

export function updateOverlay(
  elements: OverlayElements,
  sel: CropSelection,
  config: CropConfig,
  containerW: number,
  containerH: number,
): void {
  const { x1, y1, x2, y2 } = sel.crop;
  const w = x2 - x1;
  const h = y2 - y1;

  // Update crop hole (mask)
  setRect(elements.cropHole, x1, y1, w, h);

  // Update crop area (hit target)
  setRect(elements.cropArea, x1, y1, w, h);

  // Update border
  setRect(elements.cropBorder, x1, y1, w, h);

  // Update rule-of-thirds guides
  const guideLines = elements.guides.querySelectorAll('line');
  const lines = Array.from(guideLines);
  if (lines.length >= 4) {
    // Vertical lines at 1/3 and 2/3
    const vx1 = x1 + w / 3;
    const vx2 = x1 + (2 * w) / 3;
    setLine(lines[0], vx1, y1, vx1, y2);
    setLine(lines[2], vx2, y1, vx2, y2);
    // Horizontal lines at 1/3 and 2/3
    const hy1 = y1 + h / 3;
    const hy2 = y1 + (2 * h) / 3;
    setLine(lines[1], x1, hy1, x2, hy1);
    setLine(lines[3], x1, hy2, x2, hy2);
  }

  // Update handles
  // Handle size in SVG units (relative to viewport), scaled to look consistent
  const hSizeX = containerW > 0 ? 12 / containerW : 0.02;
  const hSizeY = containerH > 0 ? 12 / containerH : 0.02;
  const halfX = hSizeX / 2;
  const halfY = hSizeY / 2;

  const positions: Record<string, [number, number]> = {
    nw: [x1 - halfX, y1 - halfY],
    n:  [x1 + w / 2 - halfX, y1 - halfY],
    ne: [x2 - halfX, y1 - halfY],
    e:  [x2 - halfX, y1 + h / 2 - halfY],
    se: [x2 - halfX, y2 - halfY],
    s:  [x1 + w / 2 - halfX, y2 - halfY],
    sw: [x1 - halfX, y2 - halfY],
    w:  [x1 - halfX, y1 + h / 2 - halfY],
  };

  for (const [name, handle] of elements.handles) {
    const [hx, hy] = positions[name]!;
    handle.setAttribute('x', String(hx));
    handle.setAttribute('y', String(hy));
    handle.setAttribute('width', String(hSizeX));
    handle.setAttribute('height', String(hSizeY));
  }

  // Update padding indicators
  updatePadZones(elements.padGroup, sel);
}

function updatePadZones(group: SVGGElement, sel: CropSelection): void {
  // Clear existing
  while (group.firstChild) group.removeChild(group.firstChild);

  const { pad } = sel;
  const hasPad = pad.top > 0 || pad.right > 0 || pad.bottom > 0 || pad.left > 0;
  if (!hasPad) return;

  const { x1, y1, x2, y2 } = sel.crop;

  // Draw pad zones as semi-transparent rects outside the crop
  if (pad.top > 0) {
    group.append(el('rect', {
      x: String(x1), y: String(y1 - pad.top),
      width: String(x2 - x1), height: String(pad.top),
      fill: 'var(--crop-pad-color, rgba(80,140,220,0.25))',
    }));
  }
  if (pad.bottom > 0) {
    group.append(el('rect', {
      x: String(x1), y: String(y2),
      width: String(x2 - x1), height: String(pad.bottom),
      fill: 'var(--crop-pad-color, rgba(80,140,220,0.25))',
    }));
  }
  if (pad.left > 0) {
    group.append(el('rect', {
      x: String(x1 - pad.left), y: String(y1 - pad.top),
      width: String(pad.left), height: String(y2 - y1 + pad.top + pad.bottom),
      fill: 'var(--crop-pad-color, rgba(80,140,220,0.25))',
    }));
  }
  if (pad.right > 0) {
    group.append(el('rect', {
      x: String(x2), y: String(y1 - pad.top),
      width: String(pad.right), height: String(y2 - y1 + pad.top + pad.bottom),
      fill: 'var(--crop-pad-color, rgba(80,140,220,0.25))',
    }));
  }
}

function setRect(el: SVGRectElement, x: number, y: number, w: number, h: number): void {
  el.setAttribute('x', String(x));
  el.setAttribute('y', String(y));
  el.setAttribute('width', String(Math.max(0, w)));
  el.setAttribute('height', String(Math.max(0, h)));
}

function setLine(el: SVGLineElement, x1: number, y1: number, x2: number, y2: number): void {
  el.setAttribute('x1', String(x1));
  el.setAttribute('y1', String(y1));
  el.setAttribute('x2', String(x2));
  el.setAttribute('y2', String(y2));
}
