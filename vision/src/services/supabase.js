import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase centralisé.
 * URL et clé publique anon — sans danger dans le frontend (RLS protège les données).
 */
const SUPABASE_URL = "https://ekuowxscshqpspgttglb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdW93eHNjc2hxcHNwZ3R0Z2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDkyNjYsImV4cCI6MjA5NjU4NTI2Nn0.Pf1KGOk6n0irspWRsWMVn2hpu7WBm0W7BJZweUpa35c";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Helpers courants */
export function sbFrom(table) {
  return supabase.from(table);
}
