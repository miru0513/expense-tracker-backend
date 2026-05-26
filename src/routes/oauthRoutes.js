const express  = require('express');
const passport = require('passport');
const crypto   = require('crypto');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: GitHubStrategy } = require('passport-github2');
const { signToken }       = require('../services/jwtService');
const sessionService      = require('../services/sessionService');
const userStore           = require('../store/userStore');

const router = express.Router();

const BACKEND_URL  = process.env.BACKEND_URL  || 'https://localhost:3001';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

// ── shared "find or create user by email" ─────────────────────────────────────
const findOrCreateOAuthUser = async (email, name) => {
  let user = await userStore.getUserByEmail(email);
  if (!user) {
    const randomPassword = crypto.randomBytes(20).toString('hex');
    user = await userStore.registerUser({ name, email, password: randomPassword, roleName: 'normal_user' });
  }
  return user;
};

// ── shared success handler ────────────────────────────────────────────────────
const oauthSuccess = async (req, res) => {
  try {
    const user  = req.user;
    const perms = user.role?.permissions?.map(p => p.name) || [];
    const { token, jti } = signToken({
      id: user.id, name: user.name, email: user.email,
      role: user.role?.name, permissions: perms,
    });
    await sessionService.createSession({
      userId: user.id, tokenId: jti, name: 'OAuth Login',
      permissions: perms, expiresIn: '24h', ipAddress: req.ip,
    });
    const encodedUser = encodeURIComponent(JSON.stringify(user));
    res.redirect(`${FRONTEND_URL}?oauth_token=${token}&oauth_user=${encodedUser}`);
  } catch (err) {
    console.error('[OAuth] oauthSuccess error:', err.message);
    res.redirect(`${FRONTEND_URL}?oauth_error=server_error`);
  }
};

// ── Google ────────────────────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  `${BACKEND_URL}/auth/google/callback`,
    },
    async (_at, _rt, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email from Google'));
        const user = await findOrCreateOAuthUser(email, profile.displayName || email);
        done(null, user);
      } catch (err) { done(err); }
    },
  ));

  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}?oauth_error=google_failed` }),
    oauthSuccess,
  );
  console.log('[OAuth] Google strategy enabled');
} else {
  console.log('[OAuth] Google strategy disabled — set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env');
}

// ── GitHub ────────────────────────────────────────────────────────────────────
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy(
    {
      clientID:     process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL:  `${BACKEND_URL}/auth/github/callback`,
      scope:        ['user:email'],
    },
    async (_at, _rt, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || `${profile.username}@github.local`;
        const name  = profile.displayName || profile.username;
        const user  = await findOrCreateOAuthUser(email, name);
        done(null, user);
      } catch (err) { done(err); }
    },
  ));

  router.get('/github', passport.authenticate('github', { session: false }));
  router.get('/github/callback',
    passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}?oauth_error=github_failed` }),
    oauthSuccess,
  );
  console.log('[OAuth] GitHub strategy enabled');
} else {
  console.log('[OAuth] GitHub strategy disabled — set GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET in .env');
}

module.exports = router;
