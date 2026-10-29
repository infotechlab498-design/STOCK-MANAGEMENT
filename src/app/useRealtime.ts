import { useContext } from 'react';
import { RealtimeContext, type RealtimeContextValue } from './realtime-context';

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
