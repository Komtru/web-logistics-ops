import type { ISODateString } from '@/interfaces/common';

/**
 * Types for the logistics portal's package request pipeline —
 * `GET /logistics/packages`, `POST /logistics/packages/:id/{accept,reject,advance,deliver}`.
 *
 * REVISED against the real backend (`package.service.ts`, `domain/package.ts`,
 * `controllers.ts`, `routes.ts` on `feat/m2-logistics-packages`).
 *
 * Two confirmed, load-bearing facts:
 *
 * 1. A package row carries only `tradeId` — no nested trade summary, no
 *    item description, no seller name. Same gap as the member roster: until
 *    a trade-lookup endpoint exists, the UI can only show a raw `tradeId`.
 *
 * 2. There is NO company-scoped `GET /logistics/packages/:id` route wired up
 *    yet (`logisticsRouter` in `routes.ts` has no such route) — although the
 *    underlying `getPackageDetail(packageId, companyId?, executor?)` service
 *    function already supports being called that way, so this is a route
 *    that's one line away from existing, not a real gap in the data model.
 *    Until it's wired up, the detail screen reads the package out of the
 *    already-fetched list instead of a separate network call — see
 *    `services/logisticsPackage.services.ts`'s `usePackageFromList`.
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

/** `getPackageDetail`'s shape — a package plus its full event history. Not reachable via a company-scoped route yet; see this file's module doc comment. */
export interface LogisticsPackageDetail extends LogisticsPackage {
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
