import { describe, it, expect } from 'vitest';
import {
  sanitizeSessionCode,
  isValidSessionCode,
  parseSessionCode,
  sanitizeSessionPin,
  isValidSessionPin,
  validatePeerMessage,
  GAME_CONFIG,
} from './types';

describe('Session Code Functions', () => {
  describe('sanitizeSessionCode', () => {
    it('should pass through valid session codes unchanged', () => {
      expect(sanitizeSessionCode('ABCDEF-a3f2b1')).toBe('ABCDEF-a3f2b1');
    });

    it('should convert lowercase readable part to uppercase', () => {
      expect(sanitizeSessionCode('abcdef-a3f2b1')).toBe('ABCDEF-a3f2b1');
    });

    it('should convert uppercase secret part to lowercase', () => {
      expect(sanitizeSessionCode('ABCDEF-A3F2B1')).toBe('ABCDEF-a3f2b1');
    });

    it('should filter out invalid characters from readable part', () => {
      // 0, O, 1, I are not in SESSION_CODE_CHARS
      expect(sanitizeSessionCode('ABC0EF-a3f2b1')).toBe('ABCEF-a3f2b1');
      expect(sanitizeSessionCode('ABCOEF-a3f2b1')).toBe('ABCEF-a3f2b1');
      expect(sanitizeSessionCode('ABC1EF-a3f2b1')).toBe('ABCEF-a3f2b1');
      expect(sanitizeSessionCode('ABCIEF-a3f2b1')).toBe('ABCEF-a3f2b1');
    });

    it('should filter out invalid characters from secret part', () => {
      // Only hex chars (0-9, a-f) are valid
      expect(sanitizeSessionCode('ABCDEF-a3g2b1')).toBe('ABCDEF-a32b1');
      expect(sanitizeSessionCode('ABCDEF-a3z2b1')).toBe('ABCDEF-a32b1');
    });

    it('should handle input without separator as readable-only', () => {
      expect(sanitizeSessionCode('ABCDEF')).toBe('ABCDEF');
      expect(sanitizeSessionCode('abcdefgh')).toBe('ABCDEF'); // Truncated to 6 chars
    });

    describe('dash character normalization', () => {
      it('should normalize en-dash (U+2013) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2013a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize em-dash (U+2014) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2014a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize figure dash (U+2012) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2012a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize minus sign (U+2212) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2212a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize non-breaking hyphen (U+2011) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2011a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize hyphen (U+2010) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2010a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize horizontal bar (U+2015) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2015a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize small em dash (U+FE58) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\uFE58a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize small hyphen-minus (U+FE63) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\uFE63a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize fullwidth hyphen-minus (U+FF0D) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\uFF0Da3f2b1')).toBe('ABCDEF-a3f2b1');
      });
    });
  });

  describe('isValidSessionCode', () => {
    it('should return true for valid session codes', () => {
      expect(isValidSessionCode('ABCDEF-a3f2b1')).toBe(true);
      expect(isValidSessionCode('XYZ234-000000')).toBe(true);
    });

    it('should return false for codes with wrong length', () => {
      expect(isValidSessionCode('ABCDE-a3f2b1')).toBe(false); // 5 + 6
      expect(isValidSessionCode('ABCDEFG-a3f2b1')).toBe(false); // 7 + 6
      expect(isValidSessionCode('ABCDEF-a3f2b')).toBe(false); // 6 + 5
    });

    it('should return false for codes with invalid readable characters', () => {
      expect(isValidSessionCode('ABC0EF-a3f2b1')).toBe(false); // 0 not allowed
      expect(isValidSessionCode('ABCOEF-a3f2b1')).toBe(false); // O not allowed
      expect(isValidSessionCode('ABC1EF-a3f2b1')).toBe(false); // 1 not allowed
      expect(isValidSessionCode('ABCIEF-a3f2b1')).toBe(false); // I not allowed
    });

    it('should return false for codes with invalid secret characters', () => {
      expect(isValidSessionCode('ABCDEF-g3f2b1')).toBe(false); // g not hex
      expect(isValidSessionCode('ABCDEF-A3f2b1')).toBe(false); // uppercase not allowed
    });

    it('should return false for codes without separator', () => {
      expect(isValidSessionCode('ABCDEFa3f2b1')).toBe(false);
    });
  });

  describe('parseSessionCode', () => {
    it('should parse valid session codes', () => {
      expect(parseSessionCode('ABCDEF-a3f2b1')).toEqual({
        readable: 'ABCDEF',
        secret: 'a3f2b1',
      });
    });

    it('should return null for invalid codes', () => {
      expect(parseSessionCode('ABCDEF')).toBeNull();
      expect(parseSessionCode('ABCDEF-')).toBeNull();
      expect(parseSessionCode('-a3f2b1')).toBeNull();
      expect(parseSessionCode('ABC-a3f2b1')).toBeNull();
      expect(parseSessionCode('ABCDEF-a3f')).toBeNull();
    });
  });
});

