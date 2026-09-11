'use client';

import { MoreHorizontal, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { InviteMemberDialog } from '@/app/(dashboard)/team/InviteMemberDialog';
import { errorMessageOf, QueryState } from '@/components/general/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/helpers/format';
import { useCustomToast } from '@/hooks/useCustomToast';
import { useRowLoading } from '@/hooks/useRowLoading';
import {
  LAST_ADMIN_ERROR_CODE,
  type LogisticsCompanyMember,
  type LogisticsMemberRole,
} from '@/interfaces/logistics';
import { useLogisticsMembers, useUpdateLogisticsMember } from '@/services/logisticsMember.services';
import { useAuthStore } from '@/store/auth.store';

const STATUS_VARIANT: Record<LogisticsCompanyMember['status'], 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  INVITED: 'secondary',
  REMOVED: 'outline',
};

/** No display info exists on a member row yet — see `interfaces/logistics.ts`'s module doc comment. */
function memberLabel(member: LogisticsCompanyMember): string {
  return `User ${member.userId.slice(0, 8)}…`;
}

/**
 * The company's POC roster.
 *
 * `GET /logistics/members` is visible to any signed-in POC (ADMIN or
 * OPERATOR) — confirmed against `listCompanyMembersController`, which only
 * requires `requireCompanyMembership`, not admin. Inviting, changing a
 * role, and removing someone are ADMIN-only (`requireCompanyAdmin`), gated
 * below on the caller's own `logistics.role` — a UI convenience, since the
 * server enforces the real boundary regardless.
 *
 * IMPORTANT, confirmed against the real backend: a person invited who has
 * NO existing Kumtru account never appears here at all, in any form, until
 * they sign up — they get a `logistics_member_invitations` row instead,
 * which has no list endpoint. The `PENDING` outcome is visible exactly once,
 * in the invite dialog's own result panel, and cannot be shown on this
 * roster afterward. That's a real backend gap, not something this screen
 * can work around.
 */
export function TeamView() {
  const isAdmin = useAuthStore((state) => state.logistics?.role === 'ADMIN');
  const { data, isLoading, error, refetch } = useLogisticsMembers();

  const members = data?.members ?? [];
  const ordered = [...members].sort((a, b) => {
    const rank = { ACTIVE: 0, INVITED: 1, REMOVED: 2 } as const;
    return rank[a.status] - rank[b.status];
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Team</h1>
          <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
            The points of contact who can sign in to this company&apos;s logistics portal.
          </p>
        </div>
        {isAdmin ? <InviteMemberDialog /> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[13.5px]">Roster</CardTitle>
          <CardDescription className="text-[12px] leading-relaxed">
            An &quot;Invited&quot; row already has a Komtru account and is waiting to sign in for the
            first time. Someone invited who doesn&apos;t have an account yet won&apos;t show up here at
            all until they sign up — tell them directly, since nothing notifies them automatically yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={isLoading}
            error={error}
            isEmpty={!isLoading && !error && ordered.length === 0}
            onRetry={() => refetch()}
            emptyTitle="No POCs yet"
            emptyDescription={
              isAdmin
                ? 'Invite the first point of contact to get this company started.'
                : "This company doesn't have any points of contact yet."
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited</TableHead>
                  {isAdmin ? <TableHead className="w-10" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered.map((member) => (
                  <MemberRow key={member.id} member={member} isAdmin={isAdmin} />
                ))}
              </TableBody>
            </Table>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberRow({ member, isAdmin }: { member: LogisticsCompanyMember; isAdmin: boolean }) {
  const { showToast } = useCustomToast();
  const { isRowLoading, withRowLoading } = useRowLoading<string>();
  const update = useUpdateLogisticsMember();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const label = memberLabel(member);
  const removed = member.status === 'REMOVED';
  const busy = isRowLoading(member.id);

  /** `409 LAST_ADMIN` gets its own copy — everything else is generic. */
  const handleError = (error: unknown, fallbackTitle: string) => {
    const isLastAdmin =
      (error as { errorCode?: string } | null)?.errorCode === LAST_ADMIN_ERROR_CODE;

    showToast({
      title: isLastAdmin ? "Can't change this" : fallbackTitle,
      description: isLastAdmin
        ? "You can't remove or demote the only admin. Promote someone else first."
        : errorMessageOf(error),
      type: 'error',
    });
  };

  const changeRole = (role: LogisticsMemberRole) => {
    withRowLoading(member.id, () =>
      update.mutateAsync({ memberId: member.id, body: { role } }),
    )
      .then(() => showToast({ title: `Role updated to ${role.toLowerCase()}`, type: 'success' }))
      .catch((error) => handleError(error, "Couldn't update the role"));
  };

  const remove = () => {
    withRowLoading(member.id, () =>
      update.mutateAsync({ memberId: member.id, body: { status: 'REMOVED' } }),
    )
      .then(() => {
        showToast({ title: `${label} removed from the team`, type: 'success' });
        setConfirmRemove(false);
      })
      .catch((error) => {
        handleError(error, "Couldn't remove this person");
        setConfirmRemove(false);
      });
  };

  return (
    <TableRow>
      <TableCell>
        <p className="text-[12.5px] font-medium">{label}</p>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 text-[12.5px]">
          {member.role === 'ADMIN' ? (
            <ShieldCheck className="text-komtru-cyan size-3.5" aria-hidden />
          ) : null}
          {member.role === 'ADMIN' ? 'Admin' : 'Operator'}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[member.status]}>{member.status}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-[12px]">
        {member.invitedAt ? formatDate(member.invitedAt) : '—'}
      </TableCell>

      {isAdmin ? (
        <TableCell>
          {removed ? null : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" disabled={busy}>
                    <MoreHorizontal className="size-4" aria-hidden />
                    <span className="sr-only">Actions for {label}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {member.role === 'OPERATOR' ? (
                    <DropdownMenuItem onSelect={() => changeRole('ADMIN')}>
                      Make admin
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => changeRole('OPERATOR')}>
                      Make operator
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setConfirmRemove(true)}
                  >
                    Remove from team
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Remove {label}?</DialogTitle>
                    <DialogDescription>
                      They&apos;ll lose access to this company&apos;s logistics portal immediately.
                      This doesn&apos;t affect their regular Komtru account.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConfirmRemove(false)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={remove} disabled={busy}>
                      {busy ? 'Removing…' : 'Remove'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </TableCell>
      ) : null}
    </TableRow>
  );
}
