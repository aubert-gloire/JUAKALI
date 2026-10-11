import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { Errors } from '../utils/errors';

export function requireAccess(req: Request, _res: Response, next: NextFunction): void {
  if (!config.BILLING_ENABLED) return next();

  const { trialEndsAt, accessExpiry } = req.tenant!;
  const now = new Date();

  if (accessExpiry && accessExpiry > now) return next();

  if (trialEndsAt) {
    const graceEnd = new Date(trialEndsAt.getTime() + config.GRACE_DAYS * 86_400_000);
    if (graceEnd > now) return next();
  }

  next(Errors.paymentRequired());
}
