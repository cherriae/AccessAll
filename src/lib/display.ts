/**
 * Maps domain enums to their visual treatment.
 *
 * Centralised so a status looks and reads the same on every screen, and so
 * adding a new status is one edit here plus a compile error anywhere it is not
 * yet handled.
 */

import type { IconName } from '@/components/ui/icon';
import type { AccentName } from '@/constants/theme';
import type { ActivityKind, ReportStatus } from '@/types';

export interface Display {
  label: string;
  icon: IconName;
  accent: AccentName;
}

export const REPORT_STATUS_DISPLAY: Record<ReportStatus, Display> = {
  open: { label: 'Open', icon: 'open', accent: 'explore' },
  'in-progress': { label: 'In progress', icon: 'in-progress', accent: 'campus' },
  resolved: { label: 'Resolved', icon: 'resolved', accent: 'verified' },
};

export const ACTIVITY_DISPLAY: Record<ActivityKind, Omit<Display, 'label'>> = {
  report: { icon: 'campus', accent: 'campus' },
  review: { icon: 'review', accent: 'explore' },
  vote: { icon: 'community', accent: 'community' },
  verification: { icon: 'verified', accent: 'verified' },
};
