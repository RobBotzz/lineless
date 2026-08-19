import type { ReactNode } from 'react';

import { BaseNavbar } from './BaseNavbar';

type AttendeeNavbarProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
  widthClassName?: string;
};

export function AttendeeNavbar({
  left,
  center,
  right,
  className,
  widthClassName,
}: AttendeeNavbarProps) {
  return (
    <BaseNavbar
      className={className}
      left={left}
      center={center}
      right={right}
      widthClassName={widthClassName}
      paddingClassName="px-2 py-1.5 sm:px-3 lg:px-4"
    />
  );
}
