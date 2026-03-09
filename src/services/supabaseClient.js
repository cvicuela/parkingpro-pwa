import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to call RPC functions
export async function rpc(fnName, params = {}) {
  const { data, error } = await supabase.rpc(fnName, params);
  if (error) throw new Error(error.message);
  return data;
}
