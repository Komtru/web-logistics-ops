'use client';

import { Check, ChevronsUpDown, X } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  label: string;
  value: string;
  description?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  /** Show at most this many chips before collapsing into "+N more". */
  maxVisible?: number;
  disabled?: boolean;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select…',
  maxVisible = 3,
  disabled,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(
    () => options.filter((option) => value.includes(option.value)),
    [options, value],
  );

  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    );
  }

  const visible = selected.slice(0, maxVisible);
  const overflow = selected.length - visible.length;

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
            role="combobox"
            aria-expanded={open}
            className="h-11 justify-between font-normal"
          >
            <span className="flex flex-wrap items-center gap-1.5 overflow-hidden">
              {selected.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <>
                  {visible.map((option) => (
                    <Badge
                      key={option.value}
                      variant="secondary"
                      className="gap-1 rounded-full px-2 py-0 text-[11px] font-medium"
                    >
                      {option.label}
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label={`Remove ${option.label}`}
                        className="hover:text-komtru-risk cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggle(option.value);
                        }}
                      >
                        <X className="size-3" aria-hidden />
                      </span>
                    </Badge>
                  ))}
                  {overflow > 0 ? (
                    <span className="text-muted-foreground text-[11px]">+{overflow} more</span>
                  ) : null}
                </>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-1">
          <ScrollArea className="max-h-64">
            <ul role="listbox" aria-multiselectable className="space-y-0.5">
              {options.map((option) => {
                const isSelected = value.includes(option.value);

                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggle(option.value)}
                      className={cn(
                        'hover:bg-accent hover:text-accent-foreground flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                        isSelected && 'bg-accent/60',
                      )}
                    >
                      <Check
                        className={cn(
                          'text-komtru-cyan mt-0.5 size-4 shrink-0',
                          !isSelected && 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{option.label}</span>
                        {option.description ? (
                          <span className="text-muted-foreground block text-[11px]">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
