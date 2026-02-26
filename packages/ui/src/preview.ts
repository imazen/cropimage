import type { CropSelection } from '@imazen/crop-image-core';

/**
 * <crop-image-preview> shows a live preview of the cropped area.
 *
 * Usage:
 *   <crop-image id="cropper" src="/photo.jpg"></crop-image>
 *   <crop-image-preview for="cropper" width="200" height="200"></crop-image-preview>
 */
export class CropImagePreviewElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['for', 'width', 'height'];
  }

  #shadow: ShadowRoot;
  #img: HTMLImageElement;
  #container: HTMLDivElement;
  #cropperEl: HTMLElement | null = null;
  #boundUpdate: (e: Event) => void;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; overflow: hidden; }
      .preview-container { position: relative; overflow: hidden; }
      .preview-container img { position: absolute; max-width: none; }
    `;

    this.#container = document.createElement('div');
    this.#container.className = 'preview-container';

    this.#img = document.createElement('img');
    this.#container.append(this.#img);

    this.#shadow.append(style, this.#container);

    this.#boundUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.selection) this.#updatePreview(detail.selection);
    };
  }

  connectedCallback(): void {
    this.#connectCropper();
  }

  disconnectedCallback(): void {
    this.#disconnectCropper();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'for') {
      this.#disconnectCropper();
      this.#connectCropper();
    }
    if (name === 'width' || name === 'height') {
      this.#container.style.width = (this.getAttribute('width') ?? '200') + 'px';
      this.#container.style.height = (this.getAttribute('height') ?? '200') + 'px';
    }
  }

  #connectCropper(): void {
    const forId = this.getAttribute('for');
    if (!forId) return;
    const cropper = document.getElementById(forId);
    if (!cropper) return;
    this.#cropperEl = cropper;
    this.#img.src = cropper.getAttribute('src') ?? '';
    cropper.addEventListener('crop-change', this.#boundUpdate);
    this.#container.style.width = (this.getAttribute('width') ?? '200') + 'px';
    this.#container.style.height = (this.getAttribute('height') ?? '200') + 'px';
  }

  #disconnectCropper(): void {
    this.#cropperEl?.removeEventListener('crop-change', this.#boundUpdate);
    this.#cropperEl = null;
  }

  #updatePreview(sel: CropSelection): void {
    const previewW = parseInt(this.getAttribute('width') ?? '200');
    const previewH = parseInt(this.getAttribute('height') ?? '200');
    const { x1, y1, x2, y2 } = sel.crop;
    const cropW = x2 - x1;
    const cropH = y2 - y1;

    if (cropW <= 0 || cropH <= 0) return;

    // Scale the full image so the crop region fills the preview
    const scaleX = previewW / cropW;
    const scaleY = previewH / cropH;
    // Use the scale that shows 100% of the crop region
    // For non-matching aspect ratios, this will letterbox
    const scale = Math.min(scaleX, scaleY);

    const imgW = scale; // Scale factor (image width = scale * 1 since x is 0..1)
    const imgH = scale;

    this.#img.style.width = `${imgW}px`;
    this.#img.style.height = `${imgH}px`;

    // Wait — these are fractional. We need the actual image natural dimensions.
    // The preview uses CSS transform instead.
    const imgNatW = this.#img.naturalWidth || 1;
    const imgNatH = this.#img.naturalHeight || 1;

    const displayW = previewW / cropW;
    const displayH = previewH / cropH;

    this.#img.style.width = `${displayW}px`;
    this.#img.style.height = `${displayH}px`;
    this.#img.style.left = `${-x1 * displayW}px`;
    this.#img.style.top = `${-y1 * displayH}px`;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('crop-image-preview')) {
  customElements.define('crop-image-preview', CropImagePreviewElement);
}
