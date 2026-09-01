'use client';

import { AlertTriangle, CheckCircle2, CircleX, Info } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ShowToastOptions {
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
}

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: CircleX,
} as const;

const colorMap: Record<ToastType, { border: string; icon: string }> = {
  info: { border: 'border-l-komtru-blue', icon: 'text-komtru-blue' },
  success: { border: 'border-l-komtru-cyan', icon: 'text-komtru-cyan' },
  warning: { border: 'border-l-komtru-gold', icon: 'text-komtru-gold' },
  error: { border: 'border-l-komtru-risk', icon: 'text-komtru-risk' },
};

export function useCustomToast() {
  const showToast = useCallback(
    ({ title, description, type = 'info', duration = 4500 }: ShowToastOptions) => {
      const Icon = iconMap[type];
      const colors = colorMap[type];

      return toast.custom(
        () => (
          <div
            className={cn(
              'bg-card flex w-full items-start gap-3 rounded-lg border border-l-4 p-4 shadow-lg',
              colors.border,
            )}
            role={type === 'error' ? 'alert' : 'status'}
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', colors.icon)} aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="text-card-foreground text-sm leading-snug font-semibold">{title}</p>
              {description ? (
                <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
              ) : null}
            </div>
          </div>
        ),
        { duration },
      );
    },
    [],
  );

  return { showToast };
}
