import { deltaE2000, deltaEToMatchScore, rgbToLab } from '@color-science';
import type { RGB } from '../types/color';
import type { GameSettings, Player, Round, RoundResult } from '../types/game';
import { getDynamicTargetColor, getRandomTargetColor } from '../data/targetColors';
import { seededRng } from '../utils/challenge';
import { finalizeResults, type Ballots, type Vote } from '../utils/voting';

export type Phase = 'lobby' | 'playing' | 'voting' | 'leaderboard' | 'final';

/** Full room state. The host owns it and rebroadcasts snapshots; clients only render it. */
export interface OnlineState {
  code: string;
  hostId: string;
  phase: Phase;
  players: Player[];
  settings: GameSettings | null;
  rounds: Round[];
  ballots: Ballots;
}

/** What a client may ask for. Scores are never sent: the host derives them from the colour. */
export type Intent =
  | { type: 'JOIN'; name: string }
  | { type: 'START'; settings: GameSettings }
  | { type: 'SUBMIT'; extractedRgb: RGB | null }
  | { type: 'VOTES'; votes: Record<string, Vote> }
  | { type: 'FORCE' }
  | { type: 'NEXT' }
  | { type: 'AGAIN' };

export const MAX_PLAYERS = 8;

export function createRoom(code: string, hostId: string, hostName: string): OnlineState {
  return {
    code,
    hostId,
    phase: 'lobby',
    players: [{ id: hostId, name: hostName.trim().slice(0, 20), totalScore: 0 }],
    settings: null,
    rounds: [],
    ballots: {},
  };
}

export type PickTarget = (settings: GameSettings, excludeId: string | undefined, roundNumber: number) => Round['targetColor'];
const defaultPick: PickTarget = (s, ex, n) => {
  const rng = s.seed ? seededRng(s.seed, n) : undefined;
  return s.useRandomColor ? getDynamicTargetColor(s.difficulty, rng) : getRandomTargetColor(ex, rng);
};

const validByte = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 255;
const validRgb = (c: RGB | null): c is RGB => !!c && validByte(c.r) && validByte(c.g) && validByte(c.b);

function newRound(state: OnlineState, pick: PickTarget): Round {
  const prev = state.rounds[state.rounds.length - 1];
  const roundNumber = state.rounds.length + 1;
  return { roundNumber, targetColor: pick(state.settings!, prev?.targetColor.id, roundNumber), results: [], currentPlayerIndex: 0 };
}

function scoreResult(playerId: string, rgb: RGB | null, target: RGB): RoundResult {
  const base = { playerId, region: null, confidence: null, bonusVotes: null, finalScore: null };
  if (!rgb) return { ...base, extractedRgb: null, deltaE: null, score: 0 };
  const deltaE = deltaE2000(rgbToLab(rgb), rgbToLab(target));
  return { ...base, extractedRgb: rgb, deltaE, score: deltaEToMatchScore(deltaE) };
}

/** Totals are always rebuilt from the per-round final scores, so a replayed or duplicated message can't double count. */
export function recomputeTotals(players: Player[], rounds: Round[]): Player[] {
  return players.map(p => ({
    ...p,
    totalScore: rounds.reduce((sum, r) => sum + (r.results.find(x => x.playerId === p.id)?.finalScore ?? 0), 0),
  }));
}

function finishVoting(state: OnlineState): OnlineState {
  const rounds = state.rounds.slice();
  const last = rounds[rounds.length - 1];
  rounds[rounds.length - 1] = { ...last, results: finalizeResults(last.results, state.ballots) };
  return { ...state, rounds, players: recomputeTotals(state.players, rounds), phase: 'leaderboard' };
}

/** All submitted -> vote (or straight to the leaderboard when playing solo). */
function afterAllSubmitted(state: OnlineState): OnlineState {
  const last = state.rounds[state.rounds.length - 1];
  if (!state.players.every(p => last.results.some(r => r.playerId === p.id))) return state;
  return state.players.length < 2 ? finishVoting({ ...state, phase: 'voting' }) : { ...state, phase: 'voting', ballots: {} };
}

