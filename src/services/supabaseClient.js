import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ppxjjsfacbepctslyrma.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBweGpqc2ZhY2JlcGN0c2x5cm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDk0MjMsImV4cCI6MjA4ODM4NTQyM30.Syjn_qe1K63ecpsm1vbnHqPcWOsKTVG1niar_yqW9kg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to call RPC functions
export async function rpc(fnName, params = {}) {
  const { data, error } = await supabase.rpc(fnName, params);
  if (error) throw new Error(error.message);
  return data;
}
