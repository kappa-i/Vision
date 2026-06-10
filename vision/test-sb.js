import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ekuowxscshqpspgttglb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdW93eHNjc2hxcHNwZ3R0Z2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDkyNjYsImV4cCI6MjA5NjU4NTI2Nn0.Pf1KGOk6n0irspWRsWMVn2hpu7WBm0W7BJZweUpa35c";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('projects').select('id, name, cover_path').limit(5);
  console.log("Error:", error);
  console.log("Projects:", data);
}

test();
