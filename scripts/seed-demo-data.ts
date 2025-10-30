#!/usr/bin/env tsx

/**
 * Seed demo data into the database
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('🌱 Seeding demo data...\n');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // Insert demo stream
  console.log('📺 Adding demo stream to current_stream...');
  const { data: streamData, error: streamError } = await supabase
    .from('current_stream')
    .upsert({
      id: 1,
      playback_id: 'qxb01i6T202018GFS02vp9RIe01icTcDCjVzQpmaB00CUisJ4',
      title: 'Big Buck Bunny - Demo Video',
      kind: 'vod',
      updated_at: new Date().toISOString(),
      updated_by: 'setup-script'
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (streamError) {
    console.error('   ❌ Failed:', streamError.message);
  } else {
    console.log('   ✅ Demo stream added');
    console.log(`      Title: ${streamData.title}`);
    console.log(`      Playback ID: ${streamData.playback_id}`);
  }

  // Add demo mux item
  console.log('\n🎬 Adding demo video to mux_items...');
  const { error: muxError } = await supabase
    .from('mux_items')
    .upsert({
      playback_id: 'qxb01i6T202018GFS02vp9RIe01icTcDCjVzQpmaB00CUisJ4',
      kind: 'vod',
      label: 'Big Buck Bunny (Demo)',
      duration_seconds: 596
    }, {
      onConflict: 'playback_id'
    });

  if (muxError) {
    console.error('   ❌ Failed:', muxError.message);
  } else {
    console.log('   ✅ Demo video added to catalog');
  }

  console.log('\n✨ Demo data seeded successfully!');
  console.log('\n📝 Next steps:');
  console.log('   1. Enable Realtime for the tables (see SETUP.md)');
  console.log('   2. Restart your dev server: npm run dev');
  console.log('   3. Visit http://localhost:3000/event');
  console.log('   4. You should see Big Buck Bunny playing! 🎉');
}

main().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});

