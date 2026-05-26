require('dotenv').config();
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { WebSocketServer } = require('ws');
const { URL } = require('url');
const app = require('./src/app');
const { registerClient } = require('./src/services/generatorService');
const { sequelize } = require('./src/models/index');
const seedDatabase = require('./src/database/seeder');
const runMigrations = require('./src/database/migrate');
const connectMongo = require('./src/chat/mongoConnection');
const { handleChatConnection } = require('./src/chat/chatHandler');
const { verifyToken } = require('./src/services/jwtService');
const { isSessionValid } = require('./src/services/sessionService');

const PORT = process.env.PORT || 3001;

const getCerts = () => {
  const certsDir = path.join(__dirname, 'certs');
  const keyPath  = path.join(certsDir, 'server.key');
  const certPath = path.join(certsDir, 'server.cert');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }

  // Generate a self-signed certificate using OpenSSL (available on Windows 10+ and all Linux/macOS)
  try {
    const { spawnSync } = require('child_process');

    if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

    const result = spawnSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', keyPath,
      '-out',    certPath,
      '-days',   '365',
      '-nodes',
      '-subj',   '/CN=localhost/O=SmartSpend Dev/C=RO',
    ], { encoding: 'utf8' });

    if (result.status !== 0) throw new Error(result.stderr || 'openssl failed');

    console.log('[TLS] Self-signed certificate generated at certs/');
    console.log('[TLS] Visit the API URL once in a browser and accept the security warning to trust it.');
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  } catch (err) {
    console.warn('[TLS] Could not generate TLS certificate, falling back to HTTP:', err.message);
    return null;
  }
};

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('[DB] Connected to SQL Server successfully');
    await sequelize.sync({ force: false });
    console.log('[DB] Tables synced (migrated from models)');
    await runMigrations();
    await seedDatabase();

    await connectMongo();

    const certs = process.env.NODE_ENV !== 'production' ? getCerts() : null;
    const server = certs
      ? https.createServer(certs, app)
      : http.createServer(app);

    const protocol  = certs ? 'https' : 'http';
    const wsProtocol = certs ? 'wss'  : 'ws';

    // Single WebSocket server — routes by path
    const wss = new WebSocketServer({ server });

    wss.on('connection', async (ws, req) => {
      const { pathname, searchParams } = new URL(req.url, `${protocol}://localhost:${PORT}`);
      const token = searchParams.get('token');
      const user  = verifyToken(token);

      const valid = user && await isSessionValid(user.jti);
      if (!valid) {
        ws.close(1008, 'Authentication required');
        console.log(`[WS] Rejected unauthenticated/revoked connection on ${pathname}`);
        return;
      }

      if (pathname === '/ws') {
        console.log(`[WS] Generator client connected: ${user.email}`);
        registerClient(ws);
        ws.send(JSON.stringify({ type: 'CONNECTED', data: { message: 'WebSocket connected' } }));
      } else if (pathname === '/chat') {
        handleChatConnection(ws, user.id, user.name || user.email, user.role);
      }
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Expense Tracker API running on ${protocol}://0.0.0.0:${PORT}`);
      console.log(`GraphQL playground: ${protocol}://localhost:${PORT}/graphiql`);
      console.log(`WebSocket (generator): ${wsProtocol}://localhost:${PORT}/ws`);
      console.log(`WebSocket (chat):      ${wsProtocol}://localhost:${PORT}/chat`);
    });

  } catch (err) {
    console.error('[DB] Failed to connect:', err.message);
    console.error('Make sure SQL Server is running and credentials are correct in src/database/connection.js');
    process.exit(1);
  }
};

startServer();
