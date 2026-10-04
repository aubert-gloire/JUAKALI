import type { Request, Response, NextFunction } from 'express';
import { Errors } from '../utils/errors';
import { Membership } from '../models/Membership';
import { Shop } from '../models/Shop';
import type { MembershipRole } from '../models/Membership';
import type { Types } from 'mongoose';

export interface TenantContext {
  shopId: Types.ObjectId;
  organizationId: Types.ObjectId;
  role: MembershipRole;
  membershipId: Types.ObjectId;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export async function requireTenant(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(Errors.unauthorized());
    return;
  }

  const shopIdHeader = req.headers['x-shop-id'] as string | undefined;

  try {
    let membership;

    if (shopIdHeader) {
      membership = await Membership.findOne({
        userId: req.user.id,
        shopId: shopIdHeader,
      }).lean();

      if (!membership) {
        next(Errors.forbidden('You are not a member of this shop'));
        return;
      }
    } else {
      // Auto-resolve if the user belongs to exactly one shop
      const memberships = await Membership.find({ userId: req.user.id }).lean();

      if (memberships.length === 0) {
        next(Errors.forbidden('You have no shop access'));
        return;
      }

      if (memberships.length > 1) {
        next(Errors.tenantRequired());
        return;
      }

      membership = memberships[0];
    }

    // Verify the shop exists
    const shop = await Shop.findById(membership.shopId).lean();
    if (!shop) {
      next(Errors.notFound('Shop'));
      return;
    }

    req.tenant = {
      shopId: membership.shopId,
      organizationId: membership.organizationId,
      role: membership.role,
      membershipId: membership._id,
    };

    next();
  } catch (err) {
    next(err);
  }
}
