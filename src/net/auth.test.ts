// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRoom, promoteHost, successors, type OnlineState } from './host';
import { acceptState, newIdentity, signIntent, signState, verifyIntent, verifyState, type AuthRegistry, type Identity } from './auth';

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

describe('host migration', () => {
  /** A room of host h plus players a and b, with everyone's public key stored in the state. */
  async function room() {
    const ids: Record<string, Identity> = { h: await newIdentity(), a: await newIdentity(), b: await newIdentity() };
    let state: OnlineState = createRoom('ABCD', 'h', 'Host', ids.h.pub);
    state = { ...state, players: [...state.players, { id: 'a', name: 'Ann', totalScore: 0 }, { id: 'b', name: 'Bob', totalScore: 0 }], keys: { h: ids.h.pub, a: ids.a.pub, b: ids.b.pub } };
    return { ids, state };
  }

  it('lists successors in join order and bumps the epoch when someone takes over', async () => {
    const { state } = await room();
    expect(successors(state)).toEqual(['a', 'b']);
    const next = promoteHost(state, 'a');
    expect(next).toMatchObject({ hostId: 'a', epoch: 1 });
    expect(successors(next)).toEqual(['h', 'b']);
  });

  it('accepts a successor signed with the key stored in the state', async () => {
    const { ids, state } = await room();
    const msg = await signState(ids.a, promoteHost(state, 'a'));
    expect(await acceptState(msg, state, ids.h.pub)).toBe('migrated');
  });

  it('rejects outsiders, forged claims and rollbacks', async () => {
    const { ids, state } = await room();
    const outsider = await newIdentity();
    expect(await acceptState(await signState(outsider, promoteHost(state, 'a')), state, ids.h.pub)).toBe(false); // right id, wrong key
    expect(await acceptState(await signState(outsider, { ...state, hostId: 'ghost', epoch: 1 }), state, ids.h.pub)).toBe(false); // not a member
    expect(await acceptState(await signState(ids.a, { ...state, hostId: 'h', epoch: 1 }), state, ids.h.pub)).toBe(false); // claiming the host we already trust, with another key
    const moved = promoteHost(state, 'a');
    expect(await acceptState(await signState(ids.h, state), moved, ids.a.pub)).toBe(false); // the old host cannot roll the room back
    expect(await acceptState(await signState(ids.a, { ...moved, epoch: 0 }), moved, ids.a.pub)).toBe(false); // same host, older epoch
  });

  it('keeps taking snapshots from the pinned host and the first host a joiner meets', async () => {
    const { ids, state } = await room();
    expect(await acceptState(await signState(ids.h, state), state, ids.h.pub)).toBe('pinned');
    expect(await acceptState(await signState(ids.h, state), null, null)).toBe('pinned');
  });

  it('resolves two simultaneous takeovers in favour of the earlier-joined player', async () => {
    const { ids, state } = await room();
    const byA = promoteHost(state, 'a');
    const byB = promoteHost(state, 'b');
    // Someone who followed b first still switches to a (same epoch, a joined earlier)...
    expect(await acceptState(await signState(ids.a, byA), byB, ids.b.pub)).toBe('migrated');
    // ...but someone who followed a does not switch to b.
    expect(await acceptState(await signState(ids.b, byB), byA, ids.a.pub)).toBe(false);
  });
});
