import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ekuowxscshqpspgttglb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdW93eHNjc2hxcHNwZ3R0Z2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDkyNjYsImV4cCI6MjA5NjU4NTI2Nn0.Pf1KGOk6n0irspWRsWMVn2hpu7WBm0W7BJZweUpa35c";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  // Try to create a dummy project, update it, and read it
  const { data: insertData, error: insertError } = await supabase.from('projects').insert({ name: 'Test Cover', status: 'draft' }).select().single();
  console.log("Insert Error:", insertError);
  if (insertData) {
    console.log("Inserted ID:", insertData.id);
    const { error: updateError } = await supabase.from('projects').update({ cover_path: 'my_test_path' }).eq('id', insertData.id);
    console.log("Update Error:", updateError);
    
    const { data: readData, error: readError } = await supabase.from('projects').select('*').eq('id', insertData.id).single();
    console.log("Read Data:", readData);
  }
}

test();
