# Ethna Font Setup Guide

The Ethna font has been configured for your After Party app!

## Download Required Files

1. **Go to**: https://www.epicpxls.com/items/ethna-font-family
2. **Download** the Ethna font family
3. **Extract** the font files

## Place Font Files Here

✅ **You've already added**: `Ethna.otf`

The font is configured to use your OTF file. This will work great!

### Optional: Convert to Web Fonts (Better Performance)

For better web performance, you can optionally convert the OTF to WOFF2:

1. Go to: https://www.fontsquirrel.com/tools/webfont-generator
2. Upload `Ethna.otf`
3. Select "Optimal" settings
4. Download and replace in this folder

But the OTF works perfectly fine as-is!

## Font Weights Configured

The font has been configured with these weights:
- **Light**: 300 (`font-light`)
- **Regular**: 400 (`font-normal`)
- **Bold**: 700 (`font-bold`)
- **Black**: 900 (`font-black`)

## How to Use

### Default (Already Active!)

Ethna is now the default font for your entire app. It's applied automatically to all text.

### Using Tailwind Classes

```tsx
// Regular weight
<h1 className="font-normal">Hello World</h1>

// Bold
<h1 className="font-bold">Bold Title</h1>

// Light weight
<p className="font-light">Light text</p>

// Black (extra bold)
<h1 className="font-black">Extra Bold</h1>

// Explicitly use Ethna (if you switch default later)
<div className="font-ethna">This uses Ethna</div>
```

### Different Font Sizes

```tsx
// Combine with text size classes
<h1 className="text-5xl font-bold">Large Bold Title</h1>
<h2 className="text-3xl font-normal">Medium Title</h2>
<p className="text-base font-light">Body text</p>
```

## Examples in Your App

### Main Page Title
```tsx
<h1 className="text-5xl font-black text-twitch-purple">
  After Party
</h1>
```

### Buttons
```tsx
<button className="twitch-button font-bold">
  Join Stream
</button>
```

### Body Text
```tsx
<p className="text-lg font-normal">
  Join our exclusive streaming event
</p>
```

## Verify Installation

After placing the font files:

1. **Restart your dev server**:
   ```bash
   npm run dev
   ```

2. **Check browser console** - should see no 404 errors for font files

3. **Inspect element** - font-family should show "Ethna"

4. **Visual check** - text should look like the Ethna typeface

## Troubleshooting

### Font not loading?

1. **Check file names** match exactly:
   - Case-sensitive: `Ethna-Regular.woff2` (capital E, capital R)
   - Must be in `public/assets/fonts/` directory

2. **Check browser console** for 404 errors

3. **Clear browser cache**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

4. **Verify file paths** in `app/globals.css` match your actual files

### Font looks wrong?

- Make sure you downloaded the correct Ethna font family
- Check that font files aren't corrupted
- Try a hard refresh (Cmd+Shift+R)

## Converting Fonts (if needed)

If you only have `.ttf` or `.otf` files:

Use **Font Squirrel Webfont Generator**:
https://www.fontsquirrel.com/tools/webfont-generator

Upload your font and select:
- Format: WOFF2 and WOFF
- Subsetting: No subsetting (or Basic Latin if file size is a concern)

## License

**Important**: Ethna is free for personal use. For commercial use, verify the license with the designer.

- Personal projects: ✅ Free
- Commercial projects: ⚠️ Check license

## Current Configuration

✅ Font declared in `app/globals.css`
✅ Added to Tailwind in `tailwind.config.js`
✅ Set as default sans-serif font
✅ Available via `font-ethna` class

Once you place the font files, your entire app will use Ethna automatically!

