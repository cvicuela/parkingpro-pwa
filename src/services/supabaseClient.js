import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEPLOYMENT_MODE = import.meta.env.VITE_DEPLOYMENT_MODE || 'remote';
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// ── Supabase client (only created when credentials exist) ──
let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else if (DEPLOYMENT_MODE !== 'local') {
  console.warn('[ParkingPro] Supabase credentials not set. RPC calls will route through REST API.');
}

export { supabase };

/**
 * Helper to call RPC functions.
 *
 * - In remote/hybrid mode with Supabase credentials: calls Supabase .rpc()
 * - In local mode (or when Supabase is unavailable): calls the Express
 *   backend at POST /api/v1/rpc/:functionName, which executes the same
 *   PostgreSQL function locally.
 *
 * This makes api.js work identically in all deployment modes without
 * any changes to its code.
 */
export async function rpc(fnName, params = {}) {
  // If Supabase client is available and we're not in local mode, use it
  if (supabase && DEPLOYMENT_MODE !== 'local') {
    const { data, error } = await supabase.rpc(fnName, params);
    if (error) throw new Error(error.message);
    return data;
  }

  // Fallback: call the Express backend RPC proxy endpoint
  const token = localStorage.getItem('pp_token') || '';
  const response = await fetch(`${API_URL}/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `RPC ${fnName} failed with status ${response.status}`);
  }

  const data = await response.json();
  return data;
}
