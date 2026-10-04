import type { Request, Response, NextFunction } from 'express';
import { Errors } from '../utils/errors';
import { EntitlementsService } from '../utils/entitlements';
import type { FeatureKey } from '../models/Plan';

const entitlements = new EntitlementsService();

export function requireFeature(feature: FeatureKey) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.tenant) {
      next(Errors.unauthorized());
      return;
    }

    try {
      const allowed = await entitlements.can(
        req.tenant.organizationId.toString(),
        feature,
      );

      if (!allowed) {
        next(Errors.featureNotAvailable(feature));
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
