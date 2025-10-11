import Mux from '@mux/mux-node';

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

export default mux;

export interface PlaybackTokenOptions {
  type?: 'video' | 'thumbnail' | 'storyboard';
  expiration?: string;
  params?: Record<string, any>;
}

export function generatePlaybackToken(
  playbackId: string,
  options: PlaybackTokenOptions = {}
): string {
  const {
    type = 'video',
    expiration = '1h',
    params = {},
  } = options;

  // This function will be properly implemented once Mux credentials are configured
  // For now, return a placeholder to avoid runtime errors during development
  if (!process.env.MUX_SIGNING_KEY_ID || process.env.MUX_SIGNING_KEY_ID.includes('placeholder')) {
    return 'placeholder-token';
  }

  // The actual implementation for when real credentials are available
  // @ts-ignore - Mux SDK type definitions may vary by version
  const token = Mux.JWT?.signPlaybackId?.(playbackId, {
    keyId: process.env.MUX_SIGNING_KEY_ID!,
    keySecret: process.env.MUX_SIGNING_KEY_PRIVATE!,
    expiration,
    type,
    params,
  }) || 'placeholder-token';

  return token;
}

export async function getMuxAsset(assetId: string) {
  const asset = await mux.video.assets.retrieve(assetId);
  return asset;
}

export async function listMuxAssets() {
  const assets = await mux.video.assets.list({ limit: 100 });
  return assets;
}

