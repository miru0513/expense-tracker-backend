const { signToken, verifyToken } = require('../src/services/jwtService');
const { extractUserFromRequest, requireAuth, requireAdmin } = require('../src/middleware/authMiddleware');

// ── jwtService ────────────────────────────────────────────────────────────────

describe('signToken / verifyToken', () => {
  it('signs a token and verifies it successfully', () => {
    const payload = { id: 'u1', email: 'alice@test.com', role: 'normal_user' };
    const token = signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature

    const decoded = verifyToken(token);
    expect(decoded.id).toBe('u1');
    expect(decoded.email).toBe('alice@test.com');
    expect(decoded.role).toBe('normal_user');
  });

  it('returns null for an invalid token', () => {
    expect(verifyToken('not.a.token')).toBeNull();
  });

  it('returns null for a tampered token', () => {
    const token = signToken({ id: 'u1', role: 'admin' });
    const tampered = token.slice(0, -4) + 'xxxx';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });
});

// ── extractUserFromRequest ────────────────────────────────────────────────────

describe('extractUserFromRequest', () => {
  const makeReq = (authHeader) => ({ headers: { authorization: authHeader } });

  it('returns decoded user for a valid Bearer token', () => {
    const token = signToken({ id: 'u2', email: 'bob@test.com', role: 'admin' });
    const user = extractUserFromRequest(makeReq(`Bearer ${token}`));
    expect(user).not.toBeNull();
    expect(user.id).toBe('u2');
    expect(user.role).toBe('admin');
  });

  it('returns null when Authorization header is missing', () => {
    expect(extractUserFromRequest({ headers: {} })).toBeNull();
  });

  it('returns null when scheme is not Bearer', () => {
    const token = signToken({ id: 'u3', role: 'admin' });
    expect(extractUserFromRequest(makeReq(`Basic ${token}`))).toBeNull();
  });

  it('returns null for an expired / invalid token after Bearer', () => {
    expect(extractUserFromRequest(makeReq('Bearer invalid.token.here'))).toBeNull();
  });

  it('handles uppercase Authorization header key', () => {
    const token = signToken({ id: 'u4', role: 'normal_user' });
    const req = { headers: { Authorization: `Bearer ${token}` } };
    // extractUserFromRequest checks both casing variants
    const user = extractUserFromRequest(req);
    expect(user).not.toBeNull();
    expect(user.id).toBe('u4');
  });
});

// ── requireAuth ───────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('returns the user when context has a valid user', () => {
    const ctx = { user: { id: 'u5', role: 'normal_user' } };
    expect(requireAuth(ctx).id).toBe('u5');
  });

  it('throws when context is null', () => {
    expect(() => requireAuth(null)).toThrow('Authentication required');
  });

  it('throws when context has no user', () => {
    expect(() => requireAuth({ user: null })).toThrow('Authentication required');
  });

  it('throws when context is undefined', () => {
    expect(() => requireAuth(undefined)).toThrow('Authentication required');
  });
});

// ── requireAdmin ──────────────────────────────────────────────────────────────

describe('requireAdmin', () => {
  it('returns the user when role is admin', () => {
    const ctx = { user: { id: 'u6', role: 'admin' } };
    expect(requireAdmin(ctx).id).toBe('u6');
  });

  it('throws when user is a normal_user', () => {
    const ctx = { user: { id: 'u7', role: 'normal_user' } };
    expect(() => requireAdmin(ctx)).toThrow('Admin access required');
  });

  it('throws when context has no user', () => {
    expect(() => requireAdmin({ user: null })).toThrow('Authentication required');
  });
});

// ── Full login + token flow (integration) ─────────────────────────────────────

describe('Full auth token round-trip', () => {
  it('a token from login can authenticate subsequent requests', () => {
    // Simulate what the login resolver does
    const userPayload = { id: 'u8', email: 'carol@test.com', role: 'normal_user' };
    const token = signToken(userPayload);

    // Simulate what the context function in app.js does
    const req = { headers: { authorization: `Bearer ${token}` } };
    const ctxUser = extractUserFromRequest(req);

    expect(ctxUser.id).toBe('u8');
    expect(ctxUser.email).toBe('carol@test.com');
    expect(ctxUser.role).toBe('normal_user');

    // requireAuth should pass without throwing
    expect(() => requireAuth({ user: ctxUser })).not.toThrow();
  });

  it('an admin token passes requireAdmin', () => {
    const token = signToken({ id: 'u9', email: 'admin@test.com', role: 'admin' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const ctxUser = extractUserFromRequest(req);

    expect(() => requireAdmin({ user: ctxUser })).not.toThrow();
  });
});
