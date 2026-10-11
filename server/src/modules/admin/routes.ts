import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../../config';
import { asyncHandler } from '../../utils/asyncHandler';
import { Errors } from '../../utils/errors';
import { AccessToken, TOKEN_DURATION } from '../../models/AccessToken';
import { Shop } from '../../models/Shop';
import type { TokenPlan } from '../../models/AccessToken';
import type { Request, Response, NextFunction } from 'express';

export const adminRouter = Router();

const ADMIN_SECRET = config.JWT_ACCESS_SECRET + ':admin';

// ── helpers ───────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `JK-${seg()}-${seg()}-${seg()}`;
}

function requireAdminAuth(req: Request, _res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { next(Errors.unauthorized('Admin token required')); return; }
  try {
    const payload = jwt.verify(auth.slice(7), ADMIN_SECRET) as { role: string };
    if (payload.role !== 'platform_admin') { next(Errors.forbidden()); return; }
    next();
  } catch {
    next(Errors.unauthorized('Invalid admin token'));
  }
}

// ── POST /api/admin/login ─────────────────────────────────────────────────────

adminRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (
      email?.toLowerCase() !== config.PLATFORM_ADMIN_EMAIL.toLowerCase() ||
      password !== config.PLATFORM_ADMIN_PASSWORD
    ) {
      throw Errors.unauthorized('Invalid admin credentials');
    }
    const token = jwt.sign({ role: 'platform_admin' }, ADMIN_SECRET, { expiresIn: '8h' });
    res.json({ token });
  }),
);

// ── POST /api/admin/tokens ────────────────────────────────────────────────────

const generateSchema = z.object({
  plan: z.enum(['monthly', 'quarterly', 'yearly', 'lifetime']),
  count: z.number().int().min(1).max(100).default(1),
  notes: z.string().optional(),
});

adminRouter.post(
  '/tokens',
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const input = generateSchema.safeParse(req.body);
    if (!input.success) throw Errors.validation(input.error.issues[0].message);

    const { plan, count, notes } = input.data;
    const durationDays = TOKEN_DURATION[plan as TokenPlan];

    const tokens = await Promise.all(
      Array.from({ length: count }, async () => {
        let code: string;
        let attempts = 0;
        do {
          code = generateCode();
          attempts++;
          if (attempts > 20) throw Errors.internal('Could not generate unique token code');
        } while (await AccessToken.exists({ code }));

        return AccessToken.create({ code, plan, durationDays, notes });
      }),
    );

    res.status(201).json({ tokens: tokens.map((t) => ({ code: t.code, plan: t.plan, durationDays: t.durationDays })) });
  }),
);

// ── GET /api/admin/tokens ─────────────────────────────────────────────────────

adminRouter.get(
  '/tokens',
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const filter = (req.query as Record<string, string>).status === 'available'
      ? { shopId: null }
      : (req.query as Record<string, string>).status === 'redeemed'
      ? { shopId: { $ne: null } }
      : {};

    const tokens = await AccessToken.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('shopId', 'name')
      .lean();

    res.json({ tokens });
  }),
);

// ── GET /api/admin/shops ──────────────────────────────────────────────────────

adminRouter.get(
  '/shops',
  requireAdminAuth,
  asyncHandler(async (_req, res) => {
    const shops = await Shop.find().sort({ createdAt: -1 }).lean();
    const now = new Date();

    const rows = shops.map((s) => {
      let status: string;
      if (s.accessExpiry && s.accessExpiry > now) status = 'active';
      else if (s.trialEndsAt && s.trialEndsAt > now) status = 'trialing';
      else if (s.trialEndsAt && new Date(s.trialEndsAt.getTime() + 7 * 86_400_000) > now) status = 'grace';
      else status = 'expired';

      return {
        _id: s._id,
        name: s.name,
        location: s.location,
        plan: s.plan ?? 'trial',
        status,
        trialEndsAt: s.trialEndsAt,
        accessExpiry: s.accessExpiry,
        createdAt: s.createdAt,
      };
    });

    res.json({ shops: rows });
  }),
);

// ── PATCH /api/admin/shops/:id/grant ─────────────────────────────────────────

adminRouter.patch(
  '/shops/:id/grant',
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const { days, plan } = req.body as { days?: number; plan?: string };
    if (!days || days < 1) throw Errors.validation('days must be at least 1');

    const shop = await Shop.findById(req.params.id);
    if (!shop) throw Errors.notFound('Shop');

    const now = new Date();
    const base = shop.accessExpiry && shop.accessExpiry > now ? shop.accessExpiry : now;
    shop.accessExpiry = new Date(base.getTime() + days * 86_400_000);
    if (plan) shop.plan = plan;
    await shop.save();

    res.json({ ok: true, accessExpiry: shop.accessExpiry });
  }),
);
