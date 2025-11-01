import Mux from '@mux/mux-node';
import { SignJWT, importPKCS8 } from 'jose';

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

export async function generatePlaybackToken(
  playbackId: string,
  options: PlaybackTokenOptions = {}
): Promise<string> {
  const {
    type = 'video',
    expiration = '1h',
    params = {},
  } = options;

  // Check if signing keys are configured
  const hasSigningKeys = process.env.MUX_SIGNING_KEY_ID && 
                         process.env.MUX_SIGNING_KEY_PRIVATE &&
                         !process.env.MUX_SIGNING_KEY_ID.includes('placeholder');

  // If no signing keys, use unsigned playback (only works for public playback policies)
  if (!hasSigningKeys) {
    console.warn('⚠️ Mux signing keys not configured - using unsigned playback');
    console.warn('⚠️ This only works if your Mux playback policy is set to "public"');
    return 'unsigned'; // Special token that tells the player to use unsigned mode
  }

  try {
    // Generate signed token using jose library (already a dependency)
    // Mux uses RS256 with base64-encoded PKCS8 private keys
    if (process.env.MUX_SIGNING_KEY_PRIVATE) {
      const privateKeyPem = Buffer.from(process.env.MUX_SIGNING_KEY_PRIVATE, 'base64').toString('utf8');
      
      const token = await new SignJWT({
        sub: playbackId,
        aud: type,
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour from now
      })
        .setProtectedHeader({ 
          alg: 'RS256',
          kid: process.env.MUX_SIGNING_KEY_ID,
        })
        .sign(await importPKCS8(privateKeyPem, 'RS256'));
      
      return token;
    }

    // If no private key, fall back to unsigned
    console.warn('⚠️ Could not generate signed token, falling back to unsigned playback');
    return 'unsigned';
  } catch (error) {
    console.error('Error generating Mux playback token:', error);
    console.warn('⚠️ Falling back to unsigned playback due to error');
    return 'unsigned';
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

