import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Timer } from './Timer';

describe('Timer', () => {
  it('updates its accessible value without becoming a live region', () => {
    const { rerender } = render(<Timer timeRemaining={31} />);

    expect(screen.getByRole('timer')).toHaveAccessibleName('0 minutes 31 seconds remaining');
    expect(screen.getByRole('timer')).not.toHaveAttribute('aria-live');

    rerender(<Timer timeRemaining={30} />);

    expect(screen.getByRole('timer')).toHaveAccessibleName('0 minutes 30 seconds remaining');
    expect(screen.getByRole('timer')).not.toHaveAttribute('aria-live');
    expect(screen.getByText('Time running out!')).toBeInTheDocument();
  });
});
