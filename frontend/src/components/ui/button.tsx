import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const baseClasses =
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50';

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-accent text-white shadow-sm hover:bg-accent/90',
  secondary: 'bg-surface-muted text-text hover:bg-surface-muted/80',
  outline: 'border border-border bg-surface text-text hover:bg-surface-muted',
  ghost: 'bg-transparent text-text hover:bg-surface-muted',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3',
  md: 'h-10 px-4',
  lg: 'h-11 px-5',
};

export function buttonVariants({
  variant = 'default',
  size = 'md',
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
} = {}) {
  return [baseClasses, variantClasses[variant], sizeClasses[size]].join(' ');
}

export function Button({
  className,
  variant = 'default',
  size = 'md',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const mergedClassName = [buttonVariants({ variant, size }), className].filter(Boolean).join(' ');

  return (
    <button className={mergedClassName} type={type} {...props}>
      {children}
    </button>
  );
}
