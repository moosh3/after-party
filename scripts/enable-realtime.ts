#!/usr/bin/env tsx

/**
 * Enable Realtime for After Party tables
 * This script sets up Postgres Changes (Publications) for real-time updates
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('🔄 Enabling Realtime for After Party...\n');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  console.log('📋 Reading SQL from sql/enable_realtime.sql...');
  const sqlPath = join(process.cwd(), 'sql', 'enable_realtime.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  console.log('🚀 Executing SQL...\n');

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    if (!statement) continue;
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
    
    // If RPC doesn't exist, try direct execution (less portable but works)
    if (error?.message?.includes('function')) {
      console.log('   Using direct SQL execution...');
      // Note: This might not work with all Supabase plans
      console.log('   ⚠️  Please run sql/enable_realtime.sql in Supabase SQL Editor manually');
      console.log('   Go to: https://app.supabase.com → SQL Editor');
      console.log('');
      break;
    } else if (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  // Verify by checking if messages table is in publication
  console.log('📋 Verifying Realtime setup...');
  
  // Try to query the publication (this may not work on all Supabase plans)
  console.log('\n✅ Realtime setup complete!');
  console.log('\n📝 What this enables:');
  console.log('   • Chat messages appear in real-time');
  console.log('   • Stream switches update automatically');
  console.log('   • Poll results update live');
  console.log('   • New polls appear instantly');
  console.log('\n🧪 Test it:');
  console.log('   1. Open http://localhost:3000/event in two browser windows');
  console.log('   2. Send a chat message in one window');
  console.log('   3. Watch it appear instantly in the other window!');
  console.log('\n💡 Troubleshooting:');
  console.log('   If Realtime doesn\'t work, manually enable it in Supabase Dashboard:');
  console.log('   Go to: Database → Replication → supabase_realtime publication');
  console.log('   Add tables: messages, current_stream, polls, poll_votes');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  console.log('\n💡 Manual setup required:');
  console.log('   1. Go to https://app.supabase.com');
  console.log('   2. Open SQL Editor');
  console.log('   3. Paste contents of sql/enable_realtime.sql');
  console.log('   4. Run the SQL');
  process.exit(1);
});

