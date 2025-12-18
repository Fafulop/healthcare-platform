import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Stethoscope } from 'lucide-react';
import { getAllDoctors } from '@/lib/data';
import type { DoctorProfile } from '@/types/doctor';

export const metadata = {
  title: 'Nuestros Médicos | Encuentra tu Doctor Especialista',
  description: 'Directorio completo de médicos especialistas verificados. Encuentra doctores por especialidad, ubicación y agenda tu cita en línea.',
};

export default async function DoctorsPage() {
  const doctors = await getAllDoctors();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5C2] to-[#D0E7E9]">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="inline-flex items-center gap-2 text-[var(--color-secondary)] hover:opacity-80">
            <Stethoscope className="w-6 h-6" />
            <span className="font-semibold">Inicio</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-neutral-dark)] mb-4">
            Nuestros Médicos Especialistas
          </h1>
          <p className="text-xl text-[var(--color-neutral-medium)] max-w-3xl mx-auto">
            Encuentra médicos verificados, revisa sus especialidades y agenda tu cita en línea.
          </p>
        </div>

        {/* Stats */}
        {doctors.length > 0 && (
          <div className="text-center mb-8">
            <p className="text-lg text-[var(--color-neutral-medium)]">
              {doctors.length} {doctors.length === 1 ? 'médico disponible' : 'médicos disponibles'}
            </p>
          </div>
        )}

        {/* Doctors Grid */}
        {doctors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {doctors.map((doctor) => (
              <DoctorCard key={doctor.slug} doctor={doctor} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-[var(--color-neutral-medium)]">
              No hay médicos disponibles en este momento.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-[var(--color-neutral-medium)]">
          <p>&copy; {new Date().getFullYear()} Plataforma de Perfiles Médicos</p>
        </div>
      </footer>
    </div>
  );
}

// Doctor Card Component - SEO-optimized with semantic HTML and proper Link
function DoctorCard({ doctor }: { doctor: DoctorProfile }) {
  return (
    <Link
      href={`/doctores/${doctor.slug}`}
      className="block bg-white rounded-[var(--radius-medium)] shadow-[var(--shadow-light)] hover:shadow-[var(--shadow-medium)] transition-shadow overflow-hidden group"
    >
      {/* Doctor Image */}
      <div className="relative h-64 bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-accent)] p-1">
        <div className="relative w-full h-full bg-white rounded-t-[var(--radius-medium)] overflow-hidden">
          <Image
            src={doctor.hero_image}
            alt={`${doctor.doctor_full_name} - ${doctor.primary_specialty}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      </div>

      {/* Doctor Info */}
      <div className="p-6">
        {/* Name - Semantic heading for each card */}
        <h2 className="text-xl font-bold text-[var(--color-neutral-dark)] mb-2 group-hover:text-[var(--color-secondary)] transition-colors">
          {doctor.doctor_full_name}
        </h2>

        {/* Specialty */}
        <p className="text-[var(--color-secondary)] font-semibold mb-3">
          {doctor.primary_specialty}
        </p>

        {/* Location */}
        <div className="flex items-center gap-2 text-[var(--color-neutral-medium)] mb-4">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{doctor.location_summary}</span>
        </div>

        {/* Bio Preview */}
        {doctor.short_bio && (
          <p className="text-sm text-[var(--color-neutral-medium)] line-clamp-3 mb-4">
            {doctor.short_bio}
          </p>
        )}

        {/* Years of Experience */}
        {doctor.years_experience > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-semibold text-[var(--color-secondary)] bg-[var(--color-primary)] px-3 py-1 rounded-full">
              {doctor.years_experience} {doctor.years_experience === 1 ? 'año' : 'años'} de experiencia
            </span>
          </div>
        )}

        {/* Services Count */}
        {doctor.services_list.length > 0 && (
          <p className="text-xs text-[var(--color-neutral-medium)]">
            {doctor.services_list.length} {doctor.services_list.length === 1 ? 'servicio' : 'servicios'} disponibles
          </p>
        )}

        {/* CTA */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm font-semibold text-[var(--color-secondary)] group-hover:underline">
            Ver perfil completo →
          </span>
        </div>
      </div>
    </Link>
  );
}

// Enable ISR with revalidation
export const revalidate = 3600; // Revalidate every hour
