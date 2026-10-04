import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../../app';
import { User } from '../../../models/User';
import { Organization } from '../../../models/Organization';
import { Shop } from '../../../models/Shop';
import { Membership } from '../../../models/Membership';

async function createTestUser(overrides: Partial<{
  email: string;
  password: string;
  isActive: boolean;
  mustChangePassword: boolean;
}> = {}) {
  const hash = await bcrypt.hash(overrides.password ?? 'TestPassword123', 12);
  const user = await User.create({
    name: 'Test User',
    email: overrides.email ?? 'test@example.com',
    passwordHash: hash,
    isActive: overrides.isActive ?? true,
    mustChangePassword: overrides.mustChangePassword ?? false,
  });
  const org = await Organization.create({ name: 'Test Org', ownerUserId: user._id });
  const shop = await Shop.create({
    organizationId: org._id,
    name: 'Test Shop',
    location: 'Kigali',
  });
  await Membership.create({
    userId: user._id,
    organizationId: org._id,
    shopId: shop._id,
    role: 'owner',
  });
  return { user, org, shop };
}

describe('POST /api/auth/login', () => {
  it('returns user and sets cookies on valid credentials', async () => {
    await createTestUser({ email: 'owner@test.com', password: 'SecurePass1234' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@test.com', password: 'SecurePass1234' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('owner@test.com');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c: string) => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('returns 401 on wrong password without revealing email existence', async () => {
    await createTestUser({ email: 'real@test.com', password: 'SecurePass1234' });

    const [wrongPass, unknownEmail] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'real@test.com', password: 'WrongPass999' }),
      request(app).post('/api/auth/login').send({ email: 'ghost@test.com', password: 'WrongPass999' }),
    ]);

    expect(wrongPass.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPass.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('rejects inactive users', async () => {
    await createTestUser({ email: 'inactive@test.com', password: 'SecurePass1234', isActive: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@test.com', password: 'SecurePass1234' });

    expect(res.status).toBe(401);
  });

  it('locks account after 5 failed attempts', async () => {
    await createTestUser({ email: 'lockme@test.com', password: 'CorrectPass123' });

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'lockme@test.com', password: 'WrongPass' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lockme@test.com', password: 'CorrectPass123' });

    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('returns 422 on invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'pass' });

    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues new tokens with a valid refresh token', async () => {
    await createTestUser({ email: 'refresh@test.com', password: 'SecurePass1234' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'refresh@test.com', password: 'SecurePass1234' });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie ?? '');

    expect(res.status).toBe(200);
    const newCookies = res.headers['set-cookie'] as unknown as string[];
    expect(newCookies.some((c: string) => c.startsWith('access_token='))).toBe(true);
  });

  it('returns 401 with no refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears auth cookies', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c: string) => c.includes('access_token=;'))).toBe(true);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user for authenticated request', async () => {
    await createTestUser({ email: 'me@test.com', password: 'SecurePass1234' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'me@test.com', password: 'SecurePass1234' });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies.join('; '));

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@test.com');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  it('successfully changes password with correct current password', async () => {
    await createTestUser({ email: 'changepw@test.com', password: 'OldPassword123' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'changepw@test.com', password: 'OldPassword123' });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookies.join('; '))
      .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword456!' });

    expect(res.status).toBe(200);

    // Old password no longer works
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'changepw@test.com', password: 'OldPassword123' });
    expect(oldLogin.status).toBe(401);
  });
});
