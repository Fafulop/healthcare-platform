import Link from 'next/link';
import { Stethoscope } from 'lucide-react';
import Button from '@/components/ui/Button';
import BlobDecoration from '@/components/ui/BlobDecoration';

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--color-bg-yellow-light)] overflow-hidden">
      {/* Visible organic blobs */}
      <BlobDecoration variant="blob2" color="gradient-blue" position="top-left" size="xl" opacity={40} blur={false} />
      <BlobDecoration variant="blob4" color="gradient-purple" position="bottom-right" size="xl" opacity={35} blur={false} />
      <BlobDecoration variant="blob1" color="accent" position="center" size="lg" opacity={20} blur={false} />

      <main className="relative max-w-4xl px-6 py-16 text-center">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-[var(--color-secondary)] rounded-full flex items-center justify-center">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-5xl font-bold text-[var(--color-neutral-dark)] mb-6">
          Doctor Profile Platform
        </h1>

        {/* Description */}
        <p className="text-xl text-[var(--color-neutral-medium)] mb-8 max-w-2xl mx-auto">
          A complete doctor profile page implementation following SEO best practices and modern design principles.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-left">
          <div className="bg-white p-6 rounded-[var(--radius-medium)] shadow-[var(--shadow-light)]">
            <h3 className="font-semibold text-lg mb-2 text-[var(--color-secondary)]">SEO Optimized</h3>
            <p className="text-[var(--color-neutral-medium)] text-sm">
              Server-side rendering, structured data, and optimized meta tags for maximum search visibility.
            </p>
          </div>
          <div className="bg-white p-6 rounded-[var(--radius-medium)] shadow-[var(--shadow-light)]">
            <h3 className="font-semibold text-lg mb-2 text-[var(--color-secondary)]">Modern Design</h3>
            <p className="text-[var(--color-neutral-medium)] text-sm">
              Clean, professional interface inspired by Zocdoc and One Medical with accessibility in mind.
            </p>
          </div>
          <div className="bg-white p-6 rounded-[var(--radius-medium)] shadow-[var(--shadow-light)]">
            <h3 className="font-semibold text-lg mb-2 text-[var(--color-secondary)]">High Performance</h3>
            <p className="text-[var(--color-neutral-medium)] text-sm">
              Lazy loading, dynamic imports, and image optimization for fast load times and great UX.
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <Link href="/doctores/maria-lopez">
          <Button variant="primary" size="lg">
            Ver Perfil de Ejemplo
          </Button>
        </Link>

        {/* Documentation Links */}
        <div className="mt-12 flex flex-wrap gap-4 justify-center">
          <Link href="/SEO_GUIDE.md" className="text-[var(--color-secondary)] hover:underline font-medium">
            SEO Guide
          </Link>
          <span className="text-[var(--color-neutral-medium)]">•</span>
          <Link href="/DESIGN_GUIDE.md" className="text-[var(--color-secondary)] hover:underline font-medium">
            Design Guide
          </Link>
        </div>
      </main>
    </div>
  );
}
