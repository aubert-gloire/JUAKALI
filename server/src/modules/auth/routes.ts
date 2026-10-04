import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, COOKIE_OPTIONS, ACCESS_COOKIE_MAX_AGE, REFRESH_COOKIE_MAX_AGE } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireRole } from '../../middleware/roleGuard';
import { authLimiter } from '../../middleware/rateLimiter';
import { EntitlementsService } from '../../utils/entitlements';
import {
  loginSchema,
  changePasswordSchema,
  inviteUserSchema,
  resetStaffPasswordSchema,
} from './validation';
import {
  loginUser,
  refreshTokens,
  getCurrentUser,
  changePassword,
  inviteUser,
  resetStaffPassword,
  getShopUsers,
} from './service';
import { Errors } from '../../utils/errors';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.safeParse(req.body);
    if (!input.success) {
      throw Errors.validation(input.error.issues[0].message);
    }

    const { user, accessToken, refreshToken } = await loginUser(input.data);

    res
      .cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_COOKIE_MAX_AGE })
      .cookie('refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_COOKIE_MAX_AGE })
      .json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          preferredLanguage: user.preferredLanguage,
          mustChangePassword: user.mustChangePassword,
        },
      });
  }),
);

// POST /api/auth/refresh
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw Errors.unauthorized('No refresh token');

    const { accessToken, refreshToken, user } = await refreshTokens(token);

    res
      .cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_COOKIE_MAX_AGE })
      .cookie('refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_COOKIE_MAX_AGE })
      .json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          preferredLanguage: user.preferredLanguage,
          mustChangePassword: user.mustChangePassword,
        },
      });
  }),
);

// POST /api/auth/logout
authRouter.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    res
      .clearCookie('access_token', COOKIE_OPTIONS)
      .clearCookie('refresh_token', COOKIE_OPTIONS)
      .json({ ok: true });
  }),
);

// GET /api/auth/me
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user, memberships } = await getCurrentUser(req.user!.id.toString());
    res.json({ user, memberships });
  }),
);

// GET /api/auth/me/entitlements
authRouter.get(
  '/me/entitlements',
  requireAuth,
  requireTenant,
  asyncHandler(async (req, res) => {
    const e = new EntitlementsService();
    const data = await e.getEntitlements(req.tenant!.organizationId.toString());
    res.json(data);
  }),
);

// POST /api/auth/change-password
authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = changePasswordSchema.safeParse(req.body);
    if (!input.success) throw Errors.validation(input.error.issues[0].message);

    await changePassword(req.user!.id.toString(), input.data);
    res.json({ ok: true });
  }),
);

// POST /api/auth/invite — owner only
authRouter.post(
  '/invite',
  requireAuth,
  requireTenant,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const input = inviteUserSchema.safeParse(req.body);
    if (!input.success) throw Errors.validation(input.error.issues[0].message);

    const user = await inviteUser(input.data, req.tenant!.shopId, req.tenant!.organizationId);
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email } });
  }),
);

// POST /api/auth/reset-staff-password — owner only
authRouter.post(
  '/reset-staff-password',
  requireAuth,
  requireTenant,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const input = resetStaffPasswordSchema.safeParse(req.body);
    if (!input.success) throw Errors.validation(input.error.issues[0].message);

    await resetStaffPassword(
      input.data.userId,
      input.data.newPassword,
      req.user!.id.toString(),
      req.tenant!.shopId,
    );

    res.json({ ok: true });
  }),
);

// GET /api/auth/users — list shop users (owner/manager)
authRouter.get(
  '/users',
  requireAuth,
  requireTenant,
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const users = await getShopUsers(req.tenant!.shopId);
    res.json({ users });
  }),
);
