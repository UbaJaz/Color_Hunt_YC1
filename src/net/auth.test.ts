// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRoom } from './host';
import { newIdentity, signIntent, signState, verifyIntent, verifyState, type AuthRegistry } from './auth';

const reg = (): AuthRegistry => ({ keys: {}, seqs: {} });

describe('signed intents', () => {
  it('registers a player on JOIN and accepts their later signed intents', async () => {
    const r = reg();
    const id = await newIdentity();
    expect(await verifyIntent(r, await signIntent(id, 'a', 1, { type: 'JOIN', name: 'Ann' }))).toBe('a');
    expect(await verifyIntent(r, await signIntent(id, 'a', 2, { type: 'SUBMIT', extractedRgb: null }))).toBe('a');
  });

  it('rejects impersonation: another key cannot act as a registered player', async () => {
    const r = reg();
    await verifyIntent(r, await signIntent(await newIdentity(), 'a', 1, { type: 'JOIN', name: 'Ann' }));
    const evil = await newIdentity();
    expect(await verifyIntent(r, await signIntent(evil, 'a', 2, { type: 'SUBMIT', extractedRgb: null }))).toBeNull();
    expect(await verifyIntent(r, await signIntent(evil, 'a', 3, { type: 'JOIN', name: 'Evil' }))).toBeNull(); // re-JOIN can't swap the key
  });

  it('rejects unknown players, tampered intents and replays', async () => {
    const r = reg();
    const id = await newIdentity();
    expect(await verifyIntent(r, await signIntent(id, 'a', 1, { type: 'SUBMIT', extractedRgb: null }))).toBeNull(); // never joined
    const join = await signIntent(id, 'a', 5, { type: 'JOIN', name: 'Ann' });
    expect(await verifyIntent(r, join)).toBe('a');
    expect(await verifyIntent(r, join)).toBeNull(); // replay
    const sub = await signIntent(id, 'a', 6, { type: 'SUBMIT', extractedRgb: { r: 1, g: 2, b: 3 } });
    expect(await verifyIntent(r, { ...sub, intent: { type: 'SUBMIT', extractedRgb: { r: 255, g: 0, b: 0 } } })).toBeNull();
    expect(await verifyIntent(r, { ...sub, from: 'b' })).toBeNull();
  });
});

describe('signed state', () => {
  it('accepts the host key once pinned and rejects forgeries', async () => {
    const host = await newIdentity();
    const state = createRoom('ABCD', 'h', 'Host');
    const msg = await signState(host, state);
    expect(await verifyState(msg, null)).toBe(true);
    expect(await verifyState(msg, host.pub)).toBe(true);
    const evil = await signState(await newIdentity(), { ...state, phase: 'final' });
    expect(await verifyState(evil, host.pub)).toBe(false);
    expect(await verifyState({ ...msg, state: { ...state, phase: 'final' } }, host.pub)).toBe(false);
  });
});
