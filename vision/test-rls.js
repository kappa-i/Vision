import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ekuowxscshqpspgttglb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdW93eHNjc2hxcHNwZ3R0Z2xiIiwiaWF0IjoxNzE2ODk5NjcwLCJleHAiOjIwMzI0NzU2NzB9.mN7gV6w1O8YcZf9v7_q6w6u_2s0m3R2Q3x7O2m4uG8E";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRLS() {
  // We can't query pg_policies directly via REST API usually, but we can try to update a project.
  const { data, error } = await supabase
    .from("projects")
    .update({ cover_path: "test" })
    .eq("id", "123") // fake id
    .select();
  console.log("Update test:", error ? error.message : "Success");
}
checkRLS();
