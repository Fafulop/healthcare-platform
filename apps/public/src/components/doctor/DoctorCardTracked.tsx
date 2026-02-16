'use client';

import { trackDoctorCardClick } from '@/lib/analytics';

interface DoctorCardTrackedProps {
  doctorSlug: string;
  doctorName: string;
  position: number;
  children: React.ReactNode;
}

export default function DoctorCardTracked({ doctorSlug, doctorName, position, children }: DoctorCardTrackedProps) {
  const handleClick = () => {
    trackDoctorCardClick(doctorSlug, doctorName, position);
  };

  return (
    <div onClick={handleClick}>
      {children}
    </div>
  );
}
