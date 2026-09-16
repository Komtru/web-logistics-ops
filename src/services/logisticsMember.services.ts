import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AuthEnvelope } from '@/interfaces/auth';
import type { RequestError } from '@/interfaces/IAxios';
import type {
  InviteLogisticsMemberPayload,
  InviteLogisticsMemberResult,
  LogisticsMemberListParams,
  LogisticsMemberListResult,
  UpdateLogisticsMemberPayload,
  LogisticsCompanyMember,
} from '@/interfaces/logistics';
import { http } from '@/services/base';

/**
 * The logistics portal's own Team (POC) roster — `GET`/`POST /logistics/members`,
 * `PATCH /logistics/members/:id`. Confirmed against the real backend
 * (`companyMember.service.ts`, `controllers.ts`, `routes.ts` on
 * `feat/m2-logistics-packages`); see `interfaces/logistics.ts` for the two
 * load-bearing gaps this uncovered (no display info per member, and no way
 * to list pending-invitation rows on the roster).
 *
 * Every endpoint here is implicitly scoped to the caller's own company,
 * resolved server-side from the LOGISTICS-scoped token — nothing sends a
 * `companyId`.
 */
export const logisticsMemberKeys = {
  all: ['logistics-members'] as const,
  list: (params?: LogisticsMemberListParams) =>
    [...logisticsMemberKeys.all, 'list', params ?? {}] as const,
};

/**
 * `GET /logistics/members` — the roster, `status` filter. No pagination —
 * the response is a bare `{ members: [...] }` array, confirmed against
 * `listCompanyMembersController`.
 */
export function useLogisticsMembers(params?: LogisticsMemberListParams) {
  return useQuery<LogisticsMemberListResult, RequestError>({
    queryKey: logisticsMemberKeys.list(params),
    queryFn: async () => {
      const response = await http.get<AuthEnvelope<LogisticsMemberListResult>>({
        url: 'logistics/members',
        query: params,
      });
      return response.data;
    },
  });
}

/**
 * `POST /logistics/members` — invite another POC to the caller's company.
 *
 * Never 404s: resolves to `{ outcome: 'LINKED', member }` when the address
 * already belongs to a verified Kumtru account, or `{ outcome: 'PENDING',
 * invitation }` when it doesn't yet — see `companyMember.service.ts`'s
 * `inviteMember`. Besides `LAST_ADMIN`-style validation errors, this can
 * 409 with `ALREADY_HAS_ACTIVE_COMPANY` (the person already has a live
 * membership at a DIFFERENT company), `ALREADY_A_MEMBER` (already
 * invited/active at THIS company), or `ALREADY_INVITED_PENDING` (a pending
 * invitation already exists for that exact contact at this company).
 * Invalidates the roster on a `LINKED` outcome, since that adds a visible
 * row; a `PENDING` outcome adds nothing to `GET /logistics/members` (see
 * the module doc comment), so invalidating there too is harmless but not
 * load-bearing.
 */
export function useInviteLogisticsMember() {
  const queryClient = useQueryClient();

  return useMutation<InviteLogisticsMemberResult, RequestError, InviteLogisticsMemberPayload>({
    mutationKey: [...logisticsMemberKeys.all, 'invite'],
    mutationFn: async (body) => {
      const response = await http.post<AuthEnvelope<InviteLogisticsMemberResult>>({
        url: 'logistics/members',
        body,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsMemberKeys.all });
    },
  });
}

/**
 * `PATCH /logistics/members/:id` — change a POC's role, or remove them
 * (`status: 'REMOVED'`). Blocked with `409 LAST_ADMIN` if it would leave the
 * company with no ADMIN.
 */
export function useUpdateLogisticsMember() {
  const queryClient = useQueryClient();

  return useMutation<
    LogisticsCompanyMember,
    RequestError,
    { memberId: string; body: UpdateLogisticsMemberPayload }
  >({
    mutationKey: [...logisticsMemberKeys.all, 'update'],
    mutationFn: async ({ memberId, body }) => {
      const response = await http.patch<AuthEnvelope<LogisticsCompanyMember>>({
        url: `logistics/members/${memberId}`,
        body,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsMemberKeys.all });
    },
  });
}
