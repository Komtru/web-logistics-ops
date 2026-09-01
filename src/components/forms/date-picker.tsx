'use client';

import { CalendarIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate } from '@/helpers/format';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Restrict to dates the operator is allowed to pick. */
  fromDate?: Date;
  toDate?: Date;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Pick a date',
  disabled,
  fromDate,
  toDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn('w-full', className)}>
      {label ? <span className="mb-1.5 block text-xs font-semibold">{label}</span> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            fullWidth
            className={cn('h-11 justify-start font-normal', !value && 'text-muted-foreground')}
          >
            <CalendarIcon className="size-4" aria-hidden />
            {value ? formatDate(value.toISOString()) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            defaultMonth={value}
            captionLayout="dropdown"
            startMonth={fromDate}
            endMonth={toDate}
            disabled={
              fromDate || toDate ? { before: fromDate ?? new Date(0), after: toDate } : undefined
            }
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
