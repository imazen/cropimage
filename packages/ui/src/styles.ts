export const STYLES = `
:host {
  display: inline-block;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  line-height: 0;
  --crop-handle-size: 10px;
  --crop-handle-color: #fff;
  --crop-handle-border: 1.5px solid rgba(0, 0, 0, 0.6);
  --crop-border-color: rgba(255, 255, 255, 0.7);
  --crop-border-width: 1px;
  --crop-overlay-color: rgba(0, 0, 0, 0.5);
  --crop-guide-color: rgba(255, 255, 255, 0.3);
  --crop-guide-width: 0.5px;
  --crop-pad-color: rgba(80, 140, 220, 0.25);
  --crop-pad-stripe: rgba(80, 140, 220, 0.15);
}

:host([disabled]) {
  pointer-events: none;
  opacity: 0.6;
}

.container {
  position: relative;
  display: inline-block;
  overflow: hidden;
}

.container img {
  display: block;
  max-width: 100%;
  height: auto;
  pointer-events: none;
}

.overlay {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.overlay svg {
  width: 100%;
  height: 100%;
  display: block;
}

.crop-area {
  cursor: move;
}

.handle {
  fill: var(--crop-handle-color);
  stroke: rgba(0, 0, 0, 0.6);
  stroke-width: 1.5;
  cursor: pointer;
}
.handle-n, .handle-s { cursor: ns-resize; }
.handle-e, .handle-w { cursor: ew-resize; }
.handle-nw, .handle-se { cursor: nwse-resize; }
.handle-ne, .handle-sw { cursor: nesw-resize; }

/* Focus ring for keyboard nav */
.handle:focus {
  outline: 2px solid #4d90fe;
  outline-offset: 2px;
}
`;
