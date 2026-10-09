/**
 * Seed script: creates plans, first organization, shop, owner user, and platform admin.
 *
 * Run: npm run seed --workspace=scripts
 *
 * Required env vars (set in .env or export before running):
 *   MONGODB_URI, OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD,
 *   SHOP_NAME, SHOP_LOCATION, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD
 *
 * The owner password is never logged.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ── Inline model definitions (avoids importing from server workspace) ────────

const OrgSchema = new mongoose.Schema({ name: String, ownerUserId: mongoose.Types.ObjectId, status: { type: String, default: 'active' }, settings: { defaultLanguage: { type: String, default: 'en' } } }, { timestamps: true });
const ShopSchema = new mongoose.Schema({ organizationId: mongoose.Types.ObjectId, name: String, location: String, currency: { type: String, default: 'RWF' }, timezone: { type: String, default: 'Africa/Kigali' }, allowNegativeStock: { type: Boolean, default: false }, lowStockDefault: { type: Number, default: 5 } }, { timestamps: true });
const UserSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true, lowercase: true }, passwordHash: String, preferredLanguage: { type: String, default: 'en' }, isActive: { type: Boolean, default: true }, mustChangePassword: { type: Boolean, default: false }, failedLoginAttempts: { type: Number, default: 0 } }, { timestamps: true });
const MembershipSchema = new mongoose.Schema({ userId: mongoose.Types.ObjectId, organizationId: mongoose.Types.ObjectId, shopId: mongoose.Types.ObjectId, role: String }, { timestamps: true });
const PlanSchema = new mongoose.Schema({ code: { type: String, unique: true }, name: String, priceMonthly: Number, priceYearly: Number, limits: { maxShops: Number, maxUsers: Number, maxProducts: Number, aiRequestsPerUserPerDay: Number, maxBackups: Number }, features: [String], isActive: { type: Boolean, default: true }, sortOrder: Number }, { timestamps: true });
const SubscriptionSchema = new mongoose.Schema({ organizationId: { type: mongoose.Types.ObjectId, unique: true }, planCode: String, status: { type: String, default: 'active' }, billingCycle: { type: String, default: 'monthly' }, currentPeriodStart: Date, cancelAtPeriodEnd: { type: Boolean, default: false } }, { timestamps: true });
const PlatformAdminSchema = new mongoose.Schema({ userId: { type: mongoose.Types.ObjectId, unique: true }, role: { type: String, default: 'super_admin' } }, { timestamps: true });

const Org = mongoose.model('Organization', OrgSchema);
const Shop = mongoose.model('Shop', ShopSchema);
const UserModel = mongoose.model('User', UserSchema);
const Membership = mongoose.model('Membership', MembershipSchema);
const Plan = mongoose.model('Plan', PlanSchema);
const Subscription = mongoose.model('Subscription', SubscriptionSchema);
const PlatformAdmin = mongoose.model('PlatformAdmin', PlatformAdminSchema);

// ── Validate env vars ────────────────────────────────────────────────────────

const required = [
  'MONGODB_URI',
  'OWNER_NAME',
  'OWNER_EMAIL',
  'OWNER_PASSWORD',
  'SHOP_NAME',
  'SHOP_LOCATION',
  'PLATFORM_ADMIN_EMAIL',
  'PLATFORM_ADMIN_PASSWORD',
] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ── Plan catalog ─────────────────────────────────────────────────────────────
// Edit prices and limits here before going live.

const PLAN_CATALOG = [
  {
    code: 'pilot',
    name: 'Pilot',
    priceMonthly: 0,
    priceYearly: 0,
    limits: { maxShops: 1, maxUsers: 5, maxProducts: 500, aiRequestsPerUserPerDay: 50, maxBackups: 7 },
    features: ['ai_assistant', 'stock_counts', 'advanced_reports', 'audit_log', 'csv_import'],
    isActive: true,
    sortOrder: 0,
  },
  {
    code: 'starter',
    name: 'Starter',
    priceMonthly: 15000,
    priceYearly: 150000,
    limits: { maxShops: 1, maxUsers: 10, maxProducts: 2000, aiRequestsPerUserPerDay: 100, maxBackups: 14 },
    features: ['ai_assistant', 'stock_counts', 'advanced_reports', 'audit_log', 'csv_import'],
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'business',
    name: 'Business',
    priceMonthly: 35000,
    priceYearly: 350000,
    limits: { maxShops: 5, maxUsers: 30, maxProducts: 10000, aiRequestsPerUserPerDay: 200, maxBackups: 30 },
    features: ['ai_assistant', 'stock_counts', 'advanced_reports', 'multi_shop', 'audit_log', 'csv_import'],
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 100000,
    priceYearly: 1000000,
    limits: { maxShops: 999, maxUsers: 999, maxProducts: 999999, aiRequestsPerUserPerDay: 999, maxBackups: 90 },
    features: ['ai_assistant', 'stock_counts', 'advanced_reports', 'multi_shop', 'audit_log', 'csv_import'],
    isActive: true,
    sortOrder: 3,
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('Connecting to database…');
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected.');

  // 1. Seed plan catalog
  console.log('Seeding plans…');
  for (const plan of PLAN_CATALOG) {
    await Plan.findOneAndUpdate({ code: plan.code }, plan, { upsert: true, new: true });
  }
  console.log(`  ${PLAN_CATALOG.length} plans seeded.`);

  // 2. Owner user
  console.log('Creating owner user…');
  const ownerEmail = process.env.OWNER_EMAIL!.toLowerCase();
  let owner = await UserModel.findOne({ email: ownerEmail });

  if (!owner) {
    const hash = await bcrypt.hash(process.env.OWNER_PASSWORD!, 12);
    owner = await UserModel.create({
      name: process.env.OWNER_NAME!,
      email: ownerEmail,
      passwordHash: hash,
    });
    console.log(`  Owner created: ${ownerEmail}`);
  } else {
    console.log(`  Owner already exists: ${ownerEmail}`);
  }

  // 3. Organization + shop
  let org = await Org.findOne({ ownerUserId: owner._id });

  if (!org) {
    console.log('Creating organization and shop…');
    org = await Org.create({ name: process.env.SHOP_NAME!, ownerUserId: owner._id });
    const shop = await Shop.create({
      organizationId: org._id,
      name: process.env.SHOP_NAME!,
      location: process.env.SHOP_LOCATION!,
      currency: process.env.CURRENCY ?? 'RWF',
      timezone: process.env.TIMEZONE ?? 'Africa/Kigali',
    });

    await Membership.create({
      userId: owner._id,
      organizationId: org._id,
      shopId: shop._id,
      role: 'owner',
    });

    // Subscription on pilot plan, active, no end date
    await Subscription.create({
      organizationId: org._id,
      planCode: 'pilot',
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
    });

    console.log(`  Organization: ${org.get('name')}`);
    console.log(`  Shop: ${process.env.SHOP_NAME} @ ${process.env.SHOP_LOCATION}`);
  } else {
    console.log('  Organization already exists, skipping.');
  }

  // 4. Platform admin
  console.log('Creating platform admin…');
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL!.toLowerCase();
  let adminUser = await UserModel.findOne({ email: adminEmail });

  if (!adminUser) {
    const hash = await bcrypt.hash(process.env.PLATFORM_ADMIN_PASSWORD!, 12);
    adminUser = await UserModel.create({
      name: 'Platform Admin',
      email: adminEmail,
      passwordHash: hash,
    });
  }

  const existingAdmin = await PlatformAdmin.findOne({ userId: adminUser._id });
  if (!existingAdmin) {
    await PlatformAdmin.create({ userId: adminUser._id, role: 'super_admin' });
    console.log(`  Platform admin created: ${adminEmail}`);
  } else {
    console.log(`  Platform admin already exists: ${adminEmail}`);
  }

  console.log('\n✅ Seed complete.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
