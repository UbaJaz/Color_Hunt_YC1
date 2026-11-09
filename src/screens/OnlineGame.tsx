import { RoundReveal } from '../components/ui/RoundReveal';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deltaE2000, deltaEToMatchScore, rgbToLab } from '@color-science';
import { useGameState } from '../state/GameStateContext';
import { CaptureScreen } from './CaptureScreen';
import { CalibrationScreen } from './CalibrationScreen';
import { ColorSwatch } from '../components/ui/ColorSwatch';
import { newIdentity, signIntent, signState, verifyIntent, verifyState, type AuthRegistry, type Identity } from '../net/auth';
import { createRoom, hostReduce, REACTIONS, type Intent, type OnlineState } from '../net/host';
import { makeRoomCode, onlineConfigured, openRoom, type RoomConn } from '../net/room';
import type { RGB } from '../types/color';
import { PACKS, type GameSettings } from '../types/game';
import type { Vote } from '../utils/voting';
import { shareResults } from '../utils/shareCard';
import { dailySeed, makeSeed, parseChallenge } from '../utils/challenge';

/** Per-tab (sessionStorage) so two tabs are two players, and a refresh rejoins the same seat. */
interface Session {
  code: string;
  playerId: string;
  name: string;
  isHost: boolean;
  host: OnlineState | null; // the host's authoritative state, so a host refresh keeps the game
  identity: Identity; // signing keypair, so nobody can act as this player
  hostPub?: JsonWebKey; // client: pinned host key
  auth?: AuthRegistry; // host: registered player keys and last-seen seq
}
const KEY = 'colorhunt.online';
export const MAX_RETAKES = 3;
const HEARTBEAT_MS = 5000;
const HOST_TIMEOUT_MS = 15000;
export const loadOnlineSession = (): Session | null => {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return s?.identity ? s : null; // sessions from before signing was added are dropped
  } catch {
    return null;
  }
};
const LAST_KEY = 'colorhunt.online.last';
const REJOIN_MS = 3 * 60 * 60 * 1000;
/** The same device may rejoin its own seat (same signing key) after closing the tab; nobody else holds that key. */
export const loadRejoinOffer = (): Session | null => {
  try {
    const last = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as { session: Session; at: number } | null;
    return last?.session?.identity && Date.now() - last.at < REJOIN_MS ? last.session : null;
  } catch {
    return null;
  }
};
const saveSession = (s: Session | null) => {
  try {
    if (s) {
      sessionStorage.setItem(KEY, JSON.stringify(s));
      localStorage.setItem(LAST_KEY, JSON.stringify({ session: s, at: Date.now() }));
    } else {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(LAST_KEY);
    }
  } catch {
    // storage blocked: rejoin after a refresh may not work
  }
};

