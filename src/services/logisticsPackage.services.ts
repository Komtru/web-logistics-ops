import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AuthEnvelope } from '@/interfaces/auth';
import type { RequestError } from '@/interfaces/IAxios';
import type {
  AdvancePackagePayload,
  LogisticsPackage,
  LogisticsPackageListParams,
  LogisticsPackageListResult,
  RejectPackagePayload,
} from '@/interfaces/logisticsPackage';
import { http } from '@/services/base';

/**
 * The logistics portal's own package request pipeline — `GET /logistics/packages`,
 * `POST /logistics/packages/:id/{accept,reject,advance,deliver}`. Confirmed
 * against the real backend (`package.service.ts`, `domain/package.ts`,
 * `controllers.ts`, `routes.ts` on `feat/m2-logistics-packages`); see
 * `interfaces/logisticsPackage.ts` for the two load-bearing gaps this
 * uncovered (no trade summary per package, and no company-scoped detail
 * route wired up yet — though the service function underneath already
 * supports one).
 *
 * Every endpoint here is implicitly scoped to the caller's own company, same
 * as `logisticsMember.services.ts` — nothing sends a `companyId`.
 */
export const logisticsPackageKeys = {
  all: ['logistics-packages'] as const,
  list: (params?: LogisticsPackageListParams) =>
    [...logisticsPackageKeys.all, 'list', params ?? {}] as const,
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
 * Reads one package out of the already-fetched, UNFILTERED list rather than
 * a dedicated `GET /logistics/packages/:id` call — that route does not
 * exist on the company-scoped router yet (`routes.ts` only wires the admin
 * one, `adminGetPackageDetailController`), even though the service function
 * underneath (`getPackageDetail(packageId, companyId?)`) already supports
 * being called this way. This is the correct stopgap until a one-line route
 * addition lands server-side, not a permanent design — once
 * `GET /logistics/packages/:id` exists, swap this for a real `useQuery`
 * keyed on the id, the same shape `useLogisticsMembers` already has.
 *
 * Fetches the unfiltered list (not just whatever filter the list screen
 * happens to have active) so a direct link to a detail page works
 * regardless of which status filter was last selected there.
 */
export function usePackageFromList(packageId: string) {
  const { data, isLoading, error, refetch } = useLogisticsPackages();

  const pkg = data?.packages.find((candidate) => candidate.id === packageId) ?? null;

  return { pkg, isLoading, error, refetch };
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