describe('peer message validation', () => {
  const validBoggleState = {
    type: 'boggle-state',
    revision: 1,
    state: {
      board: {
        grid: [
          ['Qu', 'A', 'T', 'S'],
          ['D', 'O', 'G', 'E'],
          ['R', 'A', 'T', 'S'],
          ['B', 'I', 'R', 'D'],
        ],
        size: 4,
      },
      foundWords: ['QUA'],
      score: 1,
      gameOver: false,
      timeRemaining: 180,
      timedMode: true,
    },
    _messageId: 'state-1',
  };

  it('accepts bounded messages and their reliability identifier', () => {
    expect(validatePeerMessage(validBoggleState).success).toBe(true);
    expect(
      validatePeerMessage({ type: 'suggest-word', word: 'CRANE', _messageId: 'suggestion-1' })
        .success
    ).toBe(true);
    expect(
      validatePeerMessage({
        type: 'boggle-word-result',
        word: 'QUA',
        accepted: false,
        reason: 'Already found',
      }).success
    ).toBe(true);
  });

  it('rejects malformed Wordle state shapes', () => {
    expect(
      validatePeerMessage({
        type: 'game-state',
        revision: 1,
        state: {
          guesses: [{ word: 'TOO-LONG', status: ['correct'] }],
          currentGuess: '12345',
          gameOver: false,
          won: false,
          message: '',
        },
      }).success
    ).toBe(false);
  });

  it('rejects arbitrary Boggle board dimensions and tiles', () => {
    expect(
      validatePeerMessage({
        ...validBoggleState,
        state: {
          ...validBoggleState.state,
          board: { grid: [['NOT-A-TILE']], size: 1 },
        },
      }).success
    ).toBe(false);
  });

  it('rejects oversized arrays and strings', () => {
    expect(
      validatePeerMessage({
        ...validBoggleState,
        state: {
          ...validBoggleState.state,
          foundWords: Array(5_001).fill('CAT'),
        },
      }).success
    ).toBe(false);
    expect(validatePeerMessage({ type: 'suggest-word', word: 'A'.repeat(10_000) }).success).toBe(
      false
    );
  });

  it('rejects unexpected fields', () => {
    expect(
      validatePeerMessage({ type: 'request-state', unexpected: 'payload' }).success
    ).toBe(false);
  });
});

describe('Session PIN Functions', () => {
  describe('sanitizeSessionPin', () => {
    it('should pass through valid PINs unchanged', () => {
      expect(sanitizeSessionPin('1234')).toBe('1234');
      expect(sanitizeSessionPin('12345678')).toBe('12345678');
    });

    it('should remove non-numeric characters', () => {
      expect(sanitizeSessionPin('12a34')).toBe('1234');
      expect(sanitizeSessionPin('1-2-3-4')).toBe('1234');
    });

    it('should truncate to max length', () => {
      expect(sanitizeSessionPin('123456789')).toBe('12345678');
    });
  });

  describe('isValidSessionPin', () => {
    it('should return true for empty PIN (no authentication)', () => {
      expect(isValidSessionPin('')).toBe(true);
    });

    it('should return true for valid PINs', () => {
      expect(isValidSessionPin('1234')).toBe(true);
      expect(isValidSessionPin('12345678')).toBe(true);
    });

    it('should return false for PINs shorter than minimum', () => {
      expect(isValidSessionPin('123')).toBe(false);
    });

    it('should return false for PINs longer than maximum', () => {
      expect(isValidSessionPin('123456789')).toBe(false);
    });

    it('should return false for PINs with non-numeric characters', () => {
      expect(isValidSessionPin('12a4')).toBe(false);
    });
  });
});

describe('GAME_CONFIG constants', () => {
  it('should have correct session code configuration', () => {
    expect(GAME_CONFIG.SESSION_CODE_LENGTH).toBe(6);
    expect(GAME_CONFIG.PEER_SECRET_LENGTH).toBe(6);
    expect(GAME_CONFIG.FULL_SESSION_CODE_LENGTH).toBe(13); // 6 + 1 + 6
    expect(GAME_CONFIG.SESSION_CODE_SEPARATOR).toBe('-');
  });

  it('should have SESSION_CODE_CHARS without ambiguous characters', () => {
    expect(GAME_CONFIG.SESSION_CODE_CHARS).not.toContain('0');
    expect(GAME_CONFIG.SESSION_CODE_CHARS).not.toContain('O');
    expect(GAME_CONFIG.SESSION_CODE_CHARS).not.toContain('1');
    expect(GAME_CONFIG.SESSION_CODE_CHARS).not.toContain('I');
  });
});
