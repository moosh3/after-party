#!/usr/bin/env tsx
/**
 * Test script to verify video sync fixes are working correctly
 * 
 * This script simulates various scenarios that previously caused false restarts
 * and verifies that playback_updated_at only changes when it should.
 * 
 * Usage:
 *   npx tsx scripts/test-sync-fixes.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

async function getCurrentStream() {
  const { data, error } = await supabase
    .from('current_stream')
    .select('*')
    .eq('id', 1)
    .single();
  
  if (error) throw error;
  return data;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test1_NonPlaybackUpdateDoesNotTriggerSync() {
  console.log('\n🧪 Test 1: Non-playback update should NOT change playback_updated_at');
  
  const before = await getCurrentStream();
  const beforePlaybackUpdated = before.playback_updated_at;
  
  // Update a non-playback field (updated_by)
  await supabase
    .from('current_stream')
    .update({ updated_by: 'test-script-' + Date.now() })
    .eq('id', 1);
  
  await sleep(500);
  
  const after = await getCurrentStream();
  const afterPlaybackUpdated = after.playback_updated_at;
  
  const passed = beforePlaybackUpdated === afterPlaybackUpdated;
  
  results.push({
    name: 'Non-playback update does not trigger sync',
    passed,
    message: passed 
      ? '✅ playback_updated_at unchanged (correct!)' 
      : `❌ playback_updated_at changed from ${beforePlaybackUpdated} to ${afterPlaybackUpdated} (bug!)`
  });
  
  return passed;
}

async function test2_PlaybackStateChangeUpdatesTrigger() {
  console.log('\n🧪 Test 2: Playback state change SHOULD change playback_updated_at');
  
  const before = await getCurrentStream();
  const beforePlaybackUpdated = before.playback_updated_at;
  const beforeState = before.playback_state;
  const newState = beforeState === 'playing' ? 'paused' : 'playing';
  
  // Update playback state
  await supabase
    .from('current_stream')
    .update({ playback_state: newState })
    .eq('id', 1);
  
  await sleep(500);
  
  const after = await getCurrentStream();
  const afterPlaybackUpdated = after.playback_updated_at;
  
  const passed = beforePlaybackUpdated !== afterPlaybackUpdated;
  
  results.push({
    name: 'Playback state change triggers sync',
    passed,
    message: passed 
      ? `✅ playback_updated_at changed (correct! ${beforeState} → ${newState})` 
      : `❌ playback_updated_at did NOT change (bug!)`
  });
  
  // Restore original state
  await supabase
    .from('current_stream')
    .update({ playback_state: beforeState })
    .eq('id', 1);
  
  return passed;
}

async function test3_PositionChangeUpdatesTrigger() {
  console.log('\n🧪 Test 3: Position change SHOULD change playback_updated_at');
  
  const before = await getCurrentStream();
  const beforePlaybackUpdated = before.playback_updated_at;
  const beforePosition = before.playback_position;
  const newPosition = beforePosition + 10;
  
  // Update position
  await supabase
    .from('current_stream')
    .update({ playback_position: newPosition })
    .eq('id', 1);
  
  await sleep(500);
  
  const after = await getCurrentStream();
  const afterPlaybackUpdated = after.playback_updated_at;
  
  const passed = beforePlaybackUpdated !== afterPlaybackUpdated;
  
  results.push({
    name: 'Position change triggers sync',
    passed,
    message: passed 
      ? `✅ playback_updated_at changed (correct! ${beforePosition}s → ${newPosition}s)` 
      : `❌ playback_updated_at did NOT change (bug!)`
  });
  
  // Restore original position
  await supabase
    .from('current_stream')
    .update({ playback_position: beforePosition })
    .eq('id', 1);
  
  return passed;
}

async function test4_CommandTrackingWorks() {
  console.log('\n🧪 Test 4: Command tracking columns are working');
  
  const commandId = `test-${Date.now()}`;
  
  await supabase
    .from('current_stream')
    .update({ 
      last_playback_command: 'test_command',
      last_command_id: commandId
    })
    .eq('id', 1);
  
  await sleep(500);
  
  const after = await getCurrentStream();
  
  const passed = after.last_playback_command === 'test_command' && after.last_command_id === commandId;
  
  results.push({
    name: 'Command tracking columns work',
    passed,
    message: passed 
      ? '✅ Command tracking columns updated correctly' 
      : `❌ Command tracking failed (command: ${after.last_playback_command}, id: ${after.last_command_id})`
  });
  
  return passed;
}

async function test5_TriggerPreservesElapsedMs() {
  console.log('\n🧪 Test 5: Trigger preserves elapsed_ms on non-playback updates');
  
  const before = await getCurrentStream();
  const beforeElapsedMs = before.playback_elapsed_ms;
  
  // Update a non-playback field
  await supabase
    .from('current_stream')
    .update({ updated_by: 'test-script-elapsed-' + Date.now() })
    .eq('id', 1);
  
  await sleep(500);
  
  const after = await getCurrentStream();
  const afterElapsedMs = after.playback_elapsed_ms;
  
  const passed = beforeElapsedMs === afterElapsedMs;
  
  results.push({
    name: 'Trigger preserves elapsed_ms on non-playback updates',
    passed,
    message: passed 
      ? '✅ elapsed_ms unchanged (correct!)' 
      : `❌ elapsed_ms changed from ${beforeElapsedMs} to ${afterElapsedMs} (bug!)`
  });
  
  return passed;
}

async function runTests() {
  console.log('🚀 Starting Video Sync Fix Tests\n');
  console.log('📊 Testing against database:', supabaseUrl);
  
  try {
    // Verify connection
    const current = await getCurrentStream();
    console.log('✅ Connected to database');
    console.log(`📺 Current video: ${current.title}`);
    console.log(`▶️  Playback state: ${current.playback_state} at ${current.playback_position}s`);
    
    // Run tests
    await test1_NonPlaybackUpdateDoesNotTriggerSync();
    await test2_PlaybackStateChangeUpdatesTrigger();
    await test3_PositionChangeUpdatesTrigger();
    await test4_CommandTrackingWorks();
    await test5_TriggerPreservesElapsedMs();
    
    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(60));
    
    results.forEach((result, i) => {
      console.log(`\n${i + 1}. ${result.name}`);
      console.log(`   ${result.message}`);
    });
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log('\n' + '='.repeat(60));
    console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
    console.log('='.repeat(60) + '\n');
    
    if (failedTests === 0) {
      console.log('🎉 All tests passed! Video sync fixes are working correctly.');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Please review the migration and code changes.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests();
}

export { runTests };

