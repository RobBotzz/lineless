import type { ReactNode } from 'react';

import { BaseNavbar } from './BaseNavbar';

type AttendeeNavbarProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
};

export function AttendeeNavbar({ left, center, right }: AttendeeNavbarProps) {
  return <BaseNavbar left={left} center={center} right={right} />;
}
