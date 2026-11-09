import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Intent, OnlineState } from './host';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const onlineConfigured = !!(url && key);

const client = onlineConfigured ? createClient(url!, key!, { realtime: { params: { eventsPerSecond: 10 } } }) : null;

/** No 0/O/1/I so codes survive being read aloud. */
export function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), n => alphabet[n % alphabet.length]).join('');
}

export interface RoomConn {
  sendIntent: (from: string, intent: Intent) => void;
  sendState: (state: OnlineState) => void;
  close: () => void;
}

/** Pure message relay on a Supabase Realtime broadcast channel. No tables; the host device holds the truth. */
export function openRoom(code: string, on: { onIntent: (from: string, intent: Intent) => void; onState: (s: OnlineState) => void }): RoomConn {
  if (!client) throw new Error('Supabase is not configured');
  const channel: RealtimeChannel = client.channel(`room:${code}`, { config: { broadcast: { self: false } } });
  let live = false;
  const queue: (() => void)[] = [];
  const send = (event: string, payload: unknown) => {
    const go = () => void channel.send({ type: 'broadcast', event, payload });
    if (live) go();
    else queue.push(go);
  };
  channel
    .on('broadcast', { event: 'intent' }, ({ payload }) => on.onIntent(payload.from, payload.intent))
    .on('broadcast', { event: 'state' }, ({ payload }) => on.onState(payload))
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        live = true;
        queue.splice(0).forEach(fn => fn());
      }
    });
  return {
    sendIntent: (from, intent) => send('intent', { from, intent }),
    sendState: state => send('state', state),
    close: () => void client.removeChannel(channel),
  };
}