const hex = ({ r, g, b }: RGB) => `#${[r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const shell = 'flex h-full w-full flex-col items-center overflow-y-auto bg-neutral-950 p-6 py-10 pb-28 text-white gap-6';
const primary = 'rounded-full bg-pink-600 px-8 py-3 font-bold disabled:opacity-50';

function useRoom(session: Session, onSession: (s: Session) => void) {
  const [state, setState] = useState<OnlineState | null>(session.host);
  const [notFound, setNotFound] = useState(false);
  const [hostGone, setHostGone] = useState(false);
  const lastSeen = useRef(Date.now());
  const stateRef = useRef(state);
  const conn = useRef<RoomConn | null>(null);
  const sess = useRef(session); // latest session, so async callbacks never write back stale auth data
  const queue = useRef<Promise<unknown>>(Promise.resolve()); // keeps verify/sign work in message order
  const seq = useRef(0);

  const persist = useCallback((patch: Partial<Session>) => {
    sess.current = { ...sess.current, ...patch };
    onSession(sess.current);
  }, [onSession]);

  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch(() => {});
  }, []);

  const broadcast = useCallback((s: OnlineState) => enqueue(async () => conn.current?.sendState(await signState(sess.current.identity, s))), [enqueue]);

  const apply = useCallback(
    (from: string, intent: Intent) => {
      if (!stateRef.current) return;
      const next = hostReduce(stateRef.current, from, intent);
      stateRef.current = next;
      setState(next);
      persist({ host: next });
      broadcast(next); // also on no-ops: a repeated JOIN is how a refreshed client asks for a snapshot
    },
    [persist, broadcast]
  );

  const sendIntent = useCallback(
    (intent: Intent) => enqueue(async () => {
      seq.current = Math.max(Date.now(), seq.current + 1); // monotonic across refreshes
      conn.current?.sendIntent(await signIntent(sess.current.identity, sess.current.playerId, seq.current, intent));
    }),
    [enqueue]
  );

  useEffect(() => {
    const c = openRoom(session.code, {
      onIntent: env => {
        if (!session.isHost) return;
        enqueue(async () => {
          const reg = sess.current.auth ?? { keys: {}, seqs: {} };
          const from = await verifyIntent(reg, env);
          if (!from) return;
          persist({ auth: reg });
          apply(from, env.intent);
        });
      },
      onState: msg =>
        enqueue(async () => {
          if (session.isHost || !(await verifyState(msg, sess.current.hostPub ?? null))) return;
          if (!sess.current.hostPub) persist({ hostPub: msg.pub });
          lastSeen.current = Date.now();
          setHostGone(false);
          stateRef.current = msg.state;
          setState(msg.state);
        }),
    });
    conn.current = c;
    let timer: ReturnType<typeof setInterval> | undefined;
    let tries = 0;
    // Heartbeat: the host rebroadcasts every 5s; clients that hear nothing for 15s show a banner.
    const beat = setInterval(() => {
      if (session.isHost) {
        if (stateRef.current) broadcast(stateRef.current);
      } else if (stateRef.current && Date.now() - lastSeen.current > HOST_TIMEOUT_MS) setHostGone(true);
    }, HEARTBEAT_MS);
    if (!session.isHost) {
      const hello = () => {
        if (stateRef.current) return clearInterval(timer);
        if (++tries > 4) {
          setNotFound(true);
          return clearInterval(timer);
        }
        sendIntent({ type: 'JOIN', name: session.name });
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
    (intent: Intent) => (session.isHost ? apply(session.playerId, intent) : sendIntent(intent)),
    [session.isHost, session.playerId, apply, sendIntent]
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

/** Emoji buttons plus the latest reactions. Sending is throttled to one a second so the room is not flooded. */
function ReactionBar({ state, send }: { state: OnlineState; send: (i: Intent) => void }) {
  const last = useRef(0);
  const nameOf = (id: string) => state.players.find(p => p.id === id)?.name ?? 'Spectator';
  const react = (emoji: string) => {
    if (Date.now() - last.current < 1000) return;
    last.current = Date.now();
    send({ type: 'REACT', emoji });
  };
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-1 bg-black/70 px-3 py-2 backdrop-blur-sm" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <p aria-live="polite" className="h-4 max-w-full truncate text-xs text-neutral-300">
        {(state.reactions ?? []).slice(-4).map(r => `${nameOf(r.from)} ${r.emoji}`).join('   ')}
      </p>
      <div className="flex gap-2">
        {REACTIONS.map(e => (
          <button key={e} onClick={() => react(e)} aria-label={`React ${e}`} className="rounded-full bg-white/10 px-3 py-1 text-xl active:scale-90">{e}</button>
        ))}
      </div>
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
      {room.state && ['voting', 'leaderboard', 'final'].includes(room.state.phase) && (room.state.players.some(p => p.id === session.playerId) || room.state.spectators?.some(w => w.id === session.playerId)) && <ReactionBar state={room.state} send={room.send} />}
    </div>
  );
}

function RoomView({ session, onLeave, room: { state, send, notFound } }: { session: Session; onLeave: () => void; room: ReturnType<typeof useRoom> }) {
  const { state: local } = useGameState();
  const [calDone, setCalDone] = useState(false);
  const [pending, setPending] = useState<{ round: number; rgb: RGB } | null>(null); // a confirmed capture awaiting Submit or Retake
  const [retakes, setRetakes] = useState({ round: 0, n: 0 });
  const [settings, setSettings] = useState<GameSettings>(() => parseChallenge(window.location.search) ?? { roundCount: 3, difficulty: 'medium', useRandomColor: false, memoryMode: false });
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
  if (!state.players.some(p => p.id === me) && state.spectators?.some(w => w.id === me)) {
    const watchRound = state.rounds[state.rounds.length - 1];
    const watchName = (id: string) => state.players.find(p => p.id === id)?.name ?? '?';
    return (
      <div className={shell}>
        <p className="rounded-full bg-white/10 px-4 py-1 text-xs uppercase tracking-wide text-neutral-300">Spectating room {state.code}</p>
        {state.phase === 'lobby' && <p className="text-neutral-400">Waiting for the game to start…</p>}
        {watchRound && (state.phase === 'playing' || state.phase === 'voting') && (
          <>
            <p className="text-neutral-400">Round {watchRound.roundNumber} · {state.phase === 'playing' ? 'players are hunting' : 'players are voting'}</p>
            <ColorSwatch hex={watchRound.targetColor.hex} label="Target" sublabel={watchRound.targetColor.name} />
            {watchRound.theme && <p className="text-sm text-yellow-300">{watchRound.theme}</p>}
          </>
        )}
        {watchRound && state.phase === 'leaderboard' && <RoundReveal target={watchRound.targetColor} results={watchRound.results} nameOf={watchName} />}
        <Standings state={state} />
        <button onClick={onLeave} className="text-sm text-neutral-400 underline">Leave</button>
      </div>
    );
  }
  if (!state.players.some(p => p.id === me)) {
    return (
      <div className={`${shell} justify-center`}>
        <p>This room is full.</p>
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
    const toggle = (label: string, key: 'memoryMode' | 'useRandomColor' | 'themes') => (
      <label className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm">
        {label}
        <input type="checkbox" checked={!!settings[key]} onChange={e => setSettings({ ...settings, [key]: e.target.checked })} />
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
              {toggle('Theme prompts', 'themes')}
              <div className="flex gap-2">
                {PACKS.map(p => (
                  <button key={p} onClick={() => setSettings({ ...settings, pack: p })} className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize ${(settings.pack ?? 'all') === p ? 'bg-pink-600' : 'bg-white/10'}`}>{p}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSettings({ ...settings, seed: dailySeed(), roundCount: 3 })} className="flex-1 rounded-lg bg-white/10 py-2 text-xs font-semibold">Today's daily</button>
                <button onClick={() => setSettings({ ...settings, seed: makeSeed() })} className="flex-1 rounded-lg bg-white/10 py-2 text-xs font-semibold">Challenge seed</button>
                {settings.seed && <button onClick={() => setSettings({ ...settings, seed: undefined })} className="rounded-lg bg-white/10 px-3 py-2 text-xs">Clear</button>}
              </div>
              {settings.seed && <p className="text-center text-xs text-yellow-300">Challenge {settings.seed}: the same colours for everyone with this seed</p>}
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
    const retakesUsed = retakes.round === round.roundNumber ? retakes.n : 0;
    if (pending?.round === round.roundNumber) {
      const score = Math.round(deltaEToMatchScore(deltaE2000(rgbToLab(pending.rgb), rgbToLab(round.targetColor.rgb))));
      const left = MAX_RETAKES - retakesUsed;
      return (
        <div className={`${shell} justify-center text-center`}>
          <p className="text-sm uppercase tracking-wide text-neutral-400">Round {round.roundNumber}</p>
          <div className="flex gap-6">
            <ColorSwatch hex={round.targetColor.hex} label="Target" />
            <ColorSwatch hex={hex(pending.rgb)} label="You" />
          </div>
          <p className="text-2xl font-bold">Score {score}</p>
          <button onClick={() => send({ type: 'SUBMIT', extractedRgb: pending.rgb })} className={primary}>Submit</button>
          <button
            disabled={left <= 0}
            onClick={() => { setPending(null); setRetakes({ round: round.roundNumber, n: retakesUsed + 1 }); }}
            className="text-sm text-neutral-300 underline disabled:opacity-40"
          >
            Retake ({left} left)
          </button>
        </div>
      );
    }
    return (
      <CaptureScreen
        key={`${round.roundNumber}-${retakesUsed}`}
        onRoundResultReady={() => {}}
        online={{
          targetColor: round.targetColor,
          roundNumber: round.roundNumber,
          theme: round.theme,
          playerName: nameOf(me),
          memoryMode: !!state.settings?.memoryMode,
          onSubmit: rgb => (rgb ? setPending({ round: round.roundNumber, rgb }) : send({ type: 'SUBMIT', extractedRgb: null })),
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
        <RoundReveal target={round.targetColor} results={round.results} nameOf={nameOf} />
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
      <button onClick={() => void shareResults(state.players, state.settings?.roundCount ?? 0)} className="text-sm text-neutral-300 underline">Share results</button>
      {isHost ? <button onClick={() => send({ type: 'AGAIN' })} className={primary}>Play again</button> : <p className="text-neutral-400">Waiting for the host…</p>}
      <button onClick={onLeave} className="text-sm text-neutral-400 underline">Leave</button>
    </div>
  );
}

export function OnlineGame({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<Session | null>(loadOnlineSession);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const [rejoin] = useState(() => (loadOnlineSession() ? null : loadRejoinOffer()));
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
  const create = async () => {
    const playerId = crypto.randomUUID();
    const room = makeRoomCode();
    update({ code: room, playerId, name: trimmed, isHost: true, host: createRoom(room, playerId, trimmed), identity: await newIdentity() });
  };
  const join = async () => update({ code: code.trim().toUpperCase(), playerId: crypto.randomUUID(), name: trimmed, isHost: false, host: null, identity: await newIdentity() });

  return (
    <div className={`${shell} justify-center`}>
      <h1 className="text-3xl font-bold">Play online</h1>
      {!onlineConfigured ? (
        <p className="max-w-xs text-center text-neutral-400">Online play is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).</p>
      ) : (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="Your name" aria-label="Your name" className="rounded-lg bg-black px-4 py-2 outline-none focus:ring-2 focus:ring-pink-500" />
          {rejoin && (
            <button onClick={() => update(rejoin)} className="rounded-full border border-yellow-400/60 px-6 py-2 text-sm font-semibold text-yellow-300">
              Rejoin room {rejoin.code} as {rejoin.name}
            </button>
          )}
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
