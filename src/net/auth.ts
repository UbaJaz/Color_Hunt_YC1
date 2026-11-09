import type { Intent, OnlineState } from './host';

/**
 * Broadcast channels deliver every message to every subscriber, so a bare player id proves nothing.
 * Each player owns an ECDSA keypair: the public key is registered by the host on JOIN, and every later
 * intent is signed. The host also signs its state snapshots, and clients pin the first host key they see.
 * Residual risk: whoever answers a joiner's very first snapshot can still be pinned (no server to anchor trust).
 */
export interface Identity {
  pub: JsonWebKey;
  priv: JsonWebKey;
}

export interface Envelope {
  from: string;
  seq: number;
  intent: Intent;
  sig: string;
  /** Only sent with JOIN; the host registers it for that player id. */
  pub?: JsonWebKey;
}

export interface StateMsg {
  state: OnlineState;
  sig: string;
  pub: JsonWebKey;
}

/** Host-side registry: public key and highest accepted seq per player. Persisted with the host session. */
export interface AuthRegistry {
  keys: Record<string, JsonWebKey>;
  seqs: Record<string, number>;
}

export const MAX_ENVELOPE_BYTES = 4096;

const ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const;
const enc = new TextEncoder();

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function newIdentity(): Promise<Identity> {
  const pair = await crypto.subtle.generateKey(ALGO, true, ['sign', 'verify']);
  return { pub: await crypto.subtle.exportKey('jwk', pair.publicKey), priv: await crypto.subtle.exportKey('jwk', pair.privateKey) };
}

async function sign(priv: JsonWebKey, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', priv, ALGO, false, ['sign']);
  return toB64(await crypto.subtle.sign(SIGN, key, enc.encode(payload)));
}

async function verify(pub: JsonWebKey, payload: string, sig: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('jwk', pub, ALGO, false, ['verify']);
    return await crypto.subtle.verify(SIGN, key, fromB64(sig), enc.encode(payload));
  } catch {
    return false; // malformed key or signature
  }
}

const intentPayload = (from: string, seq: number, intent: Intent) => JSON.stringify([from, seq, intent]);

export async function signIntent(id: Identity, from: string, seq: number, intent: Intent): Promise<Envelope> {
  const env: Envelope = { from, seq, intent, sig: await sign(id.priv, intentPayload(from, seq, intent)) };
  if (intent.type === 'JOIN') env.pub = id.pub;
  return env;
}

/** Returns the player id the intent is authentically from, or null. Mutates `reg` only on success. */
export async function verifyIntent(reg: AuthRegistry, env: Envelope): Promise<string | null> {
  if (!env || typeof env.from !== 'string' || typeof env.seq !== 'number' || !env.intent || typeof env.sig !== 'string') return null;
  if (JSON.stringify(env).length > MAX_ENVELOPE_BYTES) return null;
  const key = reg.keys[env.from] ?? (env.intent.type === 'JOIN' ? env.pub : undefined);
  if (!key || !(env.seq > (reg.seqs[env.from] ?? -1))) return null; // unknown player, or a replay
  if (!(await verify(key, intentPayload(env.from, env.seq, env.intent), env.sig))) return null;
  reg.keys[env.from] = key;
  reg.seqs[env.from] = env.seq;
  return env.from;
}

export async function signState(id: Identity, state: OnlineState): Promise<StateMsg> {
  return { state, sig: await sign(id.priv, JSON.stringify(state)), pub: id.pub };
}

/** `pinned` is the host key this client already trusts for the room (null on first contact). */
export async function verifyState(msg: StateMsg, pinned: JsonWebKey | null): Promise<boolean> {
  if (!msg?.state || !msg.pub || typeof msg.sig !== 'string') return false;
  if (pinned && JSON.stringify(pinned) !== JSON.stringify(msg.pub)) return false;
  return verify(msg.pub, JSON.stringify(msg.state), msg.sig);
}
