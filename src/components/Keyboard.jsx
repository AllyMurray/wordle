import './Keyboard.css';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
];

const Keyboard = ({ onKeyPress, keyboardStatus, disabled = false }) => {
  const handleClick = (key) => {
    if (disabled) return;
    onKeyPress(key);
  };

  return (
    <div className={`keyboard ${disabled ? 'disabled' : ''}`}>
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row">
          {row.map((key) => {
            const status = keyboardStatus[key] || '';
            const isWide = key === 'ENTER' || key === 'BACKSPACE';

            return (
              <button
                key={key}
                className={`key ${status} ${isWide ? 'wide' : ''}`}
                onClick={() => handleClick(key)}
                disabled={disabled}
              >
                {key === 'BACKSPACE' ? '⌫' : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default Keyboard;
