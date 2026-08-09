import type { TrieNode } from './types';

/**
 * Trie data structure for efficient word lookup and prefix checking.
 * O(1) lookup for word validity and O(k) for prefix checking where k is prefix length.
 */
let root: TrieNode | null = null;
let wordSet: Set<string> | null = null;
let isLoaded = false;
let loadingPromise: Promise<void> | null = null;

const DICTIONARY_URL = `${import.meta.env.BASE_URL}data/boggle-words.txt`;

function createNode(): TrieNode {
  return {
    children: new Map(),
    isWord: false,
  };
}

function insertWord(word: string): void {
  if (!root) return;

  let node = root;
  for (const char of word.toUpperCase()) {
    if (!node.children.has(char)) {
      node.children.set(char, createNode());
    }
    node = node.children.get(char)!;
  }
  node.isWord = true;
}

/**
 * Initialise the in-memory trie from an iterable. Exported so tests can use a
 * focused fixture instead of downloading the production dictionary.
 */
export function initializeDictionary(words: Iterable<string>): void {
  root = createNode();
  wordSet = new Set();

  for (const word of words) {
    const upper = word.trim().toUpperCase();
    if (!/^[A-Z]{3,17}$/.test(upper)) continue;
    insertWord(upper);
    wordSet.add(upper);
  }

  isLoaded = true;
}

/** Load the public-domain ENABLE word-game dictionary once. */
export async function loadDictionary(): Promise<void> {
  if (isLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch(DICTIONARY_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load Boggle dictionary (${response.status})`);
      }
      return response.text();
    })
    .then((contents) => initializeDictionary(contents.split(/\s+/)))
    .catch((error: unknown) => {
      loadingPromise = null;
      throw error;
    });

  return loadingPromise;
}

/**
 * Check if a word is in the dictionary.
 */
export function isWord(word: string): boolean {
  if (!wordSet) {
    throw new Error('Boggle dictionary has not been loaded');
  }
  return wordSet!.has(word.toUpperCase());
}

/**
 * Check if a prefix exists in the dictionary.
 * Used by the solver to prune search paths early.
 */
export function isPrefix(prefix: string): boolean {
  if (!root) {
    throw new Error('Boggle dictionary has not been loaded');
  }

  let node = root!;
  for (const char of prefix.toUpperCase()) {
    if (!node.children.has(char)) {
      return false;
    }
    node = node.children.get(char)!;
  }
  return true;
}

/**
 * Get the trie root for advanced operations.
 */
export function getTrieRoot(): TrieNode {
  if (!root) {
    throw new Error('Boggle dictionary has not been loaded');
  }
  return root!;
}

/**
 * Check if dictionary is loaded.
 */
export function isDictionaryLoaded(): boolean {
  return isLoaded;
}
