'use client';

import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDateTime, formatEnum } from '@/helpers/format';
import { useCustomToast } from '@/hooks/useCustomToast';
import {
  NEXT_ADVANCE_STATUS,
  PACKAGE_PIPELINE_STAGES,
  type LogisticsPackage,
  type LogisticsPackageStatus,
} from '@/interfaces/logisticsPackage';
import {
  useAcceptPackage,
  useAdvancePackage,
  useDeliverPackage,
  usePackageFromList,
  useRejectPackage,
} from '@/services/logisticsPackage.services';
import { useAuthStore } from '@/store/auth.store';

const STAGE_TIMESTAMP_KEY: Record<LogisticsPackageStatus, keyof LogisticsPackage | null> = {
  REQUESTED: 'requestedAt',
  ACCEPTED: 'acceptedAt',
  PICKED_UP: 'pickedUpAt',
  PACKAGED: 'packagedAt',
  SHIPPED: 'shippedAt',
  DELIVERED: 'deliveredAt',
  REJECTED: 'rejectedAt',
};

/**
 * One package's full detail view: trade info, creator info, timeline,
 * tracking, and actions — accept/reject only from here after review.
 *
 * Sourced from the already-fetched package LIST, not a dedicated detail
 * call — there is no company-scoped `GET /logistics/packages/:id` route
 * wired up yet. See `usePackageFromList`'s doc comment.
 */
export function PackageDetailView({ packageId }: { packageId: string }) {
  const { pkg, isLoading, error, refetch } = usePackageFromList(packageId);
  const logistics = useAuthStore((state) => state.logistics);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/packages"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[12px]"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          All packages
        </Link>
      </div>

      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && !pkg}
        onRetry={() => refetch()}
        emptyTitle="Package not found"
        emptyDescription="This package request may have been removed, or the link may be out of date."
      >
        {pkg ? <PackageDetailContent pkg={pkg} logisticsCompany={logistics?.companyName} /> : null}
      </QueryState>
    </div>
  );
}

function PackageDetailContent({ pkg, logisticsCompany }: { pkg: LogisticsPackage; logisticsCompany?: string }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Trade {pkg.tradeId.slice(0, 8)}…</h1>
          <p className="text-muted-foreground text-[12.5px]">Package {pkg.id.slice(0, 8)}…</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={pkg.status === 'REJECTED' ? 'outline' : 'default'}>
            {formatEnum(pkg.status)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TradeInfoSection pkg={pkg} />
        <CreatorInfoSection pkg={pkg} logisticsCompany={logisticsCompany} />
      </div>

      {pkg.status === 'REJECTED' ? (
        <RejectionCard pkg={pkg} />
      ) : (
        <PipelineSection pkg={pkg} />
      )}

      <TrackingInfoSection pkg={pkg} />
    </div>
  );
}

function TradeInfoSection({ pkg }: { pkg: LogisticsPackage }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13.5px]">Trade Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <InfoRow label="Trade ID" value={pkg.tradeId} mono />
        <InfoRow label="Package ID" value={pkg.id} mono />
        <InfoRow label="Status" value={formatEnum(pkg.status)} />
        <InfoRow label="Requested At" value={pkg.requestedAt ? formatDateTime(pkg.requestedAt) : '—'} />
        <InfoRow label="Created At" value={pkg.createdAt ? formatDateTime(pkg.createdAt) : '—'} />
        {pkg.assignedOperatorId ? (
          <InfoRow label="Assigned Operator" value={pkg.assignedOperatorId} mono />
        ) : null}
      </CardContent>
    </Card>
  );
}

function CreatorInfoSection({ pkg, logisticsCompany }: { pkg: LogisticsPackage; logisticsCompany?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13.5px]">Creator & Company</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <InfoRow label="Requested By (User ID)" value={pkg.requestedByUserId} mono />
        {logisticsCompany ? (
          <InfoRow label="Logistics Company" value={logisticsCompany} />
        ) : null}
        {pkg.companyId ? (
          <InfoRow label="Company ID" value={pkg.companyId} mono />
        ) : null}
        <InfoRow label="Created" value={pkg.createdAt ? formatDateTime(pkg.createdAt) : '—'} />
      </CardContent>
    </Card>
  );
}

