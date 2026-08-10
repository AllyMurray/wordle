import type { BoggleBoard, Position } from './types';
import { isWord, isPrefix } from './dictionary';
import { getLetter } from './board';

/**
 * Check if two positions are adjacent (including diagonals).
 */
function areAdjacent(p1: Position, p2: Position): boolean {
  const rowDiff = Math.abs(p1.row - p2.row);
  const colDiff = Math.abs(p1.col - p2.col);
  return rowDiff <= 1 && colDiff <= 1 && (rowDiff !== 0 || colDiff !== 0);
}

/**
 * Check if a path is valid (adjacent tiles, no repeats).
 */
export function isValidPath(path: Position[]): boolean {
  if (path.length === 0) return false;

  // Check for duplicate positions
  const seen = new Set<string>();
  for (const pos of path) {
    const key = `${pos.row},${pos.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }

  // Check adjacency between consecutive positions
  for (let i = 1; i < path.length; i++) {
    if (!areAdjacent(path[i - 1]!, path[i]!)) {
      return false;
    }
  }

  return true;
}

/**
 * Get the word formed by a path on the board.
 */
export function getWordFromPath(board: BoggleBoard, path: Position[]): string {
  return path
    .map((pos) => getLetter(board, pos.row, pos.col) ?? '')
    .join('')
    .toUpperCase();
}

/**
 * Validate a word submission:
 * 1. Path is valid (adjacent, no repeats)
 * 2. Word is in dictionary
 * 3. Word is at least 3 characters
 */
export function validateWord(
  board: BoggleBoard,
  path: Position[]
): { valid: boolean; word: string; reason?: string } {
  if (!isValidPath(path)) {
    return { valid: false, word: '', reason: 'Invalid path' };
  }

  const word = getWordFromPath(board, path);

  if (word.length < 3) {
    return { valid: false, word, reason: 'Word must be at least 3 letters' };
  }

  if (!isWord(word)) {
    return { valid: false, word, reason: 'Not in dictionary' };
  }

  return { valid: true, word };
}

/**
 * Find all valid words on the board using DFS with Trie pruning.
 */
export function findAllWords(board: BoggleBoard): string[] {
  const foundWords = new Set<string>();
  const visited: boolean[][] = Array(board.size)
    .fill(null)
    .map(() => Array(board.size).fill(false));

  function dfs(row: number, col: number, currentWord: string): void {
    // Check bounds
    if (row < 0 || row >= board.size || col < 0 || col >= board.size) {
      return;
    }

    // Check if already visited
    if (visited[row]![col]) {
      return;
    }

    // Get letter at position
    const letter = getLetter(board, row, col);
    if (!letter) return;

    const newWord = currentWord + letter.toUpperCase();

    // Prune: if prefix doesn't exist, no point continuing
    if (!isPrefix(newWord)) {
      return;
    }

    // Mark as visited
    visited[row]![col] = true;

    // Check if it's a valid word (3+ letters)
    if (newWord.length >= 3 && isWord(newWord)) {
      foundWords.add(newWord);
    }

    // Explore all 8 neighbors
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        dfs(row + dr, col + dc, newWord);
      }
    }

    // Unmark for backtracking
    visited[row]![col] = false;
  }

  // Start DFS from each cell
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      dfs(row, col, '');
    }
  }

  return Array.from(foundWords).sort();
}

/**
 * Check if a word can be formed on the board (without requiring a specific path).
 * Uses DFS to find any valid path.
 */
export function canFormWord(board: BoggleBoard, word: string): boolean {
  const target = word.toUpperCase();
  const visited: boolean[][] = Array(board.size)
    .fill(null)
    .map(() => Array(board.size).fill(false));

  function dfs(row: number, col: number, index: number): boolean {
    if (index === target.length) {
      return true;
    }

    if (row < 0 || row >= board.size || col < 0 || col >= board.size) {
      return false;
    }

    if (visited[row]![col]) {
      return false;
    }

    const letter = getLetter(board, row, col)?.toUpperCase();
    if (!letter) return false;

    // Handle Qu tile
    if (letter === 'QU') {
      if (target.slice(index, index + 2) !== 'QU') {
        return false;
      }
      visited[row]![col] = true;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (dfs(row + dr, col + dc, index + 2)) {
            visited[row]![col] = false;
            return true;
          }
        }
      }
      visited[row]![col] = false;
      return false;
    }

    if (letter !== target[index]) {
      return false;
    }

    visited[row]![col] = true;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (dfs(row + dr, col + dc, index + 1)) {
          visited[row]![col] = false;
          return true;
        }
      }
    }
    visited[row]![col] = false;
    return false;
  }

  // Try starting from each cell
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (dfs(row, col, 0)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find a valid path for a word on the board.
 * Returns the path if found, null otherwise.
 */
export function findWordPath(board: BoggleBoard, word: string): Position[] | null {
  const target = word.toUpperCase();
  const visited: boolean[][] = Array(board.size)
    .fill(null)
    .map(() => Array(board.size).fill(false));

  function dfs(row: number, col: number, index: number, path: Position[]): Position[] | null {
    if (index === target.length) {
      return path;
    }

    if (row < 0 || row >= board.size || col < 0 || col >= board.size) {
      return null;
    }

    if (visited[row]![col]) {
      return null;
    }

    const letter = getLetter(board, row, col)?.toUpperCase();
    if (!letter) return null;

    // Handle Qu tile
    if (letter === 'QU') {
      if (target.slice(index, index + 2) !== 'QU') {
        return null;
      }
      visited[row]![col] = true;
      const newPath = [...path, { row, col }];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const result = dfs(row + dr, col + dc, index + 2, newPath);
          if (result) {
            visited[row]![col] = false;
            return result;
          }
        }
      }
      visited[row]![col] = false;
      return null;
    }

    if (letter !== target[index]) {
      return null;
    }

    visited[row]![col] = true;
    const newPath = [...path, { row, col }];

    if (index + 1 === target.length) {
      visited[row]![col] = false;
      return newPath;
    }

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const result = dfs(row + dr, col + dc, index + 1, newPath);
        if (result) {
          visited[row]![col] = false;
          return result;
        }
      }
    }
    visited[row]![col] = false;
    return null;
  }

  // Try starting from each cell
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      const result = dfs(row, col, 0, []);
      if (result) {
        return result;
      }
    }
  }

  return null;
}
