const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://wevmvkujcclcqymuqddp.supabase.co';
const supabaseAnonKey = 'sb_publishable_1nowxOXHQowRC85ptQ7Hfw_biQZ2r_j';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('perfiles').select('*').limit(1);
  if (error) {
    console.error('Error fetching perfiles:', error);
  } else {
    console.log('First profile record:', data);
  }
}
run();
