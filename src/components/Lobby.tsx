import { memo, useState, type KeyboardEvent, type ChangeEvent } from 'react';
import { GAME_CONFIG, sanitizeSessionCode, isValidSessionCode, sanitizeSessionPin, isValidSessionPin, parseSessionCode } from '../types';
import ThemeToggle from './ThemeToggle';
import './Lobby.css';

interface LobbyProps {
  onHost: (pin?: string) => void;
  onJoin: (code: string, pin?: string) => void;
  onPlaySolo: () => void;
  initialJoinCode?: string | null;
}

const Lobby = memo(({ onHost, onJoin, onPlaySolo, initialJoinCode }: LobbyProps) => {
  const [joinCode, setJoinCode] = useState(initialJoinCode || '');
  const [joinPin, setJoinPin] = useState('');
  const [hostPin, setHostPin] = useState('');
  // Show join form if we have an initial join code from URL
  const [showJoin, setShowJoin] = useState(!!initialJoinCode);
  const [showHost, setShowHost] = useState(false);

  const handleJoin = (): void => {
    const sanitizedCode = sanitizeSessionCode(joinCode);
    if (isValidSessionCode(sanitizedCode)) {
      // Pass PIN if provided (empty string means no PIN)
      const sanitizedPin = sanitizeSessionPin(joinPin);
      onJoin(sanitizedCode, sanitizedPin || undefined);
    }
  };

  const handleHostWithPin = (): void => {
    // Pass PIN if provided and valid
    const sanitizedPin = sanitizeSessionPin(hostPin);
    if (sanitizedPin === '' || isValidSessionPin(sanitizedPin)) {
      onHost(sanitizedPin || undefined);
    }
  };

  const handleJoinKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  const handleHostKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleHostWithPin();
    }
  };

  const handleCodeChange = (e: ChangeEvent<HTMLInputElement>): void => {
    // Sanitize input to only allow valid session code characters
    setJoinCode(sanitizeSessionCode(e.target.value));
  };

  const handleJoinPinChange = (e: ChangeEvent<HTMLInputElement>): void => {
    // Sanitize input to only allow numeric characters
    setJoinPin(sanitizeSessionPin(e.target.value));
  };

  const handleHostPinChange = (e: ChangeEvent<HTMLInputElement>): void => {
    // Sanitize input to only allow numeric characters
    setHostPin(sanitizeSessionPin(e.target.value));
  };

  const isHostPinValid = hostPin === '' || isValidSessionPin(hostPin);

  return (
    <div className="lobby" role="main" aria-label="Wordle game lobby">
      <div className="lobby-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="lobby-content">
        <h1 className="lobby-title">Wordle</h1>
        <p className="lobby-subtitle">Play together with a partner</p>

        <div className="lobby-buttons" role="group" aria-label="Game mode selection">
          <button
            className="lobby-btn primary"
            onClick={onPlaySolo}
            aria-label="Play solo game"
          >
            Play Solo
          </button>

          {!showHost ? (
            <button
              className="lobby-btn host"
              onClick={() => setShowHost(true)}
              aria-label="Host a multiplayer game"
            >
              Host Game
            </button>
          ) : (
            <div
              className="join-input-container"
              role="group"
              aria-label="Host game form"
            >
              <label htmlFor="host-pin" className="sr-only">
                Optional: Set a {GAME_CONFIG.SESSION_PIN_MIN_LENGTH}-{GAME_CONFIG.SESSION_PIN_MAX_LENGTH} digit PIN
              </label>
              <input
                id="host-pin"
                type="text"
                inputMode="numeric"
                className="join-input pin-input"
                placeholder={`PIN (optional, ${GAME_CONFIG.SESSION_PIN_MIN_LENGTH}-${GAME_CONFIG.SESSION_PIN_MAX_LENGTH} digits)`}
                value={hostPin}
                onChange={handleHostPinChange}
                onKeyDown={handleHostKeyDown}
                maxLength={GAME_CONFIG.SESSION_PIN_MAX_LENGTH}
                autoFocus
                aria-describedby="host-pin-hint"
              />
              <span id="host-pin-hint" className="sr-only">
                {hostPin.length > 0
                  ? `${hostPin.length} digits entered. ${isHostPinValid ? 'Valid PIN.' : `PIN must be ${GAME_CONFIG.SESSION_PIN_MIN_LENGTH}-${GAME_CONFIG.SESSION_PIN_MAX_LENGTH} digits.`}`
                  : 'Leave empty for no PIN protection.'}
              </span>
              {hostPin.length > 0 && !isHostPinValid && (
                <span className="pin-hint">
                  PIN must be {GAME_CONFIG.SESSION_PIN_MIN_LENGTH}-{GAME_CONFIG.SESSION_PIN_MAX_LENGTH} digits
                </span>
              )}
              <div className="join-actions">
                <button
                  className="lobby-btn join-confirm"
                  onClick={handleHostWithPin}
                  disabled={!isHostPinValid}
                  aria-label={hostPin ? 'Host game with PIN protection' : 'Host game without PIN'}
                >
                  {hostPin ? 'Host with PIN' : 'Host'}
                </button>
                <button
                  className="lobby-btn cancel"
                  onClick={() => {
                    setShowHost(false);
                    setHostPin('');
                  }}
                  aria-label="Cancel hosting game"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showJoin ? (
            <button
              className="lobby-btn join"
              onClick={() => setShowJoin(true)}
              aria-label="Join an existing multiplayer game"
            >
              Join Game
            </button>
          ) : (
            <div
              className="join-input-container"
              role="group"
              aria-label="Join game form"
            >
              <label htmlFor="join-code" className="sr-only">
                Enter {GAME_CONFIG.FULL_SESSION_CODE_LENGTH}-character session code (format: XXXXXX-xxxxxx)
              </label>
              <input
                id="join-code"
                type="text"
                className="join-input"
                placeholder="Code (e.g., ABCDEF-a3f2b1)"
                value={joinCode}
                onChange={handleCodeChange}
                onKeyDown={handleJoinKeyDown}
                maxLength={GAME_CONFIG.FULL_SESSION_CODE_LENGTH}
                autoFocus
                aria-describedby="join-code-hint"
              />
              <span id="join-code-hint" className="sr-only">
                {parseSessionCode(joinCode)
                  ? 'Valid session code format'
                  : `Enter code in format XXXXXX-xxxxxx (${joinCode.length} of ${GAME_CONFIG.FULL_SESSION_CODE_LENGTH} characters)`}
              </span>
              <label htmlFor="join-pin" className="sr-only">
                Enter PIN if required by host
              </label>
              <input
                id="join-pin"
                type="text"
                inputMode="numeric"
                className="join-input pin-input"
                placeholder="PIN (if required)"
                value={joinPin}
                onChange={handleJoinPinChange}
                onKeyDown={handleJoinKeyDown}
                maxLength={GAME_CONFIG.SESSION_PIN_MAX_LENGTH}
                aria-describedby="join-pin-hint"
              />
              <span id="join-pin-hint" className="sr-only">
                {joinPin.length > 0 ? `${joinPin.length} digits entered` : 'Leave empty if no PIN is required'}
              </span>
              <div className="join-actions">
                <button
                  className="lobby-btn join-confirm"
                  onClick={handleJoin}
                  disabled={!isValidSessionCode(joinCode)}
                  aria-label="Confirm and join game"
                >
                  Join
                </button>
                <button
                  className="lobby-btn cancel"
                  onClick={() => {
                    setShowJoin(false);
                    setJoinCode('');
                    setJoinPin('');
                  }}
                  aria-label="Cancel joining game"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

Lobby.displayName = 'Lobby';

export default Lobby;
