#!/usr/bin/env tsx

/**
 * Database Setup and Verification Script
 * 
 * This script:
 * 1. Tests Supabase connection
 * 2. Checks if required tables exist
 * 3. Optionally creates the schema
 * 4. Optionally inserts initial demo data
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REQUIRED_TABLES = [
  'current_stream',
  'mux_items',
  'messages',
  'polls',
  'poll_options',
  'poll_votes',
  'chat_throttle',
  'admin_actions',
];

async function main() {
  console.log('🔍 After Party - Database Setup Tool\n');

  // Step 1: Check environment variables
  console.log('📋 Step 1: Checking environment variables...');
  
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set in .env.local');
    process.exit(1);
  }
  
  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
    console.log('   This is required for database setup operations.');
    process.exit(1);
  }

  console.log('✅ Environment variables found');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Service Key: ${supabaseServiceKey.substring(0, 20)}...\n`);

  // Step 2: Test connection
  console.log('📋 Step 2: Testing database connection...');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  try {
    const { error } = await supabase.from('current_stream').select('count', { count: 'exact', head: true });
    
    if (error && error.message.includes('relation "current_stream" does not exist')) {
      console.log('⚠️  Connection successful, but tables do not exist yet\n');
    } else if (error) {
      console.error('❌ Database error:', error.message);
      process.exit(1);
    } else {
      console.log('✅ Database connection successful\n');
    }
  } catch (error: any) {
    console.error('❌ Failed to connect:', error.message);
    process.exit(1);
  }

  // Step 3: Check which tables exist
  console.log('📋 Step 3: Checking for existing tables...');
  
  const existingTables: string[] = [];
  const missingTables: string[] = [];

  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      
      if (error && error.message.includes('does not exist')) {
        missingTables.push(table);
        console.log(`   ❌ ${table} - not found`);
      } else if (error) {
        console.log(`   ⚠️  ${table} - error: ${error.message}`);
        missingTables.push(table);
      } else {
        existingTables.push(table);
        console.log(`   ✅ ${table} - exists`);
      }
    } catch (error: any) {
      missingTables.push(table);
      console.log(`   ❌ ${table} - error: ${error.message}`);
    }
  }

  console.log('');

  // Step 4: Offer to create schema if needed
  if (missingTables.length > 0) {
    console.log('📋 Step 4: Setting up missing tables...');
    console.log(`   Missing ${missingTables.length} table(s): ${missingTables.join(', ')}`);
    console.log('');
    console.log('🔧 To set up your database:');
    console.log('   1. Go to https://app.supabase.com');
    console.log('   2. Select your project');
    console.log('   3. Go to SQL Editor');
    console.log('   4. Copy and paste the contents of sql/schema.sql');
    console.log('   5. Click "Run" to execute');
    console.log('');
    console.log('   Alternatively, you can run the SQL manually:');
    console.log('   cat sql/schema.sql | pbcopy  # Copies to clipboard on macOS');
    console.log('');
  } else {
    console.log('📋 Step 4: All required tables exist! ✅\n');
  }

  // Step 5: Check current_stream data
  if (existingTables.includes('current_stream')) {
    console.log('📋 Step 5: Checking current_stream data...');
    
    const { data, error } = await supabase
      .from('current_stream')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.log(`   ⚠️  Error querying current_stream: ${error.message}`);
    } else if (!data) {
      console.log('   ⚠️  No stream configured\n');
      console.log('🔧 To add a demo stream, run this SQL in Supabase SQL Editor:');
      console.log('');
      console.log(`   INSERT INTO current_stream (id, playback_id, title, kind)
   VALUES (1, 'demo-playback-id', 'Welcome Stream', 'vod')
   ON CONFLICT (id) DO UPDATE 
   SET playback_id = EXCLUDED.playback_id,
       title = EXCLUDED.title,
       kind = EXCLUDED.kind;`);
      console.log('');
    } else {
      console.log('   ✅ Current stream found:');
      console.log(`      Title: ${data.title}`);
      console.log(`      Playback ID: ${data.playback_id}`);
      console.log(`      Kind: ${data.kind}\n`);
    }
  }

  // Step 6: Check Realtime status
  console.log('📋 Step 6: Realtime configuration');
  console.log('   To enable real-time updates:');
  console.log('   1. Go to https://app.supabase.com');
  console.log('   2. Select your project');
  console.log('   3. Go to Database → Replication');
  console.log('   4. Enable Realtime for these tables:');
  console.log('      - messages: INSERT, UPDATE');
  console.log('      - current_stream: UPDATE');
  console.log('      - polls: INSERT, UPDATE');
  console.log('      - poll_votes: INSERT, UPDATE, DELETE');
  console.log('');

  // Summary
  console.log('📊 Setup Summary:');
  console.log(`   ✅ Tables found: ${existingTables.length}/${REQUIRED_TABLES.length}`);
  console.log(`   ${missingTables.length === 0 ? '✅' : '❌'} Schema setup: ${missingTables.length === 0 ? 'Complete' : 'Incomplete'}`);
  
  if (missingTables.length === 0) {
    console.log('\n✨ Your database is ready to use!');
    console.log('   Next steps:');
    console.log('   1. Configure Mux credentials in .env.local');
    console.log('   2. Add some videos via the admin panel');
    console.log('   3. Start streaming! 🎉');
  } else {
    console.log('\n⚠️  Setup incomplete. Please run the schema SQL as described above.');
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

