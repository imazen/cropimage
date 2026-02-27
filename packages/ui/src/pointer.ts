/** Callback for pan gestures. dx/dy are in container pixels. */
export type PanCallback = (dx: number, dy: number) => void;
/** Callback for zoom gestures. factor is multiplicative, cx/cy are container pixel coords. */
export type ZoomCallback = (factor: number, cx: number, cy: number) => void;
/** Callback when a gesture ends. */
export type GestureEndCallback = () => void;

/**
 * Create a single-pointer pan handler with pointer capture.
 * Attaches to the container element. Returns a cleanup function.
 */
export function createPanHandler(
  container: HTMLElement,
  onPan: PanCallback,
  onEnd: GestureEndCallback,
  isDisabled: () => boolean,
): () => void {
  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;

  function onPointerDown(e: PointerEvent) {
    if (isDisabled()) return;
    if (pointerId !== null) return; // already tracking
    if (e.button !== 0) return; // left button only

    pointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;

    container.setPointerCapture(e.pointerId);
    container.classList.add('grabbing');
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    onPan(dx, dy);
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    container.releasePointerCapture(e.pointerId);
    container.classList.remove('grabbing');
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
    pointerId = null;
    onEnd();
  }

  container.addEventListener('pointerdown', onPointerDown);

  return () => {
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
    if (pointerId !== null) {
      container.classList.remove('grabbing');
    }
  };
}

/**
 * Create a two-pointer pinch-to-zoom handler.
 * Returns a cleanup function.
 */
export function createPinchHandler(
  container: HTMLElement,
  onZoom: ZoomCallback,
  onEnd: GestureEndCallback,
  isDisabled: () => boolean,
): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let lastDist = 0;

  function getDistance(): number {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getMidpoint(): { x: number; y: number } {
    const pts = [...pointers.values()];
    if (pts.length < 2) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: (pts[0].x + pts[1].x) / 2 - rect.left,
      y: (pts[0].y + pts[1].y) / 2 - rect.top,
    };
  }

  function onTouchStart(e: TouchEvent) {
    if (isDisabled()) return;
    for (const touch of Array.from(e.changedTouches)) {
      pointers.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    if (pointers.size === 2) {
      lastDist = getDistance();
      e.preventDefault();
    }
  }

  function onTouchMove(e: TouchEvent) {
    for (const touch of Array.from(e.changedTouches)) {
      if (pointers.has(touch.identifier)) {
        pointers.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
      }
    }
    if (pointers.size === 2) {
      const dist = getDistance();
      if (lastDist > 0 && dist > 0) {
        const factor = dist / lastDist;
        const mid = getMidpoint();
        onZoom(factor, mid.x, mid.y);
      }
      lastDist = dist;
      e.preventDefault();
    }
  }

  function onTouchEnd(e: TouchEvent) {
    for (const touch of Array.from(e.changedTouches)) {
      pointers.delete(touch.identifier);
    }
    if (pointers.size < 2) {
      lastDist = 0;
      onEnd();
    }
  }

  container.addEventListener('touchstart', onTouchStart, { passive: false });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd);
  container.addEventListener('touchcancel', onTouchEnd);

  return () => {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('touchcancel', onTouchEnd);
  };
}

/**
 * Create a scroll-wheel zoom handler.
 * Returns a cleanup function.
 */
export function createWheelHandler(
  container: HTMLElement,
  onZoom: ZoomCallback,
  isDisabled: () => boolean,
): () => void {
  function onWheel(e: WheelEvent) {
    if (isDisabled()) return;
    e.preventDefault();

    // Normalize deltaY across browsers: typically ~100 per "notch"
    const delta = -e.deltaY;
    // Convert to a multiplicative zoom factor
    const factor = 1 + delta * 0.002;

    const rect = container.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    onZoom(factor, cx, cy);
  }

  container.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    container.removeEventListener('wheel', onWheel);
  };
}

/**
 * Create a double-click handler for toggling zoom.
 * Returns a cleanup function.
 */
export function createDblClickHandler(
  container: HTMLElement,
  onToggle: (cx: number, cy: number) => void,
  isDisabled: () => boolean,
): () => void {
  function onDblClick(e: MouseEvent) {
    if (isDisabled()) return;
    const rect = container.getBoundingClientRect();
    onToggle(e.clientX - rect.left, e.clientY - rect.top);
  }

  container.addEventListener('dblclick', onDblClick);

  return () => {
    container.removeEventListener('dblclick', onDblClick);
  };
}
