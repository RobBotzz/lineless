import type { ButtonHTMLAttributes } from 'react';

import { DeleteIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

type DeleteIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function DeleteIconButton({
  className,
  label,
  type = 'button',
  ...props
}: DeleteIconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        'rounded-md p-2 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      type={type}
      {...props}
    >
      <DeleteIcon />
    </button>
  );
}
