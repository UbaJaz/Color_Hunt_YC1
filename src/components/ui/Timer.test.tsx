import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Timer } from './Timer';

describe('Timer', () => {
  it('starts from the shared deadline instead of a fresh duration when remounted', () => {
    const { unmount } = render(<Timer durationSeconds={60} deadlineAt={Date.now() + 20_000} onExpire={vi.fn()} />);
    expect(screen.getByText(/00:(19|20)/)).toBeTruthy();
    unmount();
    render(<Timer durationSeconds={60} deadlineAt={Date.now() + 20_000} onExpire={vi.fn()} />);
    expect(screen.queryByText('00:60')).toBeNull();
  });

  it('counts the full duration when no deadline is given', () => {
    render(<Timer durationSeconds={45} onExpire={vi.fn()} />);
    expect(screen.getByText('00:45')).toBeTruthy();
  });
});
