import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameState } from '../state/GameStateContext';
import { CaptureScreen } from './CaptureScreen';
import { CalibrationScreen } from './CalibrationScreen';
import { ColorSwatch } from '../components/ui/ColorSwatch';
import { createRoom, hostReduce, type Intent, type OnlineState } from '../net/host';
import { makeRoomCode, onlineConfigured, openRoom, type RoomConn } from '../net/room';
import type { RGB } from '../types/color';
import type { GameSettings } from '../types/game';
import type { Vote } from '../utils/voting';

/** Per-tab (sessionStorage) so two tabs are two players, and a refresh rejoins the same seat. */
interface Session {
  code: string;
  playerId: string;
  name: string;
  isHost: boolean;
  host: OnlineState | null; // the host's authoritative state, so a host refresh keeps the game
}
const KEY = 'colorhunt.online';
const HEARTBEAT_MS = 5000;
const HOST_TIMEOUT_MS = 15000;
export const loadOnlineSession = (): Session | null => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
};
const saveSession = (s: Session | null) => (s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY));

const hex = ({ r, g, b }: RGB) => `#${[r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const shell = 'flex h-full w-full flex-col items-center overflow-y-auto bg-neutral-950 p-6 py-10 text-white gap-6';
const primary = 'rounded-full bg-pink-600 px-8 py-3 font-bold disabled:opacity-50';

function useRoom(session: Session, onSession: (s: Session) => void) {
  const [state, setState] = useState<OnlineState | null>(session.host);
  const [notFound, setNotFound] = useState(false);
  const [hostGone, setHostGone] = useState(false);
  const lastSeen = useRef(Date.now());
  const stateRef = useRef(state);
  const conn = useRef<RoomConn | null>(null);

  const apply = useCallback(
    (from: string, intent: Intent) => {
      if (!stateRef.current) return;
      const next = hostReduce(stateRef.current, from, intent);
      stateRef.current = next;
      setState(next);
      onSession({ ...session, host: next });
      conn.current?.sendState(next); // also on no-ops: a repeated JOIN is how a refreshed client asks for a snapshot
    },
    [session, onSession]
  );

  useEffect(() => {
    const c = openRoom(session.code, {
      onIntent: (from, intent) => session.isHost && apply(from, intent),
      onState: s => {
        if (session.isHost) return;
        lastSeen.current = Date.now();
        setHostGone(false);
        stateRef.current = s;
        setState(s);
      },
    });
    conn.current = c;
    let timer: ReturnType<typeof setInterval> | undefined;
    let tries = 0;
    // Heartbeat: the host rebroadcasts every 5s; clients that hear nothing for 15s show a banner.
    const beat = setInterval(() => {
      if (session.isHost) {
        if (stateRef.current) c.sendState(stateRef.current);
      } else if (stateRef.current && Date.now() - lastSeen.current > HOST_TIMEOUT_MS) setHostGone(true);
    }, HEARTBEAT_MS);
    if (!session.isHost) {
      const hello = () => {
        if (stateRef.current) return clearInterval(timer);
        if (++tries > 4) {
          setNotFound(true);
          return clearInterval(timer);
        }
        c.sendIntent(session.playerId, { type: 'JOIN', name: session.name });
      };
      hello();
      timer = setInterval(hello, 2000);
    }
    return () => {
      clearInterval(timer);
      clearInterval(beat);
      c.close();
      conn.current = null;
    };
    // one connection per mounted room
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.code]);

  const send = useCallback(
    (intent: Intent) => (session.isHost ? apply(session.playerId, intent) : conn.current?.sendIntent(session.playerId, intent)),
    [session, apply]
  );
  return { state, send, notFound, hostGone };
}

function Standings({ state }: { state: OnlineState }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {[...state.players].sort((a, b) => b.totalScore - a.totalScore).map((p, i) => (
        <div key={p.id} className="flex items-center justify-between rounded-xl bg-white/10 p-4">
          <span className="font-bold">{i + 1}. {p.name}</span>
          <span className="font-bold text-yellow-400">{p.totalScore}</span>
        </div>
      ))}
    </div>
  );
}

function Room({ session, onSession, onLeave }: { session: Session; onSession: (s: Session) => void; onLeave: () => void }) {
  const room = useRoom(session, onSession);
  return (
    <div className="relative h-full w-full">
      {room.hostGone && (
        <div role="alert" className="absolute inset-x-0 top-0 z-50 bg-red-600 p-2 text-center text-sm font-semibold text-white">
          Host disconnected. Waiting for them to come back…{' '}
          <button onClick={onLeave} className="underline">Leave</button>
        </div>
      )}
      <RoomView session={session} onLeave={onLeave} room={room} />
    </div>
  );
}

function RoomView({ session, onLeave, room: { state, send, notFound } }: { session: Session; onLeave: () => void; room: ReturnType<typeof useRoom> }) {
  const { state: local } = useGameState();
  const [calDone, setCalDone] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({ roundCount: 3, difficulty: 'medium', useRandomColor: false, memoryMode: false });
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const me = session.playerId;

  if (!state) {
    return (
      <div className={`${shell} justify-center`}>
        <p>{notFound ? `No room ${session.code} found. Check the code, and that the host is still online.` : `Joining ${session.code}…`}</p>
        <button onClick={onLeave} className="text-sm text-neutral-400 underline">Back</button>
      </div>
    );
  }
  if (!state.players.some(p => p.id === me)) {
    return (
      <div className={`${shell} justify-center`}>
        <p>This room is full or already playing.</p>
        <button onClick={onLeave} className="text-sm text-neutral-400 underline">Back</button>
      </div>
    );
  }

  const isHost = me === state.hostId;
  const round = state.rounds[state.rounds.length - 1];
  const mine = round?.results.find(r => r.playerId === me);
  const nameOf = (id: string) => state.players.find(p => p.id === id)?.name ?? '?';
  const skip = isHost && (
    <button onClick={() => send({ type: 'FORCE' })} className="text-sm text-neutral-400 underline">Continue without waiting</button>
  );

  if (state.phase === 'lobby') {
    const toggle = (label: string, key: 'memoryMode' | 'useRandomColor') => (
      <label className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm">
        {label}
        <input type="checkbox" checked={settings[key]} onChange={e => setSettings({ ...settings, [key]: e.target.checked })} />
      </label>
    );
    return (
      <div className={shell}>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Room code</p>
        <h1 className="font-mono text-5xl font-bold tracking-widest">{state.code}</h1>
        <ul className="flex w-full max-w-sm flex-col gap-2">
          {state.players.map(p => <li key={p.id} className="rounded-lg bg-white/10 px-4 py-2">{p.name}{p.id === state.hostId && ' (host)'}</li>)}
        </ul>
        {isHost ? (
          <>
            <div className="flex w-full max-w-sm flex-col gap-2">
              <div className="flex gap-2">
                {[3, 5, 7].map(n => (
                  <button key={n} onClick={() => setSettings({ ...settings, roundCount: n })} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${settings.roundCount === n ? 'bg-pink-600' : 'bg-white/10'}`}>{n} rounds</button>
                ))}
              </div>
              {toggle('Random colours', 'useRandomColor')}
              {toggle('Memory mode', 'memoryMode')}
            </div>
            <button onClick={() => send({ type: 'START', settings })} className={primary}>Start game</button>
          </>
        ) : (
          <p className="text-neutral-400">Waiting for the host to start…</p>
        )}
        <button onClick={onLeave} className="text-sm text-neutral-400 underline">Leave</button>
      </div>
    );
  }

  if (state.phase === 'playing') {
    if (mine) {
      const done = round.results.length;
      return (
        <div className={`${shell} justify-center text-center`}>
          <p className="text-sm uppercase tracking-wide text-neutral-400">Round {round.roundNumber}</p>
          <p className="text-2xl font-bold">You scored {Math.round(mine.score ?? 0)}</p>
          <p className="text-neutral-400">Waiting for the others ({done}/{state.players.length})…</p>
          {skip}
        </div>
      );
    }
    if (!calDone && !local.calibrationMatrix) return <CalibrationScreen onCalibrationComplete={() => setCalDone(true)} />;
    return (
      <CaptureScreen
        key={round.roundNumber}
        onRoundResultReady={() => {}}
        online={{
          targetColor: round.targetColor,
          roundNumber: round.roundNumber,
          playerName: nameOf(me),
          memoryMode: !!state.settings?.memoryMode,
          onSubmit: rgb => send({ type: 'SUBMIT', extractedRgb: rgb }),
        }}
      />
    );
  }

  if (state.phase === 'voting') {
    if (state.ballots[me]) {
      return (
        <div className={`${shell} justify-center text-center`}>
          <p className="text-neutral-400">Waiting for the other votes ({Object.keys(state.ballots).length}/{state.players.length})…</p>
          {skip}
        </div>
      );
    }
    const targets = round.results.filter(r => r.playerId !== me && r.extractedRgb);
    return (
      <div className={shell}>
        <h1 className="text-2xl font-bold">Cast your votes</h1>
        <p className="max-w-sm text-center text-sm text-neutral-400">Is each object a "most unlikely item"? Skipping counts as no vote.</p>
        {targets.map(r => (
          <div key={r.playerId} className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white/10 p-4">
            <h2 className="text-lg font-semibold">{nameOf(r.playerId)}'s Object</h2>
            <ColorSwatch hex={hex(r.extractedRgb!)} label="Extracted" />
            <div className="flex gap-4">
              {(['up', 'down'] as const).map(v => (
                <button key={v} onClick={() => setVotes({ ...votes, [r.playerId]: v })} className={`rounded-full px-6 py-2 font-bold ${votes[r.playerId] === v ? (v === 'up' ? 'bg-green-500' : 'bg-red-500') : 'bg-neutral-800 text-neutral-400'}`}>
                  {v === 'up' ? '👍 Unlikely' : '👎 Common'}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={() => send({ type: 'VOTES', votes })} className={primary}>Submit votes</button>
      </div>
    );
  }

  if (state.phase === 'leaderboard') {
    return (
      <div className={shell}>
        <h1 className="text-3xl font-bold text-yellow-400">Round {round.roundNumber} results</h1>
        <div className="flex w-full max-w-sm flex-col gap-3">
          {[...round.results].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)).map(r => (
            <div key={r.playerId} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
              <span className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-lg bg-neutral-800" style={r.extractedRgb ? { background: hex(r.extractedRgb) } : undefined} />
                {nameOf(r.playerId)}
              </span>
              <span className="font-bold text-pink-400">{r.finalScore}</span>
            </div>
          ))}
        </div>
        <h2 className="text-sm uppercase tracking-wider text-neutral-400">Total score</h2>
        <Standings state={state} />
        {isHost ? (
          <button onClick={() => { setVotes({}); send({ type: 'NEXT' }); }} className={primary}>
            {state.rounds.length >= (state.settings?.roundCount ?? 0) ? 'Final results' : 'Start next round'}
          </button>
        ) : (
          <p className="text-neutral-400">Waiting for the host…</p>
        )}
      </div>
    );
  }

  return (
    <div className={`${shell} justify-center`}>
      <p className="text-5xl">🏆</p>
      <h1 className="text-3xl font-bold text-yellow-400">Game Over!</h1>
      <Standings state={state} />
      {isHost ? <button onClick={() => send({ type: 'AGAIN' })} className={primary}>Play again</button> : <p className="text-neutral-400">Waiting for the host…</p>}
      <button onClick={onLeave} className="text-sm text-neutral-400 underline">Leave</button>
    </div>
  );
}

export function OnlineGame({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<Session | null>(loadOnlineSession);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const update = useCallback((s: Session) => {
    saveSession(s);
    setSession(s);
  }, []);
  const leave = () => {
    saveSession(null);
    setSession(null);
  };

  if (session) return <Room session={session} onSession={update} onLeave={leave} />;

  const trimmed = name.trim();
  const create = () => {
    const playerId = crypto.randomUUID();
    const room = makeRoomCode();
    update({ code: room, playerId, name: trimmed, isHost: true, host: createRoom(room, playerId, trimmed) });
  };
  const join = () => update({ code: code.trim().toUpperCase(), playerId: crypto.randomUUID(), name: trimmed, isHost: false, host: null });

  return (
    <div className={`${shell} justify-center`}>
      <h1 className="text-3xl font-bold">Play online</h1>
      {!onlineConfigured ? (
        <p className="max-w-xs text-center text-neutral-400">Online play is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).</p>
      ) : (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="Your name" aria-label="Your name" className="rounded-lg bg-black px-4 py-2 outline-none focus:ring-2 focus:ring-pink-500" />
          <button onClick={create} disabled={!trimmed} className={primary}>Create room</button>
          <div className="flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value)} maxLength={4} placeholder="CODE" aria-label="Room code" className="w-28 rounded-lg bg-black px-4 py-2 text-center font-mono uppercase outline-none focus:ring-2 focus:ring-pink-500" />
            <button onClick={join} disabled={!trimmed || code.trim().length !== 4} className={`${primary} flex-1`}>Join room</button>
          </div>
        </div>
      )}
      <button onClick={onExit} className="text-sm text-neutral-400 underline">Back to pass-and-play</button>
    </div>
  );
}
