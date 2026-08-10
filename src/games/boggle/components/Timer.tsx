import { memo } from 'react';
import './Timer.css';

interface TimerProps {
  timeRemaining: number;
  lowTimeThreshold?: number;
}

export const Timer = memo(function Timer({
  timeRemaining,
  lowTimeThreshold = 30,
}: TimerProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isLow = timeRemaining <= lowTimeThreshold && timeRemaining > 0;

  return (
    <div
      className={`timer ${isLow ? 'timer--low' : ''}`}
      role="timer"
      aria-label={`${minutes} minutes ${seconds} seconds remaining`}
    >
      <span className="timer__display">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
      {isLow && <span className="timer__warning">Time running out!</span>}
    </div>
  );
});
