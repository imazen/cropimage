import {
  type CropSelection,
  type CropConfig,
  type CropState,
  type CropAction,
  type AspectRatio,
  type DragHandle,
  cropReducer,
  constrain,
  normalizeCrop,
  defaultConfig,
  defaultState,
  defaultSelection,
  ZERO_PAD,
  GenericRiapiAdapter,
  ImageflowAdapter,
  ImageResizerAdapter,
  type RiapiAdapter,
} from '@imazen/crop-image-core';
import { createOverlay, updateOverlay, type OverlayElements } from './overlay.js';
import { pointerToFractional, hitTestHandle, type PointerState } from './pointer.js';
import { handleKeyboard } from './keyboard.js';
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
      'max-width', 'max-height', 'value', 'name', 'adapter', 'disabled',
    ];
  }

  // --- Private state ---
  #internals: ElementInternals;
  #shadow: ShadowRoot;
  #container: HTMLDivElement;
  #img: HTMLImageElement;
  #overlayEl: HTMLDivElement;
  #overlay: OverlayElements | null = null;
  #state: CropState = defaultState();
  #config: CropConfig = defaultConfig();
  #adapter: RiapiAdapter = new GenericRiapiAdapter();
  #pointer: PointerState = { pointerId: null, handle: null };
  #imageLoaded = false;
  #resizeObserver: ResizeObserver;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#shadow = this.attachShadow({ mode: 'open' });

    // Build DOM
    const style = document.createElement('style');
    style.textContent = STYLES;

    this.#container = document.createElement('div');
    this.#container.className = 'container';

    this.#img = document.createElement('img');
    this.#img.addEventListener('load', this.#onImageLoad);
    this.#img.addEventListener('error', this.#onImageError);

    this.#overlayEl = document.createElement('div');
    this.#overlayEl.className = 'overlay';

    this.#container.append(this.#img, this.#overlayEl);
    this.#shadow.append(style, this.#container);

    // ResizeObserver for responsive updates
    this.#resizeObserver = new ResizeObserver(() => this.#render());

    // Pointer events on the overlay
    this.#overlayEl.addEventListener('pointerdown', this.#onPointerDown);

    // Keyboard events (handles are focusable)
    this.#overlayEl.addEventListener('keydown', this.#onKeyDown);
  }

  connectedCallback(): void {
    this.#resizeObserver.observe(this.#container);
    this.#syncConfigFromAttributes();
    if (this.getAttribute('src')) {
      this.#img.src = this.getAttribute('src')!;
    }
  }

  disconnectedCallback(): void {
    this.#resizeObserver.disconnect();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    switch (name) {
      case 'src':
        if (value) {
          this.#imageLoaded = false;
          this.#img.src = value;
        }
        break;
      case 'value':
        if (value) {
          try {
            const sel = JSON.parse(value) as CropSelection;
            this.#dispatch({ type: 'SET_SELECTION', selection: sel });
          } catch { /* ignore invalid JSON */ }
        }
        break;
      case 'adapter':
        this.#adapter = ADAPTERS[value || 'generic']?.() ?? new GenericRiapiAdapter();
        break;
      default:
        this.#syncConfigFromAttributes();
        this.#render();
    }
  }

  // --- Public API ---

  get selection(): CropSelection {
    return this.#state.selection;
  }

  set selection(sel: CropSelection) {
    this.#dispatch({ type: 'SET_SELECTION', selection: sel });
    this.#render();
    this.#emitChange();
  }

  get config(): CropConfig {
    return { ...this.#config };
  }

  /** Get the RIAPI querystring for the current selection. */
  get ripiQuerystring(): string {
    return this.#adapter.toParams(
      this.#state.selection,
      this.#config.sourceWidth,
      this.#config.sourceHeight,
    ).querystring;
  }

  /** Get RIAPI params object. */
  get riapiParams(): Record<string, string> {
    return this.#adapter.toParams(
      this.#state.selection,
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
    const qs = this.ripiQuerystring;
    this.#internals.setFormValue(qs);
  }

  // --- Private methods ---

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
  }

  #dispatch(action: CropAction): void {
    this.#state = cropReducer(this.#state, action, this.#config);
  }

  #onImageLoad = (): void => {
    this.#imageLoaded = true;
    this.#config.sourceWidth = this.#img.naturalWidth;
    this.#config.sourceHeight = this.#img.naturalHeight;

    // Create overlay if needed
    if (!this.#overlay) {
      this.#overlay = createOverlay();
      this.#overlayEl.append(this.#overlay.svg);
    }

    // Apply initial constraint to default selection
    const constrained = constrain(this.#state.selection.crop, this.#config);
    this.#dispatch({ type: 'SET_SELECTION', selection: constrained });

    this.#render();
    this.#emitChange();
  };

  #onImageError = (): void => {
    this.#imageLoaded = false;
  };

  #render(): void {
    if (!this.#overlay || !this.#imageLoaded) return;
    const rect = this.#container.getBoundingClientRect();
    updateOverlay(this.#overlay, this.#state.selection, this.#config, rect.width, rect.height);
  }

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
    const riapi = this.#adapter.toParams(
      this.#state.selection,
      this.#config.sourceWidth,
      this.#config.sourceHeight,
    );
    return {
      selection: this.#state.selection,
      riapi: { params: riapi.params, querystring: riapi.querystring },
    };
  }

  // --- Pointer handling ---

  #onPointerDown = (e: PointerEvent): void => {
    if (this.hasAttribute('disabled')) return;
    if (this.#pointer.pointerId !== null) return; // already tracking

    const svgRect = this.#overlayEl.getBoundingClientRect();
    const point = pointerToFractional(e, svgRect);

    let handle = hitTestHandle(e.target);

    if (!handle) {
      // Click on empty area → start new selection
      this.#dispatch({ type: 'NEW_SELECTION_START', point });
      handle = 'new';
    } else {
      this.#dispatch({
        type: 'DRAG_START',
        handle,
        point,
        selection: this.#state.selection,
      });
    }

    this.#pointer = { pointerId: e.pointerId, handle };
    this.#overlayEl.setPointerCapture(e.pointerId);
    this.#overlayEl.addEventListener('pointermove', this.#onPointerMove);
    this.#overlayEl.addEventListener('pointerup', this.#onPointerUp);
    this.#overlayEl.addEventListener('pointercancel', this.#onPointerUp);
    e.preventDefault();
  };

  #onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.#pointer.pointerId) return;
    const svgRect = this.#overlayEl.getBoundingClientRect();
    const point = pointerToFractional(e, svgRect);
    this.#dispatch({ type: 'DRAG_MOVE', point });
    this.#render();
    this.#emitChange();
  };

  #onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.#pointer.pointerId) return;
    this.#overlayEl.releasePointerCapture(e.pointerId);
    this.#overlayEl.removeEventListener('pointermove', this.#onPointerMove);
    this.#overlayEl.removeEventListener('pointerup', this.#onPointerUp);
    this.#overlayEl.removeEventListener('pointercancel', this.#onPointerUp);
    this.#dispatch({ type: 'DRAG_END' });
    this.#pointer = { pointerId: null, handle: null };
    this.#render();
    this.#emitCommit();
  };

  // --- Keyboard handling ---

  #onKeyDown = (e: KeyboardEvent): void => {
    if (this.hasAttribute('disabled')) return;
    const target = e.target;
    if (!(target instanceof Element)) return;

    const handleName = target.getAttribute('data-handle') as DragHandle | null;
    if (!handleName) return;

    const newCrop = handleKeyboard(e, this.#state.selection.crop, handleName);
    if (newCrop) {
      e.preventDefault();
      const constrained = constrain(normalizeCrop(newCrop), this.#config, handleName);
      this.#dispatch({ type: 'SET_SELECTION', selection: constrained });
      this.#render();
      this.#emitChange();
      this.#emitCommit();
    }
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
