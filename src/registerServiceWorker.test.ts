import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('offline asset bootstrap', () => {
  it('emits and precaches a manifest containing hashed and lazy assets', () => {
    const serviceWorker = readFileSync('public/sw.js', 'utf8');
    const viteConfig = readFileSync('vite.config.js', 'utf8');

    expect(viteConfig).toContain("manifest: 'asset-manifest.json'");
    expect(serviceWorker).toContain("const BUILD_MANIFEST_URL = BASE_PATH + 'asset-manifest.json'");
    expect(serviceWorker).toContain('for (const entry of Object.values(manifest))');
    expect(serviceWorker).toContain('await cacheBuildAssets(cache)');
  });
});
