import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const PRIMARY_BTN_CLASS = 'h-12 w-full rounded-xl';

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  className?: string;
};

export function PrimaryButton({ className, children, ...props }: PrimaryButtonProps) {
  return (
    <Button className={cn(PRIMARY_BTN_CLASS, className)} {...props}>
      {children}
    </Button>
  );
}
