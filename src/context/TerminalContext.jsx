import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';
import { terminalsAPI } from '../services/api';

const TerminalContext = createContext(null);

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
      const { data } = await terminalsAPI.list();
      setTerminals(data?.data || []);
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
        await terminalsAPI.heartbeat(terminal.code);
      } catch {}
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 120000);
    return () => clearInterval(interval);
  }, [terminal?.id, terminal?.code]);

  const value = useMemo(() => ({ terminal, terminals, loading, selectTerminal, clearTerminal, fetchTerminals }), [terminal, terminals, loading, selectTerminal, clearTerminal, fetchTerminals]);

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}

export const useTerminal = () => useContext(TerminalContext);
