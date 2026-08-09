import { sanitizeSessionCode, isValidSessionCode } from '../types';

/**
 * Extracts and validates a join code from URL search params.
 * @param searchParams - The URLSearchParams object to extract from
 * @returns The sanitized join code if valid, null otherwise
 */
export const getJoinCodeFromUrl = (searchParams: URLSearchParams): string | null => {
  const joinCode = searchParams.get('join');
  if (joinCode) {
    const sanitized = sanitizeSessionCode(joinCode);
    if (isValidSessionCode(sanitized)) {
      return sanitized;
    }
  }
  return null;
};

/**
 * Generates a shareable URL with the session code as a query parameter.
 * @param sessionCode - The session code to include in the URL
 * @returns The full URL with the join parameter
 */
export const generateShareUrl = (sessionCode: string): string => {
  const url = new URL(window.location.href);

  // HashRouter reads the route and its search parameters from the fragment.
  // A normal URL search parameter (`?join=...#/wordle`) is invisible to
  // useSearchParams(), so keep the invite parameter inside the hash route.
  const hashRoute = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const [hashPath = '/', hashSearch = ''] = hashRoute.split('?', 2);
  const hashSearchParams = new URLSearchParams(hashSearch);

  hashSearchParams.set('join', sessionCode);
  url.search = '';
  url.hash = `${hashPath || '/'}?${hashSearchParams.toString()}`;

  return url.toString();
};

/**
 * Generates a WhatsApp share URL with a pre-filled message.
 * @param sessionCode - The session code to share
 * @param gameName - The name of the game for the message
 * @returns The WhatsApp share URL
 */
export const generateWhatsAppUrl = (sessionCode: string, gameName: string = 'game'): string => {
  const shareUrl = generateShareUrl(sessionCode);
  const message = `Join my ${gameName} game! ${shareUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};
