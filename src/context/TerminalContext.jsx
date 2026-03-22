import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

const TerminalContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const getToken = () => localStorage.getItem('pp_token') || '';

export function TerminalProvider({ children }) {
  const { user } = useAuth();
  const [terminal, setTerminal] = useState(() => {
    const saved = localStorage.getItem('pp_terminal');
    return saved ? JSON.parse(saved) : null;
  });
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTerminals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/terminals`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Error fetching terminals');
      const json = await res.json();
      setTerminals(json.data || []);
    } catch {
      setTerminals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // React to auth state changes: fetch terminals on login, clear on logout
  useEffect(() => {
    if (user) {
      // User just logged in — fetch available terminals
      fetchTerminals();
      // Re-read localStorage in case it was cleared on logout
      const saved = localStorage.getItem('pp_terminal');
      setTerminal(saved ? JSON.parse(saved) : null);
    } else {
      // User logged out — clear everything
      setTerminal(null);
      setTerminals([]);
      setLoading(false);
    }
  }, [user, fetchTerminals]);

  const selectTerminal = useCallback((t) => {
    setTerminal(t);
    localStorage.setItem('pp_terminal', JSON.stringify(t));
    toast.success(`Terminal: ${t.name}`);
  }, []);

  const clearTerminal = useCallback(() => {
    setTerminal(null);
    localStorage.removeItem('pp_terminal');
  }, []);

  // Heartbeat every 2 minutes (skip for "Sin Terminal" placeholder)
  useEffect(() => {
    if (!terminal || !terminal.id) return;
    const sendHeartbeat = async () => {
      try {
        await fetch(`${API_BASE}/api/v1/terminals/${terminal.code}/heartbeat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
        });
      } catch {}
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 120000);
    return () => clearInterval(interval);
  }, [terminal]);

  return (
    <TerminalContext.Provider value={{ terminal, terminals, loading, selectTerminal, clearTerminal, fetchTerminals }}>
      {children}
    </TerminalContext.Provider>
  );
}

export const useTerminal = () => useContext(TerminalContext);
