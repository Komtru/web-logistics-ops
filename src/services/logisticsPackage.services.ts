import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AuthEnvelope } from '@/interfaces/auth';
import type { RequestError } from '@/interfaces/IAxios';
import type {
  AdvancePackagePayload,
  LogisticsPackage,
  LogisticsPackageDetail,
  LogisticsPackageListParams,
  LogisticsPackageListResult,
  RejectPackagePayload,
} from '@/interfaces/logisticsPackage';
import { http } from '@/services/base';

/**
 * The logistics portal's own package request pipeline — `GET /logistics/packages`,
 * `GET /logistics/packages/:id`, `POST /logistics/packages/:id/{accept,reject,advance,deliver}`.
 * Confirmed against the real backend (`package.service.ts`, `domain/package.ts`,
 * `controllers.ts`, `routes.ts` on `feat/m2-logistics-packages`, plus the
 * company-scoped detail route added on `work/logistics`); see
 * `interfaces/logisticsPackage.ts` for the richer shape `GET /logistics/packages/:id`
 * returns (companyName, requester, assignedOperator, tradeSummary, events).
 *
 * Every endpoint here is implicitly scoped to the caller's own company, same
 * as `logisticsMember.services.ts` — nothing sends a `companyId`.
 */
export const logisticsPackageKeys = {
  all: ['logistics-packages'] as const,
  list: (params?: LogisticsPackageListParams) =>
    [...logisticsPackageKeys.all, 'list', params ?? {}] as const,
  detail: (packageId: string) => [...logisticsPackageKeys.all, 'detail', packageId] as const,
};

/** `GET /logistics/packages` — the company's package requests, `status` filter, `page`/`limit` pagination. */
export function useLogisticsPackages(params?: LogisticsPackageListParams) {
  return useQuery<LogisticsPackageListResult, RequestError>({
    queryKey: logisticsPackageKeys.list(params),
    queryFn: async () => {
      const response = await http.get<AuthEnvelope<LogisticsPackageListResult>>({
        url: 'logistics/packages',
        query: params,
      });
      return response.data;
    },
  });
}

/**
 * `GET /logistics/packages/:id` — company-scoped package detail: the base
 * package fields plus `companyName`, `requester`/`assignedOperator` user
 * references, a `tradeSummary`, and the full status-event audit trail.
 *
 * Replaces the old `usePackageFromList` stopgap now that this dedicated
 * route is wired up server-side — no more reading a package out of the
 * unfiltered list just to render a detail page.
 */
export function useLogisticsPackage(packageId: string) {
  return useQuery<LogisticsPackageDetail, RequestError>({
    queryKey: logisticsPackageKeys.detail(packageId),
    queryFn: async () => {
      const response = await http.get<AuthEnvelope<LogisticsPackageDetail>>({
        url: `logistics/packages/${packageId}`,
      });
      return response.data;
    },
    enabled: !!packageId,
  });
}

/** `POST /logistics/packages/:id/accept` — accept a `REQUESTED` package request. */
export function useAcceptPackage() {
  const queryClient = useQueryClient();

  return useMutation<LogisticsPackage, RequestError, { packageId: string }>({
    mutationKey: [...logisticsPackageKeys.all, 'accept'],
    mutationFn: async ({ packageId }) => {
      const response = await http.post<AuthEnvelope<LogisticsPackage>>({
        url: `logistics/packages/${packageId}/accept`,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsPackageKeys.all });
    },
  });
}

/** `POST /logistics/packages/:id/reject` — reject a `REQUESTED` package request; `reason` is required. */
export function useRejectPackage() {
  const queryClient = useQueryClient();

  return useMutation<
    LogisticsPackage,
    RequestError,
    { packageId: string; body: RejectPackagePayload }
  >({
    mutationKey: [...logisticsPackageKeys.all, 'reject'],
    mutationFn: async ({ packageId, body }) => {
      const response = await http.post<AuthEnvelope<LogisticsPackage>>({
        url: `logistics/packages/${packageId}/reject`,
        body,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsPackageKeys.all });
    },
  });
}

/**
 * `POST /logistics/packages/:id/advance` — move to a specific next pipeline
 * stage. `nextStatus` is required and explicit (`PICKED_UP` | `PACKAGED` |
 * `SHIPPED`) — the backend does not infer "the next one," the caller states
 * it (`advancePackage`'s signature). `trackingNumber` is required only when
 * `nextStatus` is `'SHIPPED'`.
 */
export function useAdvancePackage() {
  const queryClient = useQueryClient();

  return useMutation<
    LogisticsPackage,
    RequestError,
    { packageId: string; body: AdvancePackagePayload }
  >({
    mutationKey: [...logisticsPackageKeys.all, 'advance'],
    mutationFn: async ({ packageId, body }) => {
      const response = await http.post<AuthEnvelope<LogisticsPackage>>({
        url: `logistics/packages/${packageId}/advance`,
        body,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsPackageKeys.all });
    },
  });
}

/** `POST /logistics/packages/:id/deliver` — mark `DELIVERED`; publishes `logistics.package.delivered` server-side. */
export function useDeliverPackage() {
  const queryClient = useQueryClient();

  return useMutation<LogisticsPackage, RequestError, { packageId: string }>({
    mutationKey: [...logisticsPackageKeys.all, 'deliver'],
    mutationFn: async ({ packageId }) => {
      const response = await http.post<AuthEnvelope<LogisticsPackage>>({
        url: `logistics/packages/${packageId}/deliver`,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsPackageKeys.all });
    },
  });
}