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
const AUTH_STORAGE_KEYS = ['pp_token', 'pp_user', 'pp_terminal', 'pp_settings'];
const PUBLIC_RPC_FNS = new Set(['authenticate', 'register_user']);

function getJwtExpMs(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Missing token => treat as expired. Unreadable exp => NOT expired (let the server decide,
// so a malformed/opaque token never causes a false logout).
export function isTokenExpired(token = localStorage.getItem('pp_token')) {
  if (!token) return true;
  const expMs = getJwtExpMs(token);
  if (expMs === null) return false;
  return Date.now() >= expMs;
}

let _sessionExpiring = false;
// Clear auth state and bounce to the login screen (guarded against redirect loops).
export function expireSession() {
  if (_sessionExpiring) return;
  _sessionExpiring = true;
  try {
    AUTH_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/acceso')) {
    window.location.replace('/acceso?expired=1');
  }
}

export async function rpc(fnName, params = {}) {
  // Auto-logout on an expired session: if the JWT is expired, don't fire a doomed request
  // that would just return "No autorizado" on every page — clear state and go to login.
  // Expiry is read from the JWT's own exp claim, so a VALID token that hits a permission
  // error is NOT logged out.
  if (!PUBLIC_RPC_FNS.has(fnName) && isTokenExpired()) {
    expireSession();
    throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  }

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
