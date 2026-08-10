import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Lobby from './Lobby';

const renderLobby = () => {
  const onJoin = vi.fn();
  render(
    <Lobby
      gameName="Wordle"
      onHost={vi.fn()}
      onJoin={onJoin}
      onPlaySolo={vi.fn()}
      initialJoinCode="ABCDEF-abc123"
    />
  );
  return { onJoin };
};

describe('Lobby join validation', () => {
  it('prevents joining with a malformed PIN', () => {
    const { onJoin } = renderLobby();
    const pinInput = screen.getByLabelText('Enter PIN if required by host');
    const joinButton = screen.getByRole('button', { name: 'Confirm and join game' });

    fireEvent.change(pinInput, { target: { value: '12' } });

    expect(joinButton).toBeDisabled();
    expect(screen.getByText('PIN must be 4-8 digits')).toBeInTheDocument();
    fireEvent.keyDown(pinInput, { key: 'Enter' });
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('allows joining with a valid PIN', () => {
    const { onJoin } = renderLobby();
    const pinInput = screen.getByLabelText('Enter PIN if required by host');
    const joinButton = screen.getByRole('button', { name: 'Confirm and join game' });

    fireEvent.change(pinInput, { target: { value: '1234' } });
    fireEvent.click(joinButton);

    expect(onJoin).toHaveBeenCalledWith('ABCDEF-abc123', '1234');
  });
});
