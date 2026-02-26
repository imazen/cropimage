# `<crop-image>`

Zero-dependency web component for image cropping. Outputs [RIAPI](https://riapi.org/) querystrings compatible with Imageflow, ImageResizer, and any RIAPI-compliant server.

## Packages

| Package | Description |
|---------|-------------|
| `@imazen/crop-image-core` | Pure math: types, constraints, state reducer, RIAPI adapters |
| `@imazen/crop-image` | `<crop-image>` web component (Shadow DOM, ~7KB gzipped) |
| `@imazen/crop-image-react` | React wrapper + `useCrop` hook |
| `@imazen/crop-image-svelte` | Svelte action + helpers |

## Quick Start

### Script tag (CDN/IIFE)

```html
<script src="https://unpkg.com/@imazen/crop-image/dist/crop-image.iife.js"></script>
<crop-image src="/photo.jpg" name="crop"></crop-image>
```

### npm

```bash
npm install @imazen/crop-image
```

```html
<script type="module">
  import '@imazen/crop-image';
</script>

<crop-image src="/photo.jpg" aspect-ratio="16/9" name="crop"></crop-image>
```

### React

```bash
npm install @imazen/crop-image-react
```

```tsx
import { CropImage, useCrop } from '@imazen/crop-image-react';

function App() {
  const crop = useCrop();
  return (
    <CropImage
      src="/photo.jpg"
      aspectRatio="16/9"
      onChange={crop.onChange}
      onCommit={crop.onCommit}
    />
  );
}
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `src` | string | — | Image URL |
| `mode` | `crop` \| `crop-pad` | `crop` | Crop-only or crop with padding |
| `aspect-ratio` | string | free | e.g. `16/9`, `1:1`, `1.5` |
| `aspect-ratios` | JSON | — | Menu of choices: `[{"w":16,"h":9,"label":"16:9"}]` |
| `edge-snap` | number | `0.02` | Snap threshold (0..1) |
| `even-padding` | boolean | false | Mirror padding on opposing sides |
| `min-width` | number | — | Minimum crop width in pixels |
| `min-height` | number | — | Minimum crop height in pixels |
| `max-width` | number | — | Maximum crop width in pixels |
| `max-height` | number | — | Maximum crop height in pixels |
| `value` | JSON | — | Set selection as `CropSelection` JSON |
| `name` | string | — | Form field name (enables form participation) |
| `adapter` | string | `generic` | RIAPI adapter: `generic`, `imageflow`, `imageresizer` |
| `disabled` | boolean | false | Disable interaction |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `crop-change` | `{ selection, riapi }` | Fires continuously during drag |
| `crop-commit` | `{ selection, riapi }` | Fires on drag end |

## CSS Custom Properties

```css
crop-image {
  --crop-handle-color: #fff;
  --crop-overlay-color: rgba(0, 0, 0, 0.5);
  --crop-border-color: rgba(255, 255, 255, 0.7);
  --crop-guide-color: rgba(255, 255, 255, 0.3);
  --crop-pad-color: rgba(80, 140, 220, 0.25);
}
```

## RIAPI Output

All coordinates are 0..1 fractions. The generic adapter outputs:

```
?crop=0.1,0.1,0.9,0.9&cropxunits=1&cropyunits=1
```

The Imageflow adapter adds `&s.pad=T,R,B,L` for padding.
The ImageResizer adapter adds `&margin=T,R,B,L` for padding.

## Development

```bash
pnpm install
pnpm build        # Build all packages
pnpm test         # Run tests
pnpm dev          # Start demo at http://localhost:3100
```
