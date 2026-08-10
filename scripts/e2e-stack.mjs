import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PeerServer } from 'peer';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST_ROOT = resolve(PROJECT_ROOT, 'dist');
const UPGRADE_ROOT = resolve(PROJECT_ROOT, 'test-results', 'pwa-build-b');
const APP_PREFIX = '/gamehub/';

const build = spawnSync('npm', ['run', 'build'], {
  cwd: PROJECT_ROOT,
  env: {
    ...process.env,
    VITE_PEER_HOST: '127.0.0.1',
    VITE_PEER_PORT: '9000',
    VITE_PEER_PATH: '/peerjs',
    VITE_PEER_SECURE: 'false',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

rmSync(UPGRADE_ROOT, { recursive: true, force: true });
cpSync(DIST_ROOT, UPGRADE_ROOT, { recursive: true });
const upgradeWorkerPath = resolve(UPGRADE_ROOT, 'sw.js');
const upgradeWorker = readFileSync(upgradeWorkerPath, 'utf8');
const upgradedWorker = upgradeWorker.replace(
  /gamehub-[0-9a-f]{16}/,
  'gamehub-ffffffffffffffff'
);
if (upgradeWorker === upgradedWorker) {
  throw new Error('Unable to create the service-worker upgrade fixture');
}
writeFileSync(upgradeWorkerPath, upgradedWorker);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

const send = (response, status, body, headers = {}) => {
  response.writeHead(status, {
    'Cache-Control': 'no-cache',
    ...headers,
  });
  response.end(body);
};

const createStaticHandler = ({ upgradeable }) => {
  let activeRoot = DIST_ROOT;

  return (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (upgradeable && requestUrl.pathname === '/__e2e/switch-build') {
      activeRoot = UPGRADE_ROOT;
      send(response, 204, '');
      return;
    }
    if (upgradeable && requestUrl.pathname === '/__e2e/reset-build') {
      activeRoot = DIST_ROOT;
      send(response, 204, '');
      return;
    }

    if (requestUrl.pathname === '/gamehub') {
      response.writeHead(302, { Location: APP_PREFIX });
      response.end();
      return;
    }
    if (!requestUrl.pathname.startsWith(APP_PREFIX)) {
      send(response, 404, 'Not found');
      return;
    }

    const relativePath = decodeURIComponent(requestUrl.pathname.slice(APP_PREFIX.length));
    const filePath = resolve(activeRoot, relativePath || 'index.html');
    if (filePath !== activeRoot && !filePath.startsWith(`${activeRoot}${sep}`)) {
      send(response, 403, 'Forbidden');
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      send(response, 404, 'Not found');
      return;
    }

    const origin = request.headers.origin;
    const headers = {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      ...(origin
        ? {
            'Access-Control-Allow-Origin': origin,
            Vary: 'Origin',
          }
        : {}),
    };
    send(response, 200, request.method === 'HEAD' ? '' : readFileSync(filePath), headers);
  };
};

let peerHttpServer;
PeerServer(
  {
    host: '127.0.0.1',
    port: 9000,
    path: '/peerjs',
    allow_discovery: false,
    proxied: false,
  },
  (server) => {
    peerHttpServer = server;
  }
);
const appServer = createServer(createStaticHandler({ upgradeable: false }));
const upgradeServer = createServer(createStaticHandler({ upgradeable: true }));

appServer.listen(4173, '127.0.0.1');
upgradeServer.listen(4175, '127.0.0.1');

const close = () => {
  const servers = [appServer, upgradeServer, peerHttpServer].filter(Boolean);
  let remaining = servers.length;
  for (const server of servers) {
    server.close(() => {
      remaining -= 1;
      if (remaining === 0) process.exit(0);
    });
  }
};

process.once('SIGINT', close);
process.once('SIGTERM', close);
