import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './useAuth';
import { getActiveAuthToken } from '../services/api/apiClient';
import { RealtimeContext, type LiveHandler } from './realtime-context';

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
      const existing = connectionRef.current;
      connectionRef.current = null;
      if (existing) {
        void existing.stop().catch(() => undefined);
      }
      return;
    }

    let cancelled = false;
    // Relative origin → Vite proxies /hubs to http://127.0.0.1:5080
    const hubUrl = `${window.location.origin}/hubs/inventory`;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getActiveAuthToken() || token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    const events = ['notification.created', 'stock.changed', 'document.changed'];
    for (const event of events) {
      connection.on(event, (payload: unknown) => emit(event, payload));
    }

    connection.onreconnected(() => {
      if (!cancelled) setConnected(true);
    });
    connection.onclose(() => {
      if (!cancelled) setConnected(false);
    });
    connection.onreconnecting(() => {
      if (!cancelled) setConnected(false);
    });

    const startPromise = connection
      .start()
      .then(() => {
        if (!cancelled) setConnected(true);
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      });

    return () => {
      cancelled = true;
      connectionRef.current = null;
      setConnected(false);
      void (async () => {
        try {
          await startPromise;
        } catch {
          // ignore
        }
        try {
          await connection.stop();
        } catch {
          // ignore stop races
        }
      })();
    };
  }, [token, user?.id, emit]);

  const value = useMemo(
    () => ({ connected, subscribe, lastEventAt }),
    [connected, subscribe, lastEventAt]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};
