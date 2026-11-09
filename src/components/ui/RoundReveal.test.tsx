import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoundReveal } from './RoundReveal';
import { makeResult } from '../../test/helpers';

const target = (id: string, hex: string, rgb: { r: number; g: number; b: number }) => ({ id, name: id, hex, rgb, difficulty: 'easy' as const });

describe('RoundReveal', () => {
  it('shows both targets and both picks for a two-colour round, with the bonuses that applied', () => {
    const result = {
      ...makeResult('a', 90),
      finalScore: 98,
      streak: 3,
      deltaE: 1,
      pair: [
        { extractedRgb: { r: 255, g: 0, b: 0 }, deltaE: 1, score: 90 },
        { extractedRgb: { r: 0, g: 0, b: 255 }, deltaE: 1, score: 90 },
      ],
    };
    render(<RoundReveal target={target('warm', '#FF0000', { r: 255, g: 0, b: 0 })} target2={target('cool', '#0000FF', { r: 0, g: 0, b: 255 })} results={[result]} nameOf={() => 'Ann'} />);
    expect(screen.getByLabelText('Target warm #FF0000')).toBeTruthy();
    expect(screen.getByLabelText('Target cool #0000FF')).toBeTruthy();
    expect(screen.getAllByLabelText(/Ann picked/)).toHaveLength(2);
    expect(screen.getByText(/Streak x3 \+5/)).toBeTruthy();
    expect(screen.getByText(/Spot on \+5/)).toBeTruthy();
  });
});
