import {
  type CropSelection,
  type CropConfig,
  type AspectRatio,
  constrain,
  defaultConfig,
  defaultSelection,
  ZERO_PAD,
  GenericRiapiAdapter,
  ImageflowAdapter,
  ImageResizerAdapter,
  type RiapiAdapter,
} from '@imazen/crop-image-core';

import {
  type ViewportState,
  type FrameRect,
  viewportToCropRect,
  cropRectToViewport,
  clampViewport,
  computeImageTransform,
  computeFrameRect,
  getMaxZoom,
  effectiveFrameAR,
  resolveFrameAR,
  zoomToward,
} from './viewport-math.js';

import {
  createPanHandler,
  createPinchHandler,
  createWheelHandler,
  createDblClickHandler,
} from './pointer.js';

import { handleViewportKeyboard } from './keyboard.js';
import { STYLES } from './styles.js';

const ADAPTERS: Record<string, () => RiapiAdapter> = {
  generic: () => new GenericRiapiAdapter(),
  imageflow: () => new ImageflowAdapter(),
  imageresizer: () => new ImageResizerAdapter(),
};

export class CropImageElement extends HTMLElement {
  static formAssociated = true;

  static get observedAttributes(): string[] {
    return [
      'src', 'mode', 'aspect-ratio', 'aspect-ratios',
      'edge-snap', 'even-padding', 'min-width', 'min-height',
      'max-width', 'max-height', 'value', 'name', 'adapter',
      'disabled', 'shape',
    ];
  }

  // --- Private state ---
  #internals: ElementInternals;
  #shadow: ShadowRoot;
  #container: HTMLDivElement;
  #bgImg: HTMLImageElement;
  #frame: HTMLDivElement;
  #fgImg: HTMLImageElement;
  #frameBorder: HTMLDivElement;
  #slider: HTMLInputElement;
  #loaderImg: HTMLImageElement;

  #config: CropConfig = defaultConfig();
  #adapter: RiapiAdapter = new GenericRiapiAdapter();
  #viewport: ViewportState = { zoom: 1, panX: 0, panY: 0 };
  #shape: 'rect' | 'circle' = 'rect';
  #imageLoaded = false;
  #imgNatW = 0;
  #imgNatH = 0;

  #resizeObserver: ResizeObserver;
  #cleanupPan: (() => void) | null = null;
  #cleanupPinch: (() => void) | null = null;
  #cleanupWheel: (() => void) | null = null;
  #cleanupDblClick: (() => void) | null = null;
  #wheelCommitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#shadow = this.attachShadow({ mode: 'open' });

    // Build DOM
    const style = document.createElement('style');
    style.textContent = STYLES;

    this.#container = document.createElement('div');
    this.#container.className = 'container';
    this.#container.setAttribute('tabindex', '0');
    this.#container.setAttribute('role', 'application');
    this.#container.setAttribute('aria-label', 'Image crop: drag to pan, scroll to zoom');

    // Background image (dimmed)
    this.#bgImg = document.createElement('img');
    this.#bgImg.className = 'bg';
    this.#bgImg.draggable = false;
    this.#bgImg.setAttribute('aria-hidden', 'true');

    // Frame (clips the bright foreground)
    this.#frame = document.createElement('div');
    this.#frame.className = 'frame';

    // Foreground image (full brightness, inside frame)
    this.#fgImg = document.createElement('img');
    this.#fgImg.draggable = false;
    this.#fgImg.setAttribute('aria-hidden', 'true');
    this.#frame.append(this.#fgImg);

    // Frame border (separate element so border doesn't clip)
    this.#frameBorder = document.createElement('div');
    this.#frameBorder.className = 'frame-border';

    // Zoom slider
    this.#slider = document.createElement('input');
    this.#slider.type = 'range';
    this.#slider.className = 'zoom-slider';
    this.#slider.min = '1';
    this.#slider.max = '10';
    this.#slider.step = '0.01';
    this.#slider.value = '1';
    this.#slider.setAttribute('aria-label', 'Zoom level');

    // Hidden loader image (to detect load/error)
    this.#loaderImg = document.createElement('img');
    this.#loaderImg.className = 'hidden-loader';
    this.#loaderImg.addEventListener('load', this.#onImageLoad);
    this.#loaderImg.addEventListener('error', this.#onImageError);

