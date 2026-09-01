'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired once the last cell fills, so the caller can submit without a click. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  /** Labels the group for screen readers. */
  label?: string;
  className?: string;
}

const digitsOnly = (raw: string) => raw.replace(/\D/g, '');

/**
 * Segmented numeric code field.
 *
 * One cell per digit, but a single source of truth: `value` is the whole code
 * and each cell renders the character at its index. That keeps paste, backspace
 * and arrow navigation from needing per-cell state.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  label = 'Verification code',
  className,
}: OtpInputProps) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const focusCell = (index: number) => {
    refs.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  };

  /**
   * A cell accepts one digit, but browsers also deliver full codes here — from
   * a paste, or from iOS/Android SMS autofill — so anything longer spills into
   * the following cells rather than being truncated.
   */
  const handleChange = (index: number, raw: string) => {
    const incoming = digitsOnly(raw);
    if (!incoming) return;

    const next = (value.slice(0, index) + incoming).slice(0, length);
    commit(next);
    focusCell(index + incoming.length);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();

      // Clearing a filled cell stays put; clearing an empty one steps back, so
      // holding backspace walks the code away right-to-left.
      if (value[index]) {
        commit(value.slice(0, index) + value.slice(index + 1));
        return;
      }

      commit(value.slice(0, Math.max(index - 1, 0)));
      focusCell(index - 1);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusCell(index - 1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusCell(index + 1);
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex items-center justify-center gap-2 sm:gap-2.5', className)}
    >
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          // `text` + a numeric pattern gets the digit keypad without the spinner
          // and stepper behaviour `type="number"` drags along.
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          className={cn(
            'size-12 rounded-lg border-[1.5px] text-center font-mono text-lg font-semibold tabular-nums',
            'bg-komtru-slate-50 dark:bg-komtru-slate-800/50',
            'transition-[color,border-color,box-shadow] outline-none',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'disabled:pointer-events-none disabled:opacity-50',
            invalid ? 'border-destructive' : 'border-input',
          )}
        />
      ))}
    </div>
  );
}
