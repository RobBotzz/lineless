import type { ReactNode } from 'react';

import { BaseNavbar } from './BaseNavbar';

type OperatorNavbarProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
  widthClassName?: string;
};

export function OperatorNavbar({
  left,
  center,
  right,
  className,
  widthClassName,
}: OperatorNavbarProps) {
  return (
    <BaseNavbar
      className={className}
      left={left}
      center={center}
      right={right}
      widthClassName={widthClassName}
    />
  );
}
