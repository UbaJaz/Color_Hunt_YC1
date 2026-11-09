import { describe, expect, it } from 'vitest';
import { cardRows } from './shareCard';

describe('cardRows', () => {
  it('ranks best first, labels places and caps the list', () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, totalScore: i * 10 }));
    const rows = cardRows(players);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toBe('1st  P7  70');
    expect(rows[3]).toBe('4th  P4  40');
  });
});
