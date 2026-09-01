import type { ISODateString } from '@/interfaces/common';

export enum OrganizationPlanEnum {
  STARTER = 'starter',
  GROWTH = 'growth',
  SCALE = 'scale',
  ENTERPRISE = 'enterprise',
}

export enum OrganizationStatusEnum {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
}

/**
 * The tenant every operator and record hangs off.
 *
 * Kept to the fields the session itself needs. Module-specific settings
 * (protection defaults, thresholds, and so on) belong to whichever module owns
 * them — add them here only when the session genuinely needs them.
 */
export interface IOrganization {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlanEnum;
  status: OrganizationStatusEnum;
  logoUrl?: string | null;
  country: string;
  timezone: string;
  defaultCurrency: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
