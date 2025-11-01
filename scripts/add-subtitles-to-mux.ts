/**
 * Helper script to add subtitle tracks to Mux VOD assets
 * 
 * Usage:
 *   npx tsx scripts/add-subtitles-to-mux.ts <asset-id> <subtitle-url> [language-code] [name]
 * 
 * Examples:
 *   npx tsx scripts/add-subtitles-to-mux.ts xAuUQlV5XNVAA02eLuzqoeSBWtA026GWIqsjQGFKs7XDs https://alecandmk.stream/assets/captions/scream1.srt en English
 *   npx tsx scripts/add-subtitles-to-mux.ts asset-123 https://example.com/spanish.srt es Spanish
 */

import { addSubtitleTrack, listAssetTracks } from '../lib/mux';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/add-subtitles-to-mux.ts <asset-id> <subtitle-url> [language-code] [name]\n');
    console.log('Examples:');
    console.log('  npx tsx scripts/add-subtitles-to-mux.ts asset-123 https://example.com/english.srt en English');
    console.log('  npx tsx scripts/add-subtitles-to-mux.ts asset-123 https://example.com/spanish.srt es Spanish\n');
    process.exit(1);
  }

  const [assetId, url, languageCode = 'en', name = 'English'] = args;

  console.log('\n📋 Adding subtitle track to Mux asset...');
  console.log(`   Asset ID: ${assetId}`);
  console.log(`   Subtitle URL: ${url}`);
  console.log(`   Language: ${languageCode} (${name})\n`);

  try {
    // Add the subtitle track
    const track = await addSubtitleTrack(assetId, {
      url,
      languageCode,
      name,
      closedCaptions: true,
    });

    console.log('\n✅ Subtitle track added successfully!');
    console.log(`   Track ID: ${track.id}`);
    console.log(`   Status: ${track.status}\n`);

    // List all tracks for this asset
    console.log('📋 All tracks for this asset:');
    const tracks = await listAssetTracks(assetId);
    tracks.forEach((t: any, index: number) => {
      console.log(`   ${index + 1}. ${t.type} - ${t.name || t.id} (${t.status})`);
    });
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

main();

