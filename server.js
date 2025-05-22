import { serve } from 'bun';
import { join } from 'path';
import { statSync, existsSync } from 'fs';
import { createBareServer } from '@tomphttp/bare-server-node';

// Config
const PORT = process.env.PORT || 3000;
const BUILD_DIR = './build';
const GAMES_DIR = './games';
const EMDATA_DIR = './emdata';
const BARE_PATH = '/bare/';

// Initialize bare-server
const bareServer = createBareServer(BARE_PATH);

// Helper to serve static files
function serveStatic(baseDir, pathname, shave = true) {
  const relativePath = shave ? pathname.substring(pathname.indexOf('/', 1)) : pathname;
  const filePath = join(process.cwd(), baseDir, relativePath);

  try {
    if (existsSync(filePath)) {
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        const indexPath = join(filePath, 'index.html');
        if (existsSync(indexPath)) {
          return new Response(Bun.file(indexPath));
        }
        return new Response('Directory listing not allowed', { status: 403 });
      }

      return new Response(Bun.file(filePath));
    }
  } catch (err) {
    console.error(`[ERROR] Serving ${filePath}:`, err);
  }

  return new Response('Not found', { status: 404 });
}

serve({
  port: PORT,
  fetch: async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

    console.log(`[REQ] ${req.method} ${path}`);

    if (bareServer.shouldRoute(req)) {
      return bareServer.handleRequest(req);
    }

    if (path.startsWith('/games/')) {
      return serveStatic(GAMES_DIR, path);
    }

    if (path.startsWith('/emdata/')) {
      return serveStatic(EMDATA_DIR, path);
    }

    return serveStatic(BUILD_DIR, path, false);
  },

  websocket: {
    // Bun requires `message` handler to be defined
    message(ws, message) {
      // no-op (bare handles WebSocket internally)
    },

    open(ws) {
      // optional
    },

    close(ws) {
      // optional
    },

    upgrade(req, socket) {
      if (bareServer.shouldRoute(req)) {
        bareServer.routeUpgrade(req, socket);
      } else {
        socket.end();
      }
    }
  }
});


console.log(`✅ Server running at http://localhost:${PORT} with bare proxy at ${BARE_PATH}`);
