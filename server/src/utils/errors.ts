export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'ACCOUNT_LOCKED'
  | 'MUST_CHANGE_PASSWORD'
  | 'TENANT_REQUIRED'
  | 'FEATURE_NOT_AVAILABLE'
  | 'LIMIT_EXCEEDED'
  | 'NEGATIVE_STOCK'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  unauthorized: (msg = 'Authentication required') =>
    new AppError('UNAUTHORIZED', msg, 401),

  forbidden: (msg = 'Access denied') =>
    new AppError('FORBIDDEN', msg, 403),

  notFound: (resource = 'Resource') =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),

  validation: (msg: string) =>
    new AppError('VALIDATION_ERROR', msg, 422),

  conflict: (msg: string) =>
    new AppError('CONFLICT', msg, 409),

  rateLimited: (msg = 'Too many requests') =>
    new AppError('RATE_LIMITED', msg, 429),

  accountLocked: (msg = 'Account temporarily locked') =>
    new AppError('ACCOUNT_LOCKED', msg, 423),

  mustChangePassword: () =>
    new AppError('MUST_CHANGE_PASSWORD', 'You must change your password before continuing', 403),

  tenantRequired: () =>
    new AppError('TENANT_REQUIRED', 'X-Shop-Id header is required', 400),

  featureNotAvailable: (feature: string) =>
    new AppError(
      'FEATURE_NOT_AVAILABLE',
      `Feature '${feature}' is not available on your current plan`,
      403,
    ),

  limitExceeded: (limit: string) =>
    new AppError('LIMIT_EXCEEDED', `Your plan limit for '${limit}' has been reached`, 403),

  negativeStock: (productName: string) =>
    new AppError(
      'NEGATIVE_STOCK',
      `Insufficient stock for '${productName}'`,
      422,
    ),

  internal: (msg = 'Internal server error') =>
    new AppError('INTERNAL_ERROR', msg, 500),
};
