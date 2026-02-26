import { useState, useCallback } from 'react';
import type { CropSelection } from '@imazen/crop-image-core';
import { defaultSelection, ZERO_PAD } from '@imazen/crop-image-core';
import type { CropChangeDetail } from './CropImage.js';

export interface UseCropOptions {
  initialSelection?: CropSelection;
}

export interface UseCropReturn {
  selection: CropSelection;
  onChange: (detail: CropChangeDetail) => void;
  onCommit: (detail: CropChangeDetail) => void;
  setSelection: (sel: CropSelection) => void;
  reset: () => void;
  /** The last committed RIAPI querystring. */
  querystring: string;
  /** The last committed RIAPI params. */
  params: Record<string, string>;
}

/**
 * Controlled-mode hook for the CropImage React component.
 */
export function useCrop(options: UseCropOptions = {}): UseCropReturn {
  const initial = options.initialSelection ?? defaultSelection();
  const [selection, setSelection] = useState<CropSelection>(initial);
  const [querystring, setQuerystring] = useState('');
  const [params, setParams] = useState<Record<string, string>>({});

  const onChange = useCallback((detail: CropChangeDetail) => {
    setSelection(detail.selection);
  }, []);

  const onCommit = useCallback((detail: CropChangeDetail) => {
    setSelection(detail.selection);
    setQuerystring(detail.riapi.querystring);
    setParams(detail.riapi.params);
  }, []);

  const reset = useCallback(() => {
    setSelection(initial);
    setQuerystring('');
    setParams({});
  }, [initial]);

  return { selection, onChange, onCommit, setSelection, reset, querystring, params };
}
