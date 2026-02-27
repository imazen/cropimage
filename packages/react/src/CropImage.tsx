import {
  forwardRef,
  useEffect,
  useRef,
  useImperativeHandle,
  type HTMLAttributes,
} from 'react';
import type { CropSelection, AspectRatio } from '@imazen/crop-image-core';

// Ensure web component is registered (SSR-safe)
if (typeof window !== 'undefined') {
  import('@imazen/crop-image');
}

export interface CropChangeDetail {
  selection: CropSelection;
  riapi: { params: Record<string, string>; querystring: string };
}

export interface CropImageProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  src: string;
  mode?: 'crop' | 'crop-pad';
  aspectRatio?: string;
  aspectRatios?: Array<{ w: number; h: number; label?: string }>;
  edgeSnap?: number;
  evenPadding?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  value?: CropSelection;
  name?: string;
  adapter?: 'generic' | 'imageflow' | 'imageresizer';
  disabled?: boolean;
  shape?: 'rect' | 'circle';
  maxZoom?: number;
  snapThreshold?: number;
  onChange?: (detail: CropChangeDetail) => void;
  onCommit?: (detail: CropChangeDetail) => void;
}

export interface CropImageRef {
  element: HTMLElement | null;
  selection: CropSelection | undefined;
}

/**
 * React wrapper for the <crop-image> web component.
 */
export const CropImage = forwardRef<CropImageRef, CropImageProps>(
  function CropImage(props, ref) {
    const {
      src,
      mode,
      aspectRatio,
      aspectRatios,
      edgeSnap,
      evenPadding,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      value,
      name,
      adapter,
      disabled,
      shape,
      maxZoom,
      snapThreshold,
      onChange,
      onCommit,
      ...rest
    } = props;

    const elRef = useRef<HTMLElement>(null);

    useImperativeHandle(ref, () => ({
      get element() { return elRef.current; },
      get selection() { return (elRef.current as any)?.selection; },
    }));

    // Set complex properties imperatively
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      if (value) {
        (el as any).selection = value;
      }
    }, [value]);

    // Bind custom events (React can't bind to custom events in JSX)
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;

      const handleChange = (e: Event) => {
        onChange?.((e as CustomEvent).detail);
      };
      const handleCommit = (e: Event) => {
        onCommit?.((e as CustomEvent).detail);
      };

      el.addEventListener('crop-change', handleChange);
      el.addEventListener('crop-commit', handleCommit);
      return () => {
        el.removeEventListener('crop-change', handleChange);
        el.removeEventListener('crop-commit', handleCommit);
      };
    }, [onChange, onCommit]);

    // Build attributes
    const attrs: Record<string, any> = {
      src,
      ...rest,
    };

    if (mode) attrs.mode = mode;
    if (aspectRatio) attrs['aspect-ratio'] = aspectRatio;
    if (aspectRatios) attrs['aspect-ratios'] = JSON.stringify(aspectRatios);
    if (edgeSnap !== undefined) attrs['edge-snap'] = String(edgeSnap);
    if (evenPadding) attrs['even-padding'] = '';
    if (minWidth !== undefined) attrs['min-width'] = String(minWidth);
    if (minHeight !== undefined) attrs['min-height'] = String(minHeight);
    if (maxWidth !== undefined) attrs['max-width'] = String(maxWidth);
    if (maxHeight !== undefined) attrs['max-height'] = String(maxHeight);
    if (name) attrs.name = name;
    if (adapter) attrs.adapter = adapter;
    if (disabled) attrs.disabled = '';
    if (shape) attrs.shape = shape;
    if (maxZoom !== undefined) attrs['max-zoom'] = String(maxZoom);
    if (snapThreshold !== undefined) attrs['snap-threshold'] = String(snapThreshold);

    // @ts-expect-error - crop-image is a custom element not known to React's JSX types
    return <crop-image ref={elRef} {...attrs} />;
  },
);
