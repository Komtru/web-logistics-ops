import type { ISODateString } from '@/interfaces/common';

/**
 * Types for the logistics portal's package request pipeline —
 * `GET /logistics/packages`, `GET /logistics/packages/:id`,
 * `POST /logistics/packages/:id/{accept,reject,advance,deliver}`.
 *
 * REVISED against the real backend (`package.service.ts`, `domain/package.ts`,
 * `controllers.ts`, `routes.ts` on `feat/m2-logistics-packages`, plus the
 * company-scoped detail route added on `work/logistics`).
 *
 * `GET /logistics/packages/:id` is now wired up on the company-scoped
 * router and returns richer data than the list endpoint: `companyName`,
 * a `requester` and `assignedOperator` user reference (instead of raw
 * `requestedByUserId` / `assignedOperatorId` strings), a `tradeSummary`
 * (instead of a raw `tradeId`), and the full `events` audit trail. See
 * `services/logisticsPackage.services.ts`'s `useLogisticsPackage`.
 */

export type LogisticsPackageStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PICKED_UP'
  | 'PACKAGED'
  | 'SHIPPED'
  | 'DELIVERED';

/**
 * The linear happy-path pipeline, in order — `REJECTED` is a terminal branch
 * off `REQUESTED`, not a step in this sequence (`domain/package.ts`'s
 * `ALLOWED_PACKAGE_TRANSITIONS`). Used to render the stepper and to compute
 * what "the next stage" is for the advance action.
 */
export const PACKAGE_PIPELINE_STAGES: readonly LogisticsPackageStatus[] = [
  'REQUESTED',
  'ACCEPTED',
  'PICKED_UP',
  'PACKAGED',
  'SHIPPED',
  'DELIVERED',
];

/**
 * What `advance` actually moves a package TO, from each stage it can legally
 * be advanced from — mirrors `domain/package.ts`'s
 * `ALLOWED_PACKAGE_TRANSITIONS` for the three caller-driven steps. `accept`/
 * `reject`/`deliver` are their own dedicated endpoints, not `advance` calls.
 */
export const NEXT_ADVANCE_STATUS: Partial<
  Record<LogisticsPackageStatus, 'PICKED_UP' | 'PACKAGED' | 'SHIPPED'>
> = {
  ACCEPTED: 'PICKED_UP',
  PICKED_UP: 'PACKAGED',
  PACKAGED: 'SHIPPED',
};

/** One row of `GET /logistics/packages` — exactly `PackageView` server-side. */
export interface LogisticsPackage {
  id: string;
  tradeId: string;
  companyId: string;
  requestedByUserId: string;
  assignedOperatorId: string | null;
  status: LogisticsPackageStatus;
  trackingNumber: string | null;
  rejectionReason: string | null;
  requestedAt: ISODateString;
  acceptedAt: ISODateString | null;
  rejectedAt: ISODateString | null;
  pickedUpAt: ISODateString | null;
  packagedAt: ISODateString | null;
  shippedAt: ISODateString | null;
  deliveredAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** One row of the package's status-event audit trail — exactly `PackageStatusEventView` server-side. */
export interface LogisticsPackageStatusEvent {
  id: string;
  packageId: string;
  fromStatus: LogisticsPackageStatus | null;
  toStatus: LogisticsPackageStatus;
  actorUserId: string | null;
  note: string | null;
  createdAt: ISODateString;
}

/**
 * A user reference attached to package detail — used for both `requester`
 * (the merchant/seller who requested the courier) and `assignedOperator`
 * (the courier POC assigned to the package). `displayName`/`username`/
 * `emailMasked` are all optional since the backend may not have every field
 * populated for every user.
 */
export interface LogisticsPackageUserRef {
  userId: string;
  displayName?: string;
  username?: string;
  emailMasked?: string;
}

/**
 * Minimal trade context attached to package detail, so the UI can show a
 * human-readable trade code and item title instead of a raw `tradeId`.
 */
export interface LogisticsPackageTradeSummary {
  tradeId: string;
  tradeCode: string;
  title: string;
  amountMinor: number;
  currency: string;
}

/**
 * `GET /logistics/packages/:id`'s response shape — a package plus
 * `companyName`, `requester`/`assignedOperator` user references, a
 * `tradeSummary`, and the full status-event audit trail.
 *
 * `assignedOperator` is nullable, mirroring the base package's
 * `assignedOperatorId: string | null` — a package can still be unassigned
 * (e.g. immediately after being requested, before anyone accepts it).
 */
export interface LogisticsPackageDetail extends LogisticsPackage {
  companyName: string;
  requester: LogisticsPackageUserRef;
  assignedOperator: LogisticsPackageUserRef | null;
  tradeSummary: LogisticsPackageTradeSummary;
  events: LogisticsPackageStatusEvent[];
}

export interface LogisticsPackageListParams {
  status?: LogisticsPackageStatus;
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | null | undefined | Array<string | number> | undefined;
}

/** `GET /logistics/packages`'s response body — `packages`/`total`, not `results`/`totalPages`. */
export interface LogisticsPackageListResult {
  packages: LogisticsPackage[];
  total: number;
  page: number;
  limit: number;
}

/** `POST /logistics/packages/:id/reject` body — `reason` is required (`assertCanRejectPackage`, 400 `REJECTION_REASON_REQUIRED` otherwise). */
export interface RejectPackagePayload {
  reason: string;
}

/**
 * `POST /logistics/packages/:id/advance` body.
 *
 * `nextStatus` is REQUIRED and explicit — the frontend states which stage
 * it's advancing to, the backend does not infer "the next one" on its own
 * (`advancePackage`'s signature). `trackingNumber` is required only when
 * `nextStatus` is `'SHIPPED'` (400 `TRACKING_NUMBER_REQUIRED` otherwise).
 */
export interface AdvancePackagePayload {
  nextStatus: 'PICKED_UP' | 'PACKAGED' | 'SHIPPED';
  trackingNumber?: string;
}

/** `error.errorCode` values these endpoints can raise. */
export const PACKAGE_NOT_FOUND_ERROR_CODE = 'PACKAGE_NOT_FOUND';
export const INVALID_PACKAGE_TRANSITION_ERROR_CODE = 'INVALID_PACKAGE_TRANSITION';
export const TRACKING_NUMBER_REQUIRED_ERROR_CODE = 'TRACKING_NUMBER_REQUIRED';
export const REJECTION_REASON_REQUIRED_ERROR_CODE = 'REJECTION_REASON_REQUIRED';