import { describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../../app';
import { User } from '../../../models/User';
import { Organization } from '../../../models/Organization';
import { Shop } from '../../../models/Shop';
import { Membership } from '../../../models/Membership';

async function createShopUser(email: string, shopName: string) {
  const hash = await bcrypt.hash('SecurePass1234', 12);
  const user = await User.create({ name: 'User', email, passwordHash: hash });
  const org = await Organization.create({ name: `${shopName} Org`, ownerUserId: user._id });
  const shop = await Shop.create({ organizationId: org._id, name: shopName, location: 'Kigali' });
  await Membership.create({ userId: user._id, organizationId: org._id, shopId: shop._id, role: 'owner' });
  return { user, org, shop };
}

async function loginAndGetCookies(email: string) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'SecurePass1234' });
  return res.headers['set-cookie'] as unknown as string[];
}

describe('Tenant isolation', () => {
  it('user from Shop A cannot access Shop B data via X-Shop-Id header', async () => {
    const shopA = await createShopUser('shopA@test.com', 'Shop A');
    const shopB = await createShopUser('shopB@test.com', 'Shop B');

    const cookiesA = await loginAndGetCookies('shopA@test.com');

    // User A tries to access shop B's data by sending shop B's ID in header
    const res = await request(app)
      .get('/api/auth/users')
      .set('Cookie', cookiesA.join('; '))
      .set('X-Shop-Id', shopB.shop._id.toString());

    // Must be forbidden — Shop A user has no membership in Shop B
    expect(res.status).toBe(403);
  });

  it('user with no memberships cannot access any shop', async () => {
    const hash = await bcrypt.hash('SecurePass1234', 12);
    await User.create({ name: 'No Shop', email: 'noshop@test.com', passwordHash: hash });

    const cookies = await loginAndGetCookies('noshop@test.com');

    const res = await request(app)
      .get('/api/auth/users')
      .set('Cookie', cookies.join('; '));

    expect(res.status).toBe(403);
  });

  it('user auto-resolves to their single shop without X-Shop-Id header', async () => {
    await createShopUser('singleshop@test.com', 'Single Shop');
    const cookies = await loginAndGetCookies('singleshop@test.com');

    const res = await request(app)
      .get('/api/auth/users')
      .set('Cookie', cookies.join('; '));

    // Should succeed (no X-Shop-Id header needed for single-shop user)
    expect(res.status).toBe(200);
  });

  it('requires X-Shop-Id when user belongs to multiple shops', async () => {
    const hash = await bcrypt.hash('SecurePass1234', 12);
    const user = await User.create({ name: 'Multi', email: 'multi@test.com', passwordHash: hash });

    const org = await Organization.create({ name: 'Multi Org', ownerUserId: user._id });
    const shopA = await Shop.create({ organizationId: org._id, name: 'A', location: 'Kigali' });
    const shopB = await Shop.create({ organizationId: org._id, name: 'B', location: 'Kigali' });

    await Membership.create({ userId: user._id, organizationId: org._id, shopId: shopA._id, role: 'owner' });
    await Membership.create({ userId: user._id, organizationId: org._id, shopId: shopB._id, role: 'manager' });

    const cookies = await loginAndGetCookies('multi@test.com');

    // No X-Shop-Id header → TENANT_REQUIRED (400)
    const resNoHeader = await request(app)
      .get('/api/auth/users')
      .set('Cookie', cookies.join('; '));
    expect(resNoHeader.status).toBe(400);
    expect(resNoHeader.body.error.code).toBe('TENANT_REQUIRED');

    // With correct X-Shop-Id → succeeds
    const resWithHeader = await request(app)
      .get('/api/auth/users')
      .set('Cookie', cookies.join('; '))
      .set('X-Shop-Id', shopA._id.toString());
    expect(resWithHeader.status).toBe(200);
  });
});