    this.#container.append(
      this.#bgImg,
      this.#frame,
      this.#frameBorder,
      this.#slider,
    );
    this.#shadow.append(style, this.#container, this.#loaderImg);

    // ResizeObserver for responsive updates
    this.#resizeObserver = new ResizeObserver(() => this.#render());

    // Slider input
    this.#slider.addEventListener('input', this.#onSliderInput);
    this.#slider.addEventListener('change', this.#onSliderChange);

    // Keyboard on container
    this.#container.addEventListener('keydown', this.#onKeyDown);
  }

  connectedCallback(): void {
    this.#resizeObserver.observe(this.#container);
    this.#syncConfigFromAttributes();

    if (this.getAttribute('src')) {
      this.#setSrc(this.getAttribute('src')!);
    }

    // Attach gesture handlers
    this.#attachGestures();
  }

  disconnectedCallback(): void {
    this.#resizeObserver.disconnect();
    this.#detachGestures();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    switch (name) {
      case 'src':
        if (value) {
          this.#imageLoaded = false;
          this.#setSrc(value);
        }
        break;
      case 'value':
        if (value) {
          try {
            const sel = JSON.parse(value) as CropSelection;
            this.#restoreFromSelection(sel);
          } catch { /* ignore invalid JSON */ }
        }
        break;
      case 'adapter':
        this.#adapter = ADAPTERS[value || 'generic']?.() ?? new GenericRiapiAdapter();
        break;
      case 'shape':
        this.#shape = value === 'circle' ? 'circle' : 'rect';
        if (this.#imageLoaded) {
          this.#viewport = this.#clampVP(this.#viewport);
          this.#render();
          this.#emitChange();
        }
        break;
      default:
        this.#syncConfigFromAttributes();
        if (this.#imageLoaded) {
          this.#viewport = this.#clampVP(this.#viewport);
          this.#render();
          this.#emitChange();
        }
    }
  }

  // --- Public API ---

  get selection(): CropSelection {
    return this.#computeSelection();
  }

  set selection(sel: CropSelection) {
    this.#restoreFromSelection(sel);
    this.#emitChange();
  }

  get config(): CropConfig {
    return { ...this.#config };
  }

  /** Get the RIAPI querystring for the current selection. */
  get riapiQuerystring(): string {
    return this.#adapter.toParams(
      this.#computeSelection(),
      this.#config.sourceWidth,
      this.#config.sourceHeight,
    ).querystring;
  }

  /** @deprecated Use riapiQuerystring. */
  get ripiQuerystring(): string {
    return this.riapiQuerystring;
  }

  /** Get RIAPI params object. */
  get riapiParams(): Record<string, string> {
    return this.#adapter.toParams(
      this.#computeSelection(),
      this.#config.sourceWidth,
      this.#config.sourceHeight,
    ).params;
  }

  // --- Form participation ---

  get form() { return this.#internals.form; }
  get name() { return this.getAttribute('name'); }
  get type() { return 'crop-image'; }
  get validity() { return this.#internals.validity; }
  get validationMessage() { return this.#internals.validationMessage; }

  #updateFormValue(): void {
    const qs = this.riapiQuerystring;
    this.#internals.setFormValue(qs);
  }

  // --- Private methods ---

  #setSrc(src: string): void {
    this.#loaderImg.src = src;
    this.#bgImg.src = src;
    this.#fgImg.src = src;
  }

  #syncConfigFromAttributes(): void {
    const mode = this.getAttribute('mode') as 'crop' | 'crop-pad' | null;
    this.#config.mode = mode === 'crop-pad' ? 'crop-pad' : 'crop';

    const ar = this.getAttribute('aspect-ratio');
    if (ar) {
      const parsed = parseAspectRatio(ar);
      if (parsed) this.#config.aspectRatio = parsed;
    } else {
      this.#config.aspectRatio = null;
    }

    const ars = this.getAttribute('aspect-ratios');
    if (ars) {
      try {
        const list = JSON.parse(ars) as Array<{ w: number; h: number; label?: string }>;
        this.#config.aspectRatios = list.map(r => ({ width: r.w, height: r.h, label: r.label }));
      } catch { /* ignore */ }
    }

    const snap = this.getAttribute('edge-snap');
    this.#config.edgeSnapThreshold = snap != null ? Number(snap) : 0.02;

    this.#config.evenPadding = this.hasAttribute('even-padding');

    const minW = this.getAttribute('min-width');
    const minH = this.getAttribute('min-height');
    if (minW && minH) {
      this.#config.minSize = { width: Number(minW), height: Number(minH) };
    } else {
      this.#config.minSize = null;
    }

    const maxW = this.getAttribute('max-width');
    const maxH = this.getAttribute('max-height');
    if (maxW && maxH) {
      this.#config.maxSize = { width: Number(maxW), height: Number(maxH) };
    } else {
      this.#config.maxSize = null;
    }

    this.#shape = this.getAttribute('shape') === 'circle' ? 'circle' : 'rect';
  }

  #getFrameAR(): number | null {
    return effectiveFrameAR(this.#config, this.#shape, this.#imgNatW, this.#imgNatH);
  }

  #getResolvedFrameAR(): number {
    const rect = this.#container.getBoundingClientRect();
    return resolveFrameAR(this.#getFrameAR(), rect.width, rect.height);
  }

  #getImageAR(): number {
    if (this.#imgNatH <= 0) return 1;
    return this.#imgNatW / this.#imgNatH;
  }

  #getMaxZoom(): number {
    return getMaxZoom(this.#imgNatW, this.#imgNatH);
  }

  #clampVP(vp: ViewportState): ViewportState {
    return clampViewport(
      vp,
      this.#getResolvedFrameAR(),
      this.#getImageAR(),
      this.#config.mode,
      this.#getMaxZoom(),
    );
  }

  #computeSelection(): CropSelection {
    if (!this.#imageLoaded) return defaultSelection();
    const crop = viewportToCropRect(
      this.#viewport,
      this.#getResolvedFrameAR(),
      this.#getImageAR(),
    );
    // Run through the constraint engine for edge-snap, min/max, AR correction, padding
    return constrain(crop, this.#config);
  }

  #restoreFromSelection(sel: CropSelection): void {
    if (!this.#imageLoaded) return;
    const frameAR = this.#getResolvedFrameAR();
    const imageAR = this.#getImageAR();
    this.#viewport = cropRectToViewport(sel.crop, frameAR, imageAR);
    this.#viewport = this.#clampVP(this.#viewport);
    this.#render();
  }

  // --- Image load ---

  #onImageLoad = (): void => {
    this.#imageLoaded = true;
    this.#imgNatW = this.#loaderImg.naturalWidth;
    this.#imgNatH = this.#loaderImg.naturalHeight;
    this.#config.sourceWidth = this.#imgNatW;
    this.#config.sourceHeight = this.#imgNatH;

    // Set container aspect ratio to match image
    this.#container.style.aspectRatio = `${this.#imgNatW} / ${this.#imgNatH}`;

    // Initialize viewport to fit
    this.#viewport = { zoom: 1, panX: 0, panY: 0 };

    // Update slider max
    this.#slider.max = String(this.#getMaxZoom());
    this.#slider.value = '1';

    this.#render();
    this.#emitChange();
  };

  #onImageError = (): void => {
    this.#imageLoaded = false;
  };

  // --- Rendering ---

  #render(): void {
    if (!this.#imageLoaded) return;

    const rect = this.#container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const frameAR = this.#getFrameAR();
    const frameRect = computeFrameRect(rect.width, rect.height, frameAR);

    // Compute image transform
    const transform = computeImageTransform(
      this.#viewport,
      frameRect,
      this.#imgNatW,
      this.#imgNatH,
    );

    // Background image: same transform, dimmed via CSS
    this.#bgImg.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;

    // Frame position
    this.#frame.style.left = `${frameRect.x}px`;
    this.#frame.style.top = `${frameRect.y}px`;
    this.#frame.style.width = `${frameRect.w}px`;
    this.#frame.style.height = `${frameRect.h}px`;

    if (this.#shape === 'circle') {
      this.#frame.style.borderRadius = '50%';
    } else {
      this.#frame.style.borderRadius = '0';
    }

    // Foreground image: offset by frame position
    const fgX = transform.x - frameRect.x;
    const fgY = transform.y - frameRect.y;
    this.#fgImg.style.transform = `translate(${fgX}px, ${fgY}px) scale(${transform.scale})`;

    // Frame border
    this.#frameBorder.style.left = `${frameRect.x}px`;
    this.#frameBorder.style.top = `${frameRect.y}px`;
    this.#frameBorder.style.width = `${frameRect.w}px`;
    this.#frameBorder.style.height = `${frameRect.h}px`;

    if (this.#shape === 'circle') {
      this.#frameBorder.classList.add('circle');
    } else {
      this.#frameBorder.classList.remove('circle');
    }
  }

  // --- Events ---

  #emitChange(): void {
    this.#updateFormValue();
    const detail = this.#makeEventDetail();
    this.dispatchEvent(new CustomEvent('crop-change', { detail, bubbles: true, composed: true }));
  }

  #emitCommit(): void {
    this.#updateFormValue();
    const detail = this.#makeEventDetail();
    this.dispatchEvent(new CustomEvent('crop-commit', { detail, bubbles: true, composed: true }));
  }

  #makeEventDetail() {
    const selection = this.#computeSelection();
    const riapi = this.#adapter.toParams(
      selection,
      this.#config.sourceWidth,
      this.#config.sourceHeight,
    );
    return {
      selection,
      riapi: { params: riapi.params, querystring: riapi.querystring },
    };
  }

  // --- Gesture handling ---

  #attachGestures(): void {
    const isDisabled = () => this.hasAttribute('disabled');

    this.#cleanupPan = createPanHandler(
      this.#container,
      (dx, dy) => this.#handlePan(dx, dy),
      () => this.#emitCommit(),
      isDisabled,
    );

    this.#cleanupPinch = createPinchHandler(
      this.#container,
      (factor, cx, cy) => this.#handleZoom(factor, cx, cy),
      () => this.#emitCommit(),
      isDisabled,
    );

    this.#cleanupWheel = createWheelHandler(
      this.#container,
      (factor, cx, cy) => this.#handleWheelZoom(factor, cx, cy),
      isDisabled,
    );

    this.#cleanupDblClick = createDblClickHandler(
      this.#container,
      (cx, cy) => this.#handleDblClick(cx, cy),
      isDisabled,
    );
  }

  #detachGestures(): void {
    this.#cleanupPan?.();
    this.#cleanupPinch?.();
    this.#cleanupWheel?.();
    this.#cleanupDblClick?.();
    this.#cleanupPan = null;
    this.#cleanupPinch = null;
    this.#cleanupWheel = null;
    this.#cleanupDblClick = null;
  }

  #handlePan(dxPx: number, dyPx: number): void {
    if (!this.#imageLoaded) return;

    const rect = this.#container.getBoundingClientRect();
    const frameRect = computeFrameRect(rect.width, rect.height, this.#getFrameAR());
    const imageAR = this.#getImageAR();
    const frameAR = this.#getResolvedFrameAR();

    // Convert pixel delta to image-fraction delta
    // At the current zoom, the image display dimensions are:
    const transform = computeImageTransform(this.#viewport, frameRect, this.#imgNatW, this.#imgNatH);
    const imgDisplayW = this.#imgNatW * transform.scale;
    const imgDisplayH = this.#imgNatH * transform.scale;

    // Pan in image fraction units (note: dragging image right = negative panX)
    const dFracX = -dxPx / imgDisplayW;
    const dFracY = -dyPx / imgDisplayH;

    this.#viewport = this.#clampVP({
      zoom: this.#viewport.zoom,
      panX: this.#viewport.panX + dFracX,
      panY: this.#viewport.panY + dFracY,
    });

    this.#render();
    this.#emitChange();
  }

  #handleZoom(factor: number, cx: number, cy: number): void {
    if (!this.#imageLoaded) return;

    const rect = this.#container.getBoundingClientRect();
    const frameRect = computeFrameRect(rect.width, rect.height, this.#getFrameAR());

    const newZoom = Math.max(1, Math.min(this.#getMaxZoom(), this.#viewport.zoom * factor));
    this.#viewport = zoomToward(
      this.#viewport, newZoom, cx, cy,
      frameRect, this.#imgNatW, this.#imgNatH,
    );
    this.#viewport = this.#clampVP(this.#viewport);

    this.#slider.value = String(this.#viewport.zoom);

    this.#render();
    this.#emitChange();
  }

  #handleWheelZoom(factor: number, cx: number, cy: number): void {
    this.#handleZoom(factor, cx, cy);

    // Debounce commit for wheel events
    if (this.#wheelCommitTimer !== null) {
      clearTimeout(this.#wheelCommitTimer);
    }
    this.#wheelCommitTimer = setTimeout(() => {
      this.#wheelCommitTimer = null;
      this.#emitCommit();
    }, 150);
  }

  #handleDblClick(cx: number, cy: number): void {
    if (!this.#imageLoaded) return;

    if (this.#viewport.zoom > 1.05) {
      // Reset to fit
      this.#viewport = { zoom: 1, panX: 0, panY: 0 };
    } else {
      // Zoom to 2x at click point
      const rect = this.#container.getBoundingClientRect();
      const frameRect = computeFrameRect(rect.width, rect.height, this.#getFrameAR());
      this.#viewport = zoomToward(
        this.#viewport, 2, cx, cy,
        frameRect, this.#imgNatW, this.#imgNatH,
      );
    }

    this.#viewport = this.#clampVP(this.#viewport);
    this.#slider.value = String(this.#viewport.zoom);
    this.#render();
    this.#emitChange();
    this.#emitCommit();
  }

  // --- Slider ---

  #onSliderInput = (): void => {
    if (!this.#imageLoaded) return;

    const newZoom = Number(this.#slider.value);
    const rect = this.#container.getBoundingClientRect();
    const frameRect = computeFrameRect(rect.width, rect.height, this.#getFrameAR());

    // Zoom toward frame center when using slider
    const fcx = frameRect.x + frameRect.w / 2;
    const fcy = frameRect.y + frameRect.h / 2;

    this.#viewport = zoomToward(
      this.#viewport, newZoom, fcx, fcy,
      frameRect, this.#imgNatW, this.#imgNatH,
    );
    this.#viewport = this.#clampVP(this.#viewport);

    this.#render();
    this.#emitChange();
  };

  #onSliderChange = (): void => {
    this.#emitCommit();
  };

  // --- Keyboard ---

  #onKeyDown = (e: KeyboardEvent): void => {
    if (this.hasAttribute('disabled')) return;

    const action = handleViewportKeyboard(e);
    if (!action) return;
    e.preventDefault();

    switch (action.type) {
      case 'pan':
        this.#viewport = this.#clampVP({
          zoom: this.#viewport.zoom,
          panX: this.#viewport.panX + (action.dx ?? 0),
          panY: this.#viewport.panY + (action.dy ?? 0),
        });
        break;
      case 'zoom': {
        const newZoom = this.#viewport.zoom * (action.zoomDelta ?? 1);
        const rect = this.#container.getBoundingClientRect();
        const frameRect = computeFrameRect(rect.width, rect.height, this.#getFrameAR());
        const fcx = frameRect.x + frameRect.w / 2;
        const fcy = frameRect.y + frameRect.h / 2;
        this.#viewport = zoomToward(
          this.#viewport, newZoom, fcx, fcy,
          frameRect, this.#imgNatW, this.#imgNatH,
        );
        this.#viewport = this.#clampVP(this.#viewport);
        break;
      }
      case 'reset':
        this.#viewport = { zoom: 1, panX: 0, panY: 0 };
        break;
    }

    this.#slider.value = String(this.#viewport.zoom);
    this.#render();
    this.#emitChange();
    this.#emitCommit();
  };
}

function parseAspectRatio(str: string): AspectRatio | null {
  // Accepts "16/9", "16:9", "1.5"
  const slashMatch = str.match(/^(\d+(?:\.\d+)?)\s*[/:]\s*(\d+(?:\.\d+)?)$/);
  if (slashMatch) {
    return { width: Number(slashMatch[1]), height: Number(slashMatch[2]) };
  }
  const num = Number(str);
  if (!isNaN(num) && num > 0) {
    return { width: num, height: 1 };
  }
  return null;
}

// Register the element
if (typeof customElements !== 'undefined' && !customElements.get('crop-image')) {
  customElements.define('crop-image', CropImageElement);
}
