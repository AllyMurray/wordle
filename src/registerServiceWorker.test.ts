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
    expect(serviceWorker).toContain('ignoreVary: isVersionedBuildAsset');
  });

  it('injects a build fingerprint so deployments install atomically', () => {
    const serviceWorker = readFileSync('public/sw.js', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: { build: string };
    };
    const versionScript = readFileSync('scripts/version-service-worker.mjs', 'utf8');

    expect(serviceWorker).toContain("const CACHE_NAME = 'gamehub-__BUILD_ID__'");
    expect(packageJson.scripts.build).toContain('version-service-worker.mjs');
    expect(versionScript).toContain("const BUILD_ID_TOKEN = '__BUILD_ID__'");
    expect(versionScript).toContain('createHash');
  });

  it('waits for user approval before activating an update', () => {
    const serviceWorker = readFileSync('public/sw.js', 'utf8');
    const installHandler = serviceWorker.match(
      /self\.addEventListener\('install',[\s\S]*?\n}\);/
    )?.[0];
    const activateHandler = serviceWorker.match(
      /self\.addEventListener\('activate',[\s\S]*?\n}\);/
    )?.[0];

    expect(installHandler).not.toContain('skipWaiting');
    expect(activateHandler).not.toContain('clients.claim');
    expect(serviceWorker).toContain("if (event.data === 'skipWaiting')");
  });

  it('does not depend on third-party font requests for offline rendering', () => {
    const globalStyles = readFileSync('src/index.css', 'utf8');

    expect(globalStyles).not.toContain('fonts.googleapis.com');
    expect(globalStyles).not.toMatch(/@import\s+url\(['"]?https?:/);
  });
});
