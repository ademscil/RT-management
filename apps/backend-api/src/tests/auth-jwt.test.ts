import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { UserRole, type JwtSessionPayload } from '@simrt/shared-types';

/**
 * ==============================================================================
 * JWT ROUND-TRIP + TENANT CLAIM FORGERY RESISTANCE
 * ==============================================================================
 * Two things are proven here:
 *
 *  1. INTEGRATION — `@fastify/jwt` still signs and verifies after the
 *     `fast-jwt` security override moved it from 5.0.6 to 6.3.5 (a MAJOR bump).
 *     A dependency override that silently breaks auth is worse than the CVE.
 *
 *  2. SECURITY INVARIANT — the signed `rtId` claim is the SOLE authority for
 *     tenant scope (`resolveTenantContext` trusts it over any client-supplied
 *     header). If an attacker could mutate `rtId` and keep a valid signature,
 *     the entire multi-tenant isolation model collapses. These tests assert that
 *     mutation without the secret is rejected.
 * ==============================================================================
 */

const SECRET = 'vitest_jwt_secret_at_least_32_chars_long';
const OTHER_SECRET = 'a_completely_different_secret_value_32ch';

const RT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const SESSION: JwtSessionPayload = {
  userId: '11111111-1111-4111-8111-111111111111',
  wargaId: '22222222-2222-4222-8222-222222222222',
  kkId: '33333333-3333-4333-8333-333333333333',
  username: 'ketua_rt',
  role: UserRole.KETUA_RT,
  rtId: RT_A,
  rtSlug: 'rt05-rw02-sukamaju-depok',
};

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(jwt, { secret: SECRET });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

/** Base64url-decode a JWT segment into an object. */
function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/** Base64url-encode a JSON object into a JWT segment. */
function encodeSegment(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

describe('@fastify/jwt integration (post fast-jwt security override)', () => {
  it('signs and verifies a session payload carrying rtId', () => {
    const token = app.jwt.sign(SESSION);
    expect(token.split('.')).toHaveLength(3);

    const decoded = app.jwt.verify<JwtSessionPayload>(token);
    expect(decoded.userId).toBe(SESSION.userId);
    expect(decoded.role).toBe(UserRole.KETUA_RT);
    expect(decoded.rtId).toBe(RT_A);
    expect(decoded.rtSlug).toBe(SESSION.rtSlug);
  });

  it('embeds rtId in the signed payload rather than the header', () => {
    const token = app.jwt.sign(SESSION);
    const [headerSegment, payloadSegment] = token.split('.');
    const payload = decodeSegment(payloadSegment);

    expect(payload.rtId).toBe(RT_A);
    // The header must be a minimal, alg-typed JWT header — no tenant data there.
    const header = decodeSegment(headerSegment);
    expect(typeof header.alg).toBe('string');
    expect(header).not.toHaveProperty('rtId');
  });

  it('rejects a token signed with a different secret', async () => {
    const rogue = Fastify();
    await rogue.register(jwt, { secret: OTHER_SECRET });
    await rogue.ready();
    const forged = rogue.jwt.sign(SESSION);
    await rogue.close();

    expect(() => app.jwt.verify<JwtSessionPayload>(forged)).toThrow();
  });

  it('REJECTS a forged rtId — tenant scope cannot be escalated by payload editing', () => {
    // Re-encode the payload claiming a DIFFERENT tenant, keeping the original
    // signature. This is the exact attack that would break multi-tenant
    // isolation, so it is asserted explicitly.
    const [headerSegment, payloadSegment, signatureSegment] = app.jwt.sign(SESSION).split('.');
    const payload = decodeSegment(payloadSegment);
    payload.rtId = RT_B;

    const tampered = `${headerSegment}.${encodeSegment(payload)}.${signatureSegment}`;

    expect(() => app.jwt.verify<JwtSessionPayload>(tampered)).toThrow();
  });

  it('REJECTS an unsigned (alg: none) token', () => {
    const header = { alg: 'none', typ: 'JWT' };
    const payload = { ...SESSION, rtId: RT_B };
    const unsigned = `${encodeSegment(header)}.${encodeSegment(payload)}.`;

    expect(() => app.jwt.verify<JwtSessionPayload>(unsigned)).toThrow();
  });

  it('REJECTS an expired token', () => {
    const expired = app.jwt.sign(SESSION, { expiresIn: '-10s' });
    expect(() => app.jwt.verify<JwtSessionPayload>(expired)).toThrow();
  });

  it('respects the configured expiry', () => {
    const token = app.jwt.sign(SESSION, { expiresIn: '1h' });
    const decoded = app.jwt.verify<JwtSessionPayload>(token);
    expect(decoded.exp).toBeTypeOf('number');
    expect(decoded.iat).toBeTypeOf('number');
    expect(decoded.exp! - decoded.iat!).toBe(3600);
  });
});
