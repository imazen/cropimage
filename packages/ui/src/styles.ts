export const STYLES = `
:host {
  display: inline-block;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  line-height: 0;
  --crop-overlay-color: rgba(0, 0, 0, 0.65);
  --crop-border-color: rgba(255, 255, 255, 0.85);
  --crop-border-width: 2px;
  --crop-pad-color: rgba(80, 140, 220, 0.25);
  --crop-slider-track: rgba(255, 255, 255, 0.3);
  --crop-slider-thumb: #fff;
}

:host([disabled]) {
  pointer-events: none;
  opacity: 0.6;
}

.container {
  position: relative;
  display: block;
  overflow: hidden;
  width: 100%;
  cursor: grab;
  background: #111;
}

.container.grabbing {
  cursor: grabbing;
}

/* Background image: dimmed, shows full extent */
.bg {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
  filter: brightness(0.35);
  pointer-events: none;
  max-width: none;
  max-height: none;
}

/* Frame: clips the bright foreground image */
.frame {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
}

.frame img {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
  pointer-events: none;
  max-width: none;
  max-height: none;
}

/* Frame border overlay */
.frame-border {
  position: absolute;
  box-sizing: border-box;
  border: var(--crop-border-width) solid var(--crop-border-color);
  pointer-events: none;
}

.frame-border.circle {
  border-radius: 50%;
}

/* Resize handles container */
.handles {
  position: absolute;
  box-sizing: border-box;
  z-index: 5;
  pointer-events: none;
}

.handle {
  position: absolute;
  box-sizing: border-box;
  pointer-events: auto;
}

/* Corner handles — 28px hit zone centered on frame corner */
.handle-nw, .handle-ne, .handle-sw, .handle-se {
  width: 28px;
  height: 28px;
}

.handle-nw { top: -14px; left: -14px; cursor: nwse-resize; }
.handle-ne { top: -14px; right: -14px; cursor: nesw-resize; }
.handle-sw { bottom: -14px; left: -14px; cursor: nesw-resize; }
.handle-se { bottom: -14px; right: -14px; cursor: nwse-resize; }

/* Edge handles — 14px wide strip along each edge */
.handle-n, .handle-s {
  left: 28px;
  right: 28px;
  height: 14px;
  cursor: ns-resize;
}

.handle-e, .handle-w {
  top: 28px;
  bottom: 28px;
  width: 14px;
  cursor: ew-resize;
}

.handle-n { top: -7px; }
.handle-s { bottom: -7px; }
.handle-e { right: -7px; }
.handle-w { left: -7px; }

/* L-shaped corner marks */
.handle-nw::after, .handle-ne::after, .handle-sw::after, .handle-se::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border-color: var(--crop-border-color);
  border-style: solid;
  border-width: 0;
}

.handle-nw::after { top: 14px; left: 14px; border-top-width: 3px; border-left-width: 3px; }
.handle-ne::after { top: 14px; right: 14px; border-top-width: 3px; border-right-width: 3px; }
.handle-sw::after { bottom: 14px; left: 14px; border-bottom-width: 3px; border-left-width: 3px; }
.handle-se::after { bottom: 14px; right: 14px; border-bottom-width: 3px; border-right-width: 3px; }

/* Zoom slider */
.zoom-slider {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: min(200px, 60%);
  height: 20px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
  z-index: 10;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.zoom-slider:hover {
  opacity: 1;
}

.zoom-slider::-webkit-slider-runnable-track {
  height: 3px;
  background: var(--crop-slider-track);
  border-radius: 2px;
}

.zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--crop-slider-thumb);
  border: none;
  margin-top: -5.5px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

.zoom-slider::-moz-range-track {
  height: 3px;
  background: var(--crop-slider-track);
  border-radius: 2px;
  border: none;
}

.zoom-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--crop-slider-thumb);
  border: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

/* Focus indicator for keyboard accessibility */
.container:focus-visible {
  outline: 2px solid #4d90fe;
  outline-offset: 2px;
}

/* Snap ratio label (shown during frame resize) */
.snap-label {
  position: absolute;
  top: -26px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: var(--crop-border-color);
  font: 500 11px/1 system-ui, -apple-system, sans-serif;
  padding: 4px 8px;
  border-radius: 3px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.12s;
  pointer-events: none;
}

.snap-label.visible {
  opacity: 1;
}

/* Hidden image used only to load the source */
.hidden-loader {
  display: none;
}
`;
