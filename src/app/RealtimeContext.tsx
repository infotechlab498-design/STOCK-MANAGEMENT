import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { getActiveAuthToken } from '../services/api/apiClient';

type LiveHandler = (payload: unknown) => void;

interface RealtimeContextValue {
  connected: boolean;
  subscribe: (event: string, handler: LiveHandler) => () => void;
  lastEventAt: string | null;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const handlersRef = useRef<Map<string, Set<LiveHandler>>>(new Map());
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const subscribe = useCallback((event: string, handler: LiveHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);
    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const emit = useCallback((event: string, payload: unknown) => {
    setLastEventAt(new Date().toISOString());
    const set = handlersRef.current.get(event);
    if (!set) return;
    set.forEach((handler) => {
      try {
        handler(payload);
      } catch {
        // ignore subscriber errors
      }
    });
  }, []);

  useEffect(() => {
    if (!token || !user) {
      setConnected(false);
      if (connectionRef.current) {
        void connectionRef.current.stop();
        connectionRef.current = null;
      }
      return;
    }

    const hubUrl = `${window.location.origin}/hubs/inventory`;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getActiveAuthToken() || token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();

    connectionRef.current = connection;

    const events = ['notification.created', 'stock.changed', 'document.changed'];
    for (const event of events) {
      connection.on(event, (payload: unknown) => emit(event, payload));
    }

    connection.onreconnected(() => setConnected(true));
    connection.onclose(() => setConnected(false));
    connection.onreconnecting(() => setConnected(false));

    connection
      .start()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));

    return () => {
      void connection.stop();
      connectionRef.current = null;
      setConnected(false);
    };
  }, [token, user?.id, emit]);

  const value = useMemo(
    () => ({ connected, subscribe, lastEventAt }),
    [connected, subscribe, lastEventAt]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    return {
      connected: false,
      subscribe: () => () => undefined,
      lastEventAt: null,
    };
  }
  return ctx;
}
