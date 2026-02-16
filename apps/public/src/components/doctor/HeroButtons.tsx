// Hero Action Buttons - Client component for interactivity
'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import Button from '../ui/Button';
import { trackContactClick, trackAppointmentClick } from '@/lib/analytics';

interface HeroButtonsProps {
  doctorSlug: string;
  whatsappNumber?: string | null;
  onBookingClick?: () => void;
  googleAdsId?: string;
}

export default function HeroButtons({ doctorSlug, whatsappNumber, onBookingClick, googleAdsId }: HeroButtonsProps) {
  const handleWhatsAppClick = () => {
    if (whatsappNumber) {
      trackContactClick(doctorSlug, 'whatsapp', 'hero', googleAdsId);
      const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanNumber}`, '_blank');
    }
  };

  const handleBookingClick = () => {
    trackAppointmentClick(doctorSlug, 'hero');
    onBookingClick?.();
  };

  return (
    <div className="hidden md:flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
      <Button variant="primary" size="lg" className="sm:min-w-[240px]" onClick={handleBookingClick}>
        Agendar Cita
      </Button>
      <Button variant="secondary" size="lg" className="sm:min-w-[240px]" onClick={handleWhatsAppClick}>
        Enviar Mensaje
      </Button>
      <Link href={`/doctores/${doctorSlug}/blog`}>
        <Button variant="tertiary" size="lg" className="sm:min-w-[240px] flex items-center justify-center gap-2">
          <FileText className="w-5 h-5" />
          Blog del Doctor
        </Button>
      </Link>
    </div>
  );
}
