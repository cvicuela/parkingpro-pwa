import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { settingsAPI } from '../services/api';

const SetupContext = createContext();

export function SetupProvider({ children }) {
  const { user } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSetup = useCallback(async () => {
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      setNeedsSetup(false);
      setLoading(false);
      return;
    }

    try {
      // Check if setup_completed setting exists
      const result = await settingsAPI.list();
      const settings = result?.data?.data || result?.data || [];
      const settingsMap = {};
      if (Array.isArray(settings)) {
        settings.forEach(s => { settingsMap[s.key] = s.value; });
      }

      // Setup is needed if setup_completed is not true
      // AND business_rnc is empty (meaning they never went through setup)
      const setupCompleted = settingsMap.setup_completed === true || settingsMap.setup_completed === 'true';
      const businessConfigured = settingsMap.business_rnc && settingsMap.business_rnc !== '' && settingsMap.business_rnc !== '""';

      setNeedsSetup(!setupCompleted && !businessConfigured);
    } catch {
      // If we can't check, assume setup is done to avoid blocking
      setNeedsSetup(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  const markSetupComplete = useCallback(() => {
    setNeedsSetup(false);
  }, []);

  return (
    <SetupContext.Provider value={{ needsSetup, loading, markSetupComplete, recheckSetup: checkSetup }}>
      {children}
    </SetupContext.Provider>
  );
}

export function useSetup() {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error('useSetup must be used within SetupProvider');
  return ctx;
}
