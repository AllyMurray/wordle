import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionAlert } from './ConnectionAlert';

describe('ConnectionAlert', () => {
  it('announces connection errors', () => {
    render(<ConnectionAlert status="error" message="Creating the game timed out." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Creating the game timed out.');
  });

  it('stays hidden for non-error states', () => {
    render(<ConnectionAlert status="connecting" message="" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