function RejectionCard({ pkg }: { pkg: LogisticsPackage }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-[12.5px] font-medium text-komtru-risk">Rejected</p>
        <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
          {pkg.rejectionReason ?? 'No reason recorded.'}
        </p>
        {pkg.rejectedAt ? (
          <p className="text-muted-foreground mt-2 text-[11px]">
            Rejected on {formatDateTime(pkg.rejectedAt)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PipelineSection({ pkg }: { pkg: LogisticsPackage }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13.5px]">Pipeline</CardTitle>
        <CardDescription className="text-[12px]">
          Advance this request one stage at a time as it moves through your warehouse.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PipelineStepper pkg={pkg} />
      </CardContent>
    </Card>
  );
}

function PipelineStepper({ pkg }: { pkg: LogisticsPackage }) {
  const currentIndex = PACKAGE_PIPELINE_STAGES.indexOf(pkg.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        {PACKAGE_PIPELINE_STAGES.map((stage, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const timestampKey = STAGE_TIMESTAMP_KEY[stage];
          const timestamp = timestampKey ? (pkg[timestampKey] as string | null) : null;

          return (
            <div key={stage} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full border text-[11px] font-semibold',
                    done && 'bg-primary border-primary text-primary-foreground',
                    active && 'border-primary text-primary',
                    !done && !active && 'border-border text-muted-foreground',
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </div>
                <div className="w-20 text-center">
                  <p
                    className={cn(
                      'text-[11px] font-medium',
                      !done && !active && 'text-muted-foreground',
                    )}
                  >
                    {formatEnum(stage)}
                  </p>
                  {timestamp ? (
                    <p className="text-muted-foreground text-[10px]">{formatDateTime(timestamp)}</p>
                  ) : null}
                </div>
              </div>
              {index < PACKAGE_PIPELINE_STAGES.length - 1 ? (
                <div className={cn('mx-1 h-px flex-1', done ? 'bg-primary' : 'bg-border')} />
              ) : null}
            </div>
          );
        })}
      </div>

      <StageAction pkg={pkg} />
    </div>
  );
}

function TrackingInfoSection({ pkg }: { pkg: LogisticsPackage }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13.5px]">Tracking</CardTitle>
      </CardHeader>
      <CardContent>
        {pkg.trackingNumber ? (
          <div className="space-y-1">
            <InfoRow label="Tracking Number" value={pkg.trackingNumber} mono />
          </div>
        ) : (
          <p className="text-muted-foreground text-[12px]">No tracking number assigned yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function StageAction({ pkg }: { pkg: LogisticsPackage }) {
  const { showToast } = useCustomToast();
  const accept = useAcceptPackage();
  const reject = useRejectPackage();
  const advance = useAdvancePackage();
  const deliver = useDeliverPackage();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const busy = accept.isPending || reject.isPending || advance.isPending || deliver.isPending;

  const onError = (title: string) => (error: unknown) =>
    showToast({ title, description: errorMessageOf(error), type: 'error' });

  if (pkg.status === 'REQUESTED') {
    return (
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" disabled={busy} onClick={() => setRejectOpen(true)}>
          Reject
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            accept
              .mutateAsync({ packageId: pkg.id })
              .then(() => showToast({ title: 'Request accepted', type: 'success' }))
              .catch(onError("Couldn't accept the request"))
          }
        >
          {accept.isPending ? 'Accepting…' : 'Accept request'}
        </Button>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject this request?</DialogTitle>
              <DialogDescription>
                The seller will be bounced back to pick a different company or arrange
                shipping themselves. Give them a reason.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Outside our delivery coverage area"
              rows={3}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={busy || !reason.trim()}
                onClick={() =>
                  reject
                    .mutateAsync({ packageId: pkg.id, body: { reason: reason.trim() } })
                    .then(() => {
                      showToast({ title: 'Request rejected', type: 'success' });
                      setRejectOpen(false);
                    })
                    .catch(onError("Couldn't reject the request"))
                }
              >
                {reject.isPending ? 'Rejecting…' : 'Reject request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (pkg.status === 'DELIVERED') return null;

  if (pkg.status === 'SHIPPED') {
    return (
      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-muted-foreground text-[12px]">
          Tracking number:{' '}
          <span className="text-foreground font-medium">{pkg.trackingNumber}</span>
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            deliver
              .mutateAsync({ packageId: pkg.id })
              .then(() => showToast({ title: 'Marked as delivered', type: 'success' }))
              .catch(onError("Couldn't mark this delivered"))
          }
        >
          {deliver.isPending ? 'Marking delivered…' : 'Mark delivered'}
        </Button>
      </div>
    );
  }

  const nextStatus = NEXT_ADVANCE_STATUS[pkg.status];
  if (!nextStatus) return null;

  const advancingIntoShipped = nextStatus === 'SHIPPED';

  return (
    <div className="space-y-3 border-t pt-4">
      {advancingIntoShipped ? (
        <div className="space-y-1.5">
          <Label htmlFor="trackingNumber">Tracking number</Label>
          <Input
            id="trackingNumber"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Required to mark this shipped"
          />
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button
          disabled={busy || (advancingIntoShipped && !trackingNumber.trim())}
          onClick={() =>
            advance
              .mutateAsync({
                packageId: pkg.id,
                body: advancingIntoShipped
                  ? { nextStatus, trackingNumber: trackingNumber.trim() }
                  : { nextStatus },
              })
              .then(() => showToast({ title: 'Advanced to the next stage', type: 'success' }))
              .catch(onError("Couldn't advance this package"))
          }
        >
          {advance.isPending ? 'Advancing…' : `Advance to ${formatEnum(nextStatus)}`}
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-muted-foreground text-[12px]">{label}</span>
      <span className={cn('text-[12px] text-right', mono ? 'font-mono' : '')}>{value}</span>
    </div>
  );
}
