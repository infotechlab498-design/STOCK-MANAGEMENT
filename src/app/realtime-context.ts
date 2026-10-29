import { createContext } from 'react';

export type LiveHandler = (payload: unknown) => void;

export interface RealtimeContextValue {
  connected: boolean;
  subscribe: (event: string, handler: LiveHandler) => () => void;
  lastEventAt: string | null;
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);
