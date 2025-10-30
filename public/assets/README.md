# Assets Directory

This directory contains all static web assets for the After Party application.

## Directory Structure

```
assets/
├── logos/          # Brand logos and variations
├── backgrounds/    # Background images and patterns
├── images/         # General images (photos, graphics, etc.)
├── icons/          # Icon files (SVG, PNG icons)
├── fonts/          # Custom web fonts (if not using CDN)
└── videos/         # Video files (intro, backgrounds, etc.)
```

## Usage in Components

All files in the `public/` directory can be referenced from the root path:

```tsx
// Example: Logo
<img src="/assets/logos/logo.svg" alt="After Party Logo" />

// Example: Background
<div style={{ backgroundImage: 'url(/assets/backgrounds/hero-bg.jpg)' }} />

// Example: With Next.js Image component
import Image from 'next/image'
<Image src="/assets/images/photo.jpg" alt="Description" width={800} height={600} />
```

## Image Optimization Guidelines

### Logos
- **Format**: SVG preferred for scalability, PNG for complex logos
- **Sizes**: Provide multiple sizes if using PNG (1x, 2x, 3x)
- **Naming**: `logo.svg`, `logo-white.svg`, `logo-icon.svg`, etc.

### Backgrounds
- **Format**: WebP with JPEG fallback for best compression
- **Optimization**: Compress images before adding to repo
- **Sizes**: Provide appropriate sizes for different viewports
- **Naming**: Descriptive names like `hero-background.jpg`, `pattern-dots.svg`

### Images
- **Format**: WebP preferred, JPEG for photos, PNG for graphics with transparency
- **Size**: Optimize for web (aim for < 500KB per image)
- **Responsive**: Consider providing multiple sizes for responsive images
- **Alt text**: Always include descriptive alt text in components

### Icons
- **Format**: SVG preferred for icons
- **Size**: Keep SVG files clean and optimized
- **Naming**: Use descriptive names like `icon-play.svg`, `icon-chat.svg`

## Recommended Tools

- **Image Compression**: TinyPNG, Squoosh, ImageOptim
- **SVG Optimization**: SVGOMG, svgo
- **Format Conversion**: Cloudinary, Sharp, or online tools

## Notes

- All assets should be optimized before committing
- Keep file sizes reasonable for web performance
- Use descriptive, kebab-case filenames
- Consider using Next.js Image component for automatic optimization
- Document any specific design requirements or brand guidelines

