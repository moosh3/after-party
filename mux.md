# Mux Subtitle/Caption Management

## Quick Start

### Using the Helper Script (Easiest)

```bash
# Add subtitles to a Mux asset
npx tsx scripts/add-subtitles-to-mux.ts <asset-id> <subtitle-url> [language-code] [name]

# Example with your hosted files
npx tsx scripts/add-subtitles-to-mux.ts \
  xaL02xydZHBOev02pk02Ssy1003Q5vAJ02kuXeT99b4Cy019U \
  https://alecandmk.stream/assets/captions/scream.srt \
  en \
  "English"
```

### Using TypeScript/JavaScript

```typescript
import { addSubtitleTrack, deleteSubtitleTrack, listAssetTracks } from '@/lib/mux';

// Add a subtitle track
await addSubtitleTrack('asset-id', {
  url: 'https://example.com/subtitles/english.srt',
  languageCode: 'en',
  name: 'English',
  closedCaptions: true
});

// List all tracks for an asset
const tracks = await listAssetTracks('asset-id');

// Delete a subtitle track
await deleteSubtitleTrack('asset-id', 'track-id');
```

## Direct API Access (curl)

### Add Subtitle Track

```bash
curl -X POST "https://api.mux.com/video/v1/assets/xaL02xydZHBOev02pk02Ssy1003Q5vAJ02kuXeT99b4Cy019U/tracks" \
  -u "$MUX_TOKEN_ID:$MUX_TOKEN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://alecandmk.stream/assets/captions/scream.srt",
    "type": "text",
    "text_type": "subtitles",
    "language_code": "en",
    "name": "English",
    "closed_captions": true
  }'
```

### Delete Subtitle Track

```bash
curl -X DELETE \
  "https://api.mux.com/video/v1/assets/CxJmQI5lcP2FnPh2bvpXEl5u5lCyvPaRcTGb16wnLcg/tracks/D6Wy24jeBFlNM0202FeBo401kHjSMBg3hJg9bKUGbwOC01JX51HDweqjmA" \
  -u "$MUX_TOKEN_ID:$MUX_TOKEN_SECRET" \
  -H "Content-Type: application/json"
```

### List All Tracks

```bash
curl "https://api.mux.com/video/v1/assets/{ASSET_ID}" \
  -u "$MUX_TOKEN_ID:$MUX_TOKEN_SECRET" \
  -H "Content-Type: application/json"
```

## Your Subtitle Files

Available subtitle files in this project:
- `beetle.srt` - Beetlejuice
- `corpse.srt` - Corpse Bride
- `iwis.srt` - It's What's Inside
- `little-shop-of-horrors.srt`
- `ready-or-not.srt`
- `scream.srt` - Scream
- `simam.srt` - Sick in My Apartment

## Important Notes

1. **Public URL Required**: The subtitle file must be accessible via a public HTTPS URL
2. **SRT Format**: Mux supports `.srt`, `.vtt`, and other standard subtitle formats
3. **Language Codes**: Use ISO 639-1 codes (e.g., `en`, `es`, `fr`, `de`)
4. **Closed Captions vs Subtitles**: 
   - Closed Captions: Include sound effects and speaker identification
   - Subtitles: Just dialogue translation
5. **Processing Time**: It may take a few seconds for Mux to process the subtitle file
6. **Multiple Languages**: You can add multiple subtitle tracks in different languages

## Track Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Public HTTPS URL to the subtitle file |
| `type` | string | Yes | Must be `"text"` for subtitles |
| `text_type` | string | Yes | `"subtitles"` or `"captions"` |
| `language_code` | string | Yes | ISO 639-1 language code |
| `name` | string | Yes | Display name in player |
| `closed_captions` | boolean | No | Whether this is closed captions |

## Common Language Codes

- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `ja` - Japanese
- `zh` - Chinese
- `ko` - Korean
- `ar` - Arabic

## Troubleshooting

### Track Not Appearing
- Ensure the URL is publicly accessible (test in browser)
- Check that the file is valid SRT format
- Wait 30-60 seconds for Mux to process
- Verify the asset ID is correct

### Invalid URL Error
- URL must use HTTPS (not HTTP)
- URL must not require authentication
- File must be directly accessible (not behind a login)

### Track Status
After adding, track status will be:
- `preparing` - Mux is downloading and processing
- `ready` - Track is ready to use
- `errored` - Something went wrong (check URL and format)

## Example: Batch Add Subtitles

```typescript
// Add subtitles for multiple movies
const movies = [
  { assetId: 'asset-123', file: 'scream.srt', name: 'Scream' },
  { assetId: 'asset-456', file: 'beetle.srt', name: 'Beetlejuice' },
  { assetId: 'asset-789', file: 'corpse.srt', name: 'Corpse Bride' },
];

for (const movie of movies) {
  await addSubtitleTrack(movie.assetId, {
    url: `https://alecandmk.stream/assets/captions/${movie.file}`,
    languageCode: 'en',
    name: 'English',
    closedCaptions: true,
  });
  console.log(`✅ Added subtitles to ${movie.name}`);
}
```
