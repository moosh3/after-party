// Test Mux token generation
const { generatePlaybackToken } = require('../lib/mux.ts');

const muxTokenId = process.env.MUX_TOKEN_ID;
const muxSigningKeyId = process.env.MUX_SIGNING_KEY_ID;

if (!muxTokenId || !muxSigningKeyId) {
  console.error('❌ Missing Mux credentials in .env.local');
  process.exit(1);
}

if (muxTokenId.includes('placeholder') || muxSigningKeyId.includes('placeholder')) {
  console.log('⚠️  Using placeholder Mux credentials');
  console.log('✅ Test skipped - update .env.local with real credentials to test token generation');
  process.exit(0);
}

async function test() {
  try {
    const testPlaybackId = 'test-playback-id';
    const token = await generatePlaybackToken(testPlaybackId);
    
    if (token && token !== 'placeholder-token' && token !== 'unsigned') {
      console.log('✅ Mux token generation successful!');
      console.log('🎥 Token generated for test playback ID');
    } else if (token === 'unsigned') {
      console.log('⚠️  Token generation using unsigned mode');
      console.log('This only works if your Mux playback policy is set to "public"');
    } else {
      console.log('⚠️  Token generation returned placeholder');
      console.log('Update .env.local with real Mux credentials');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();

