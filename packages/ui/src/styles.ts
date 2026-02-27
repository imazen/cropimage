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

/* Hidden image used only to load the source */
.hidden-loader {
  display: none;
}
`;
