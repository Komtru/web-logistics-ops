'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FloatingLabelInputProps extends React.ComponentProps<'input'> {
  label: string;
  /** Rendered under the field; use for hints, not for validation errors. */
  hint?: string;
  invalid?: boolean;
}

/**
 * Label starts inside the field and floats on focus or once a value exists.
 * Uses `peer-placeholder-shown` so it works with Formik's uncontrolled
 * `<Field as={FloatingLabelInput}>` without extra state.
 *
 * The input needs a non-empty `placeholder` (a single space) for
 * `:placeholder-shown` to track emptiness — hence the default below.
 */
export const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  function FloatingLabelInput(
    { label, hint, invalid, className, id, placeholder = ' ', required, ...props },
    ref,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? `field-${generatedId}`;
    const hintId = hint ? `${inputId}-hint` : undefined;

    return (
      <div className="w-full">
        <div className="relative">
          <Input
            id={inputId}
            ref={ref}
            placeholder={placeholder}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={hintId}
            className={cn(
              'peer h-12 rounded-lg px-3.5 pt-5 pb-1.5 text-sm',
              'bg-komtru-slate-50 dark:bg-komtru-slate-800/50',
              'border-[1.5px]',
              className,
            )}
            {...props}
          />
          <label
            htmlFor={inputId}
            className={cn(
              'text-muted-foreground pointer-events-none absolute top-1.5 left-3.5 text-[11px] font-medium transition-all duration-150',
              'peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm',
              'peer-focus:text-komtru-blue peer-focus:top-1.5 peer-focus:text-[11px]',
              'dark:peer-focus:text-komtru-slate-100',
              invalid && 'text-komtru-risk peer-focus:text-komtru-risk',
            )}
          >
            {label}
            {required ? <span className="text-komtru-risk ml-0.5">*</span> : null}
          </label>
        </div>
        {hint ? (
          <p id={hintId} className="text-muted-foreground mt-1.5 text-[11.5px] leading-relaxed">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
