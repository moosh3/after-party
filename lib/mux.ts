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

  // SECURITY: Fail fast if credentials are not configured properly
  // In production, we must have secure tokens - no fallbacks
  if (!process.env.MUX_SIGNING_KEY_ID || process.env.MUX_SIGNING_KEY_ID.includes('placeholder')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MUX_SIGNING_KEY_ID not configured - cannot generate secure tokens in production');
    }
    console.warn('⚠️ Using placeholder Mux token in development mode');
    return 'placeholder-token';
  }

  if (!process.env.MUX_SIGNING_KEY_PRIVATE) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MUX_SIGNING_KEY_PRIVATE not configured - cannot generate secure tokens in production');
    }
    console.warn('⚠️ Missing MUX_SIGNING_KEY_PRIVATE in development mode');
    return 'placeholder-token';
  }

  try {
    // Generate signed token using Mux SDK
    // @ts-ignore - Mux SDK type definitions may vary by version
    const token = Mux.JWT?.signPlaybackId?.(playbackId, {
      keyId: process.env.MUX_SIGNING_KEY_ID,
      keySecret: process.env.MUX_SIGNING_KEY_PRIVATE,
      expiration,
      type,
      params,
    });

    // Validate that we actually got a token
    if (!token || token === 'placeholder-token') {
      throw new Error('Failed to generate Mux token - received invalid token from SDK');
    }

    return token;
  } catch (error) {
    console.error('Error generating Mux playback token:', error);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Failed to generate secure playback token');
    }
    // In development, return placeholder but log the error
    console.warn('⚠️ Returning placeholder token due to error in development mode');
    return 'placeholder-token';
  }
}

export async function getMuxAsset(assetId: string) {
  const asset = await mux.video.assets.retrieve(assetId);
  return asset;
}

export async function listMuxAssets() {
  const assets = await mux.video.assets.list({ limit: 100 });
  return assets;
}

