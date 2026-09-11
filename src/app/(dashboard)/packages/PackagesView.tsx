'use client';

import Link from 'next/link';
import { ChevronRight, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useDebounce } from 'use-debounce';
import { usePathname } from 'next/navigation';

import { QueryState } from '@/components/general/query-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { formatDate, formatEnum } from '@/helpers/format';
import { cn } from '@/lib/utils';
import type { LogisticsPackage, LogisticsPackageStatus } from '@/interfaces/logisticsPackage';
import {
  useLogisticsPackages,
} from '@/services/logisticsPackage.services';

const STATUS_VARIANT: Record<LogisticsPackageStatus, 'default' | 'secondary' | 'outline'> = {
  REQUESTED: 'secondary',
  ACCEPTED: 'default',
  PICKED_UP: 'default',
  PACKAGED: 'default',
  SHIPPED: 'default',
  DELIVERED: 'outline',
  REJECTED: 'outline',
};

const STATUS_FILTERS: Array<{ value: LogisticsPackageStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'PICKED_UP', label: 'Picked up' },
  { value: 'PACKAGED', label: 'Packaged' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'REJECTED', label: 'Rejected' },
];

function packageLabel(pkg: LogisticsPackage): string {
  return `Trade ${pkg.tradeId.slice(0, 8)}…`;
}

function formatUser(userId: string): string {
  if (!userId) return '—';
  return userId.slice(0, 8);
}

/**
 * The company's package request queue.
 *
 * Accept/reject is only available from the package detail screen —
 * users must review a request before taking action.
 */
export function PackagesView() {
  const [statusFilter, setStatusFilter] = useState<LogisticsPackageStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 200);
  const pathname = usePathname();

  const { data, isLoading, error, refetch } = useLogisticsPackages(
    statusFilter === 'ALL' ? undefined : { status: statusFilter },
  );

  const packages = data?.packages ?? [];

  const filteredPackages = useMemo(() => {
    if (!debouncedSearch.trim()) return packages;
    const q = debouncedSearch.toLowerCase().trim();
    return packages.filter(
      (pkg) =>
        pkg.id.toLowerCase().includes(q) ||
        pkg.tradeId.toLowerCase().includes(q) ||
        (pkg.trackingNumber && pkg.trackingNumber.toLowerCase().includes(q)) ||
        pkg.status.toLowerCase().includes(q) ||
        (pkg.requestedByUserId && pkg.requestedByUserId.toLowerCase().includes(q)),
    );
  }, [packages, debouncedSearch]);

  const activePackageId = pathname.replace('/packages/', '');

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Packages</h1>
        <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
          Shipment requests handed to your company. Review each request before accepting or
          rejecting, then advance packages through pickup, packaging, and shipping.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-[13.5px]">Requests</CardTitle>
            <CardDescription className="text-[12px]">
              Newest requests first.
            </CardDescription>
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as LogisticsPackageStatus | 'ALL')}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input
                type="search"
                placeholder="Search by package ID, trade ID, tracking number, user, or status…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-9 text-[12.5px]"
              />
            </div>
          </div>
          <QueryState
            isLoading={isLoading}
            error={error}
            isEmpty={!isLoading && !error && filteredPackages.length === 0}
            onRetry={() => refetch()}
            emptyTitle="No package requests"
            emptyDescription={
              debouncedSearch.trim()
                ? `No packages match "${debouncedSearch}".`
                : statusFilter === 'ALL'
                  ? 'Requests from sellers who choose your company at checkout will show up here.'
                  : `No packages with status "${formatEnum(statusFilter)}" right now.`
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Trade ID</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackages.map((pkg) => (
                  <PackageRow
                    key={pkg.id}
                    pkg={pkg}
                    isActive={pkg.id === activePackageId}
                  />
                ))}
              </TableBody>
            </Table>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}

function PackageRow({ pkg, isActive }: { pkg: LogisticsPackage; isActive: boolean }) {
  const label = packageLabel(pkg);

  return (
    <TableRow
      className={cn(
        isActive && 'bg-komtru-cyan-soft/50 hover:bg-komtru-cyan-soft/50',
      )}
    >
      <TableCell>
        <Link href={`/packages/${pkg.id}`} className="hover:underline">
          <p className="text-[12.5px] font-medium">{label}</p>
          <p className="text-muted-foreground text-[11px] font-mono">{pkg.id.slice(0, 8)}…</p>
        </Link>
      </TableCell>
      <TableCell>
        <span className="font-mono text-[12px]">{pkg.tradeId.slice(0, 8)}…</span>
      </TableCell>
      <TableCell className="text-muted-foreground text-[12px]">
        {pkg.trackingNumber ? (
          <span className="font-mono">{pkg.trackingNumber}</span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-[12px]">
        {pkg.requestedByUserId ? formatUser(pkg.requestedByUserId) : '—'}
      </TableCell>
      <TableCell className="text-muted-foreground text-[12px]">
        {pkg.createdAt ? formatDate(pkg.createdAt) : '—'}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[pkg.status]}>{formatEnum(pkg.status)}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex justify-end">
          <Link
            href={`/packages/${pkg.id}`}
            className={cn(
              'text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[12px]',
              isActive && 'text-foreground font-medium',
            )}
          >
            View
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </TableCell>
    </TableRow>
  );
}


