import type { ReactNode } from 'react';

import { BaseNavbar } from './BaseNavbar';

type OperatorNavbarProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
};

export function OperatorNavbar({ left, center, right }: OperatorNavbarProps) {
  return <BaseNavbar left={left} center={center} right={right} />;
}
