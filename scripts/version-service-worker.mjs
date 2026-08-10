import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIST_URL = new URL('../dist/', import.meta.url);
const SERVICE_WORKER_URL = new URL('sw.js', DIST_URL);
const BUILD_ID_TOKEN = '__BUILD_ID__';

const fingerprintedFiles = [
  'index.html',
  'asset-manifest.json',
  'manifest.json',
  'data/boggle-words.txt',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
  'icons/icon-maskable.svg',
];

const serviceWorker = readFileSync(SERVICE_WORKER_URL, 'utf8');
if (!serviceWorker.includes(BUILD_ID_TOKEN)) {
  throw new Error(`Service worker build token ${BUILD_ID_TOKEN} was not found`);
}

const hash = createHash('sha256').update(serviceWorker);
for (const relativePath of fingerprintedFiles) {
  hash.update(readFileSync(new URL(relativePath, DIST_URL)));
}
const buildId = hash.digest('hex').slice(0, 16);

writeFileSync(
  fileURLToPath(SERVICE_WORKER_URL),
  serviceWorker.replaceAll(BUILD_ID_TOKEN, buildId)
);
