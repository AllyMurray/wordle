import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoggleLoadingState } from './BoggleLoadingState';

describe('BoggleLoadingState', () => {
  it('shows a viewer connection failure instead of an indefinite loading message', () => {
    render(
      <BoggleLoadingState
        isMultiplayerViewer
        connectionStatus="error"
        errorMessage="Game not found. Check the code and try again."
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Game not found');
    expect(screen.queryByText('Loading dictionary...')).not.toBeInTheDocument();
  });

  it('retains dictionary loading feedback for local games', () => {
    render(
      <BoggleLoadingState
        isMultiplayerViewer={false}
        connectionStatus="disconnected"
        errorMessage=""
      />
    );

    expect(screen.getByText('Loading dictionary...')).toBeInTheDocument();
  });
});
