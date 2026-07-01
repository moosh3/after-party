import type { Metadata } from 'next';
import RollingSchedule from './RollingSchedule';

export const metadata: Metadata = {
  title: 'Cage-A-Thon Schedule · Da Movies',
  description: 'The full lineup for the July 4th Cage-A-Thon on Da Movies.',
};

export default function SchedulePage() {
  return <RollingSchedule />;
}
