import type { CropSelection, AspectRatio } from '@imazen/crop-image-core';

export interface CropImageEvents {
  'crop-change': CustomEvent<{
    selection: CropSelection;
    riapi: { params: Record<string, string>; querystring: string };
  }>;
  'crop-commit': CustomEvent<{
    selection: CropSelection;
    riapi: { params: Record<string, string>; querystring: string };
  }>;
}

export interface CropImageProps {
  src: string;
  mode?: 'crop' | 'crop-pad';
  'aspect-ratio'?: string;
  'aspect-ratios'?: string;
  'edge-snap'?: string;
  'even-padding'?: boolean;
  'min-width'?: string;
  'min-height'?: string;
  'max-width'?: string;
  'max-height'?: string;
  value?: string;
  name?: string;
  adapter?: 'generic' | 'imageflow' | 'imageresizer';
  disabled?: boolean;
  shape?: 'rect' | 'circle';
}

/**
 * Svelte action to initialize the <crop-image> web component.
 *
 * Usage in Svelte:
 *   <crop-image use:cropImage src="/photo.jpg" on:crop-change={handler} />
 */
export function cropImage(node: HTMLElement): { destroy: () => void } {
  // Ensure web component is registered
  if (typeof window !== 'undefined') {
    import('@imazen/crop-image');
  }

  return {
    destroy() {
      // No cleanup needed — the web component handles its own lifecycle
    },
  };
}

/**
 * Helper to set complex properties on the crop-image element.
 */
export function setCropSelection(el: HTMLElement, selection: CropSelection): void {
  (el as any).selection = selection;
}

export function getCropSelection(el: HTMLElement): CropSelection | undefined {
  return (el as any).selection;
}
