import { beforeEach, describe, expect, it } from 'vitest';
import { generateShareUrl, generateWhatsAppUrl, getJoinCodeFromUrl } from './shareUrl';

const SESSION_CODE = 'ABCDEF-abc123';

describe('shareUrl', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/gamehub/#/wordle');
  });

  it('places the join code inside the hash-router search string', () => {
    const url = new URL(generateShareUrl(SESSION_CODE));

    expect(url.search).toBe('');
    expect(url.hash).toBe(`#/wordle?join=${SESSION_CODE}`);
  });

  it('preserves other hash-router search parameters', () => {
    window.history.replaceState({}, '', '/gamehub/#/boggle?mode=timed');

    const url = new URL(generateShareUrl(SESSION_CODE));

    expect(url.hash).toBe(`#/boggle?mode=timed&join=${SESSION_CODE}`);
  });

  it('produces a join code readable by the route search parser', () => {
    const url = new URL(generateShareUrl(SESSION_CODE));
    const routeSearch = url.hash.split('?')[1] ?? '';

    expect(getJoinCodeFromUrl(new URLSearchParams(routeSearch))).toBe(SESSION_CODE);
  });

  it('uses the hash-router invite URL in WhatsApp messages', () => {
    const whatsappUrl = new URL(generateWhatsAppUrl(SESSION_CODE, 'Wordle'));
    const message = whatsappUrl.searchParams.get('text');

    expect(message).toContain(`#/wordle?join=${SESSION_CODE}`);
  });
});
