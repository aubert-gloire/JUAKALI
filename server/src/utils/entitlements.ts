import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { config } from '../config';
import type { FeatureKey, PlanLimits } from '../models/Plan';

const PILOT_LIMITS: PlanLimits = {
  maxShops: 999999,
  maxUsers: 999999,
  maxProducts: 999999,
  aiRequestsPerUserPerDay: config.AI_REQUESTS_PER_USER_PER_DAY,
  maxBackups: 30,
};

const ALL_FEATURES: FeatureKey[] = [
  'ai_assistant',
  'stock_counts',
  'advanced_reports',
  'multi_shop',
  'audit_log',
  'csv_import',
];

export interface OrgEntitlements {
  features: FeatureKey[];
  limits: PlanLimits;
  planCode: string;
  status: string;
}

export class EntitlementsService {
  /**
   * Returns true if the feature is enabled for the organization.
   * With BILLING_ENABLED=false, always returns true.
   */
  async can(organizationId: string, feature: FeatureKey): Promise<boolean> {
    if (!config.BILLING_ENABLED) return true;

    const entitlements = await this.getEntitlements(organizationId);
    return entitlements.features.includes(feature);
  }

  /**
   * Returns true if the organization is within the limit for the given key.
   * With BILLING_ENABLED=false, always returns true.
   */
  async withinLimit(
    organizationId: string,
    limitKey: keyof PlanLimits,
    currentCount: number,
  ): Promise<boolean> {
    if (!config.BILLING_ENABLED) return true;

    const entitlements = await this.getEntitlements(organizationId);

    // Suspended organizations cannot create new records
    if (entitlements.status === 'suspended') return false;

    return currentCount < entitlements.limits[limitKey];
  }

  async getEntitlements(organizationId: string): Promise<OrgEntitlements> {
    if (!config.BILLING_ENABLED) {
      return {
        features: ALL_FEATURES,
        limits: PILOT_LIMITS,
        planCode: 'pilot',
        status: 'active',
      };
    }

    const subscription = await Subscription.findOne({ organizationId }).lean();

    if (!subscription) {
      return {
        features: ALL_FEATURES,
        limits: PILOT_LIMITS,
        planCode: 'pilot',
        status: 'active',
      };
    }

    const plan = await Plan.findOne({ code: subscription.planCode }).lean();

    if (!plan) {
      return {
        features: ALL_FEATURES,
        limits: PILOT_LIMITS,
        planCode: 'pilot',
        status: subscription.status,
      };
    }

    // Merge plan limits with org-level overrides
    const overrides = (subscription.overrides ?? {}) as Partial<PlanLimits>;
    const limits: PlanLimits = { ...plan.limits, ...overrides };

    return {
      features: plan.features as FeatureKey[],
      limits,
      planCode: plan.code,
      status: subscription.status,
    };
  }
}
