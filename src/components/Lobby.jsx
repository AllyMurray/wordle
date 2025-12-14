import { useState } from 'react';
import './Lobby.css';

const Lobby = ({ onHost, onJoin, onPlaySolo }) => {
  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);

  const handleJoin = () => {
    if (joinCode.trim().length === 6) {
      onJoin(joinCode.trim().toUpperCase());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-content">
        <h1 className="lobby-title">Wordle</h1>
        <p className="lobby-subtitle">Play together with a partner</p>

        <div className="lobby-buttons">
          <button className="lobby-btn primary" onClick={onPlaySolo}>
            Play Solo
          </button>

          <button className="lobby-btn host" onClick={onHost}>
            Host Game
          </button>

          {!showJoin ? (
            <button className="lobby-btn join" onClick={() => setShowJoin(true)}>
              Join Game
            </button>
          ) : (
            <div className="join-input-container">
              <input
                type="text"
                className="join-input"
                placeholder="Enter 6-digit code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={handleKeyDown}
                maxLength={6}
                autoFocus
              />
              <div className="join-actions">
                <button
                  className="lobby-btn join-confirm"
                  onClick={handleJoin}
                  disabled={joinCode.length !== 6}
                >
                  Join
                </button>
                <button
                  className="lobby-btn cancel"
                  onClick={() => {
                    setShowJoin(false);
                    setJoinCode('');
                  }}
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
};

export default Lobby;
