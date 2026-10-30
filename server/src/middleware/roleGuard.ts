import type { Request, Response, NextFunction } from 'express';
import { Errors } from '../utils/errors';
import type { MembershipRole } from '../models/Membership';

const ROLE_RANK: Record<MembershipRole, number> = {
  accountant: 0,
  cashier: 1,
  manager: 2,
  owner: 3,
};

/**
 * requireRole('manager') — passes for manager AND owner (ranks >= manager rank).
 * accountant (rank 0) is always below cashier, so requireRole('cashier') blocks accountants.
 */
export function requireRole(minimumRole: MembershipRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      next(Errors.unauthorized());
      return;
    }

    if (ROLE_RANK[req.tenant.role] >= ROLE_RANK[minimumRole]) {
      next();
    } else {
      next(Errors.forbidden(`Requires ${minimumRole} role or above`));
    }
  };
}

/** requireExactRole('owner') — only the exact role, no promotion. */
export function requireExactRole(role: MembershipRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      next(Errors.unauthorized());
      return;
    }

    if (req.tenant.role === role) {
      next();
    } else {
      next(Errors.forbidden(`Requires ${role} role`));
    }
  };
}

/** requireAnyRole(['owner', 'cashier']) — passes if the role is in the allowed list. */
export function requireAnyRole(allowedRoles: MembershipRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      next(Errors.unauthorized());
      return;
    }

    if (allowedRoles.includes(req.tenant.role)) {
      next();
    } else {
      next(Errors.forbidden(`This action is not available for your role`));
    }
  };
}
