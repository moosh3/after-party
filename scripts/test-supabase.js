// Test Supabase connection
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

if (supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder')) {
  console.log('⚠️  Using placeholder Supabase credentials');
  console.log('✅ Test skipped - update .env.local with real credentials to test connection');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    const { data, error } = await supabase.from('current_stream').select('*').limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Supabase connection successful!');
    console.log('📊 Database is accessible');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testConnection();

