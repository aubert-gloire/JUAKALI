import { describe, it, expect, beforeEach } from 'vitest';
import { EntitlementsService } from '../entitlements';
import { Organization } from '../../models/Organization';
import { User } from '../../models/User';
import { Plan } from '../../models/Plan';
import { Subscription } from '../../models/Subscription';
import bcrypt from 'bcryptjs';

async function createOrg() {
  const hash = await bcrypt.hash('SecurePass1234', 12);
  const user = await User.create({ name: 'Owner', email: `owner${Date.now()}@test.com`, passwordHash: hash });
  const org = await Organization.create({ name: 'Test Org', ownerUserId: user._id });
  return { org, user };
}

describe('EntitlementsService (BILLING_ENABLED=false)', () => {
  const service = new EntitlementsService();

  it('can() returns true for any feature when billing is off', async () => {
    const { org } = await createOrg();
    const result = await service.can(org._id.toString(), 'ai_assistant');
    expect(result).toBe(true);
  });

  it('withinLimit() returns true for any limit when billing is off', async () => {
    const { org } = await createOrg();
    const result = await service.withinLimit(org._id.toString(), 'maxProducts', 99999);
    expect(result).toBe(true);
  });

  it('getEntitlements() returns pilot plan with all features when billing is off', async () => {
    const { org } = await createOrg();
    const entitlements = await service.getEntitlements(org._id.toString());

    expect(entitlements.planCode).toBe('pilot');
    expect(entitlements.features).toContain('ai_assistant');
    expect(entitlements.features).toContain('stock_counts');
    expect(entitlements.features).toContain('advanced_reports');
    expect(entitlements.limits.maxProducts).toBeGreaterThan(10000);
  });
});
