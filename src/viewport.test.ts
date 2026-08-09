import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('viewport configuration', () => {
  it('does not disable browser zoom', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const viewport = html.match(/<meta name="viewport" content="([^"]+)"/i)?.[1];

    expect(viewport).toBeDefined();
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(?:\.0)?(?:,|$)/i);
  });
});
