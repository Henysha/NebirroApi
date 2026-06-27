import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { setApiKey } from './api';

const STORAGE_KEY = 'nebirro_api_key';

interface ApiKeyContextValue {
  apiKey: string;
  setActiveApiKey: (apiKey: string) => void;
  clearApiKey: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextValue | undefined>(undefined);

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');

  useEffect(() => {
    setApiKey(apiKey);
    if (apiKey) {
      localStorage.setItem(STORAGE_KEY, apiKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [apiKey]);

  const value = useMemo<ApiKeyContextValue>(
    () => ({
      apiKey,
      setActiveApiKey: setApiKeyState,
      clearApiKey: () => setApiKeyState(''),
    }),
    [apiKey],
  );

  return <ApiKeyContext.Provider value={value}>{children}</ApiKeyContext.Provider>;
}

export function useApiKey() {
  const context = useContext(ApiKeyContext);

  if (!context) {
    throw new Error('useApiKey must be used inside ApiKeyProvider');
  }

  return context;
}

export function maskApiKey(apiKey: string) {
  if (!apiKey) {
    return 'No API key selected';
  }

  return `${apiKey.slice(0, 11)}...${apiKey.slice(-4)}`;
}