export function hostReduce(state: OnlineState, from: string, intent: Intent, pick: PickTarget = defaultPick): OnlineState {
  const isHost = from === state.hostId;
  const isPlayer = state.players.some(p => p.id === from);
  const last = state.rounds[state.rounds.length - 1];

  switch (intent.type) {
    case 'JOIN': {
      const name = String(intent.name ?? '').trim().slice(0, 20);
      if (isPlayer || state.phase !== 'lobby' || !name || state.players.length >= MAX_PLAYERS) return state;
      const taken = state.players.some(p => p.name.toLowerCase() === name.toLowerCase());
      return { ...state, players: [...state.players, { id: from, name: taken ? `${name} 2` : name, totalScore: 0 }] };
    }
    case 'START': {
      if (!isHost || state.phase !== 'lobby') return state;
      const s = intent.settings;
      const settings: GameSettings = { roundCount: Math.min(Math.max(Math.floor(s.roundCount) || 3, 1), 10), difficulty: s.difficulty, useRandomColor: !!s.useRandomColor, memoryMode: !!s.memoryMode, seed: typeof s.seed === "string" && /^[a-z0-9]{1,12}$/i.test(s.seed) ? s.seed : undefined };
      const next = { ...state, settings, rounds: [] as Round[], ballots: {}, phase: 'playing' as Phase };
      return { ...next, rounds: [newRound(next, pick)] };
    }
    case 'SUBMIT': {
      if (state.phase !== 'playing' || !isPlayer || last.results.some(r => r.playerId === from)) return state;
      const rgb = validRgb(intent.extractedRgb) ? intent.extractedRgb : null;
      const rounds = state.rounds.slice();
      rounds[rounds.length - 1] = { ...last, results: [...last.results, scoreResult(from, rgb, last.targetColor.rgb)] };
      return afterAllSubmitted({ ...state, rounds });
    }
    case 'VOTES': {
      if (state.phase !== 'voting' || !isPlayer || state.ballots[from]) return state;
      const votes: Record<string, Vote> = {};
      for (const [owner, v] of Object.entries(intent.votes ?? {})) {
        // never your own object, and only objects that were actually photographed
        if (owner !== from && (v === 'up' || v === 'down') && last.results.some(r => r.playerId === owner && r.extractedRgb)) votes[owner] = v;
      }
      const next = { ...state, ballots: { ...state.ballots, [from]: votes } };
      return state.players.every(p => next.ballots[p.id]) ? finishVoting(next) : next;
    }
    case 'FORCE': {
      // Host skips a stalled player: missing photos score 0, missing ballots count as no vote.
      if (!isHost) return state;
      if (state.phase === 'playing') {
        const missing = state.players.filter(p => !last.results.some(r => r.playerId === p.id));
        const rounds = state.rounds.slice();
        rounds[rounds.length - 1] = { ...last, results: [...last.results, ...missing.map(p => scoreResult(p.id, null, last.targetColor.rgb))] };
        return afterAllSubmitted({ ...state, rounds });
      }
      return state.phase === 'voting' ? finishVoting(state) : state;
    }
    case 'NEXT': {
      if (!isHost || state.phase !== 'leaderboard') return state;
      if (state.rounds.length >= (state.settings?.roundCount ?? 0)) return { ...state, phase: 'final' };
      return { ...state, phase: 'playing', ballots: {}, rounds: [...state.rounds, newRound(state, pick)] };
    }
    case 'AGAIN': {
      if (!isHost || state.phase !== 'final') return state;
      return { ...state, phase: 'lobby', rounds: [], settings: null, ballots: {}, players: state.players.map(p => ({ ...p, totalScore: 0 })) };
    }
    default:
      return state;
  }
}
