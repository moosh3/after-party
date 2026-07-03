import type { Metadata } from 'next';
import { getScheduleDisplayData } from '@/lib/showtime';
import RollingSchedule from './RollingSchedule';

export const metadata: Metadata = {
  title: 'Cage-A-Thon Schedule · Da Movies',
  description: 'The full lineup for the July 4th Cage-A-Thon on Da Movies.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SchedulePage() {
  const { settings, schedule } = getScheduleDisplayData();

  return <RollingSchedule settings={settings} schedule={schedule} />;
}
