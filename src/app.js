const express  = require('express');
const cors     = require('cors');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const { createHandler } = require('graphql-http/lib/use/express');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const typeDefs     = require('./graphql/typeDefs');
const resolvers    = require('./graphql/resolvers');
const oauthRoutes  = require('./routes/oauthRoutes');
const { extractUserFromRequest } = require('./middleware/authMiddleware');

const app = express();

const FRONTEND_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // mobile apps, curl, same-origin
  if (FRONTEND_ORIGINS.includes(origin)) return true;
  // Allow any localhost or LAN IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);
};

app.use(cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(passport.initialize());
app.use('/auth', oauthRoutes);

// General rate limit — 200 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/graphql', apiLimiter);

const schema = makeExecutableSchema({ typeDefs, resolvers });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Expense Tracker GraphQL API is running' });
});

app.use('/graphql', createHandler({
  schema,
  context: async (req) => {
    const rawReq = req.raw ?? req;
    const user = await extractUserFromRequest(rawReq);
    const ip = rawReq.ip || rawReq.socket?.remoteAddress || null;
    return { user, ip };
  },
}));

app.get('/graphiql', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>GraphQL Playground — Expense Tracker</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: monospace; background: #1e1e2e; color: #cdd6f4; height: 100vh; display: flex; flex-direction: column; }
    h1 { padding: 12px 20px; background: #313244; font-size: 14px; color: #cba6f7; border-bottom: 1px solid #45475a; }
    .container { display: flex; flex: 1; overflow: hidden; }
    .panel { display: flex; flex-direction: column; flex: 1; }
    textarea { flex: 1; background: #181825; color: #cdd6f4; border: none; border-right: 1px solid #45475a; padding: 16px; font-family: monospace; font-size: 13px; resize: none; outline: none; }
    #result { flex: 1; background: #11111b; color: #a6e3a1; padding: 16px; font-size: 13px; overflow-y: auto; white-space: pre-wrap; }
    .toolbar { display: flex; gap: 8px; padding: 10px 16px; background: #313244; border-top: 1px solid #45475a; align-items: center; }
    button { padding: 8px 20px; background: #cba6f7; color: #1e1e2e; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; }
    button:hover { background: #b4befe; }
    .examples { padding: 10px 16px; background: #181825; border-bottom: 1px solid #45475a; display: flex; gap: 8px; flex-wrap: wrap; }
    .ex { padding: 4px 10px; background: #313244; border-radius: 4px; cursor: pointer; font-size: 11px; color: #89b4fa; border: 1px solid #45475a; }
    .ex:hover { background: #45475a; }
    label { font-size: 11px; color: #6c7086; padding: 6px 16px 2px; }
    #token-input { flex: 1; background: #181825; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px; padding: 6px 10px; font-family: monospace; font-size: 11px; }
  </style>
</head>
<body>
  <h1>GraphQL Playground — Expense Tracker API</h1>
  <div class="examples">
    <span class="ex" onclick="setQuery('mutation {\\n  login(email: \\"admin@smartspend.com\\", password: \\"admin123\\") {\\n    success message token\\n    user { id name email role { name } }\\n  }\\n}')">Login</span>
    <span class="ex" onclick="setQuery('{ transactions { data { id title amount type category date } pagination { total totalPages } } }')">All Transactions</span>
    <span class="ex" onclick="setQuery('{ statistics { totalIncome totalExpense balance avgExpense byCategory { category total } } }')">Statistics</span>
    <span class="ex" onclick="setQuery('{ trips { data { id name icon date } } }')">All Trips</span>
  </div>
  <div class="container">
    <div class="panel">
      <label>Query / Mutation</label>
      <textarea id="query" spellcheck="false">mutation {
  login(email: "admin@smartspend.com", password: "admin123") {
    success message token
    user { id name email role { name } }
  }
}</textarea>
    </div>
    <div class="panel">
      <label>Response</label>
      <div id="result">// Response will appear here</div>
    </div>
  </div>
  <div class="toolbar">
    <button onclick="runQuery()">Run Query</button>
    <input id="token-input" placeholder="Paste JWT token here for authenticated queries" />
    <span style="color:#6c7086; font-size:12px;">POST /graphql</span>
  </div>
  <script>
    function setQuery(q) { document.getElementById('query').value = q; }
    async function runQuery() {
      const query = document.getElementById('query').value;
      const token = document.getElementById('token-input').value.trim();
      const result = document.getElementById('result');
      result.textContent = '// Loading...';
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const res = await fetch('/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({ query })
        });
        const data = await res.json();
        result.textContent = JSON.stringify(data, null, 2);
        // Auto-populate token from login response
        if (data.data?.login?.token) {
          document.getElementById('token-input').value = data.data.login.token;
        }
        if (data.data?.register?.token) {
          document.getElementById('token-input').value = data.data.register.token;
        }
      } catch (err) {
        result.textContent = '// Error: ' + err.message;
      }
    }
    document.getElementById('query').addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'Enter') runQuery();
    });
  </script>
</body>
</html>`);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
