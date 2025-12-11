// 404 Not Found page for doctor profiles
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-neutral-light)] px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-[var(--color-error)] bg-opacity-10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-[var(--color-error)]" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-[var(--color-neutral-dark)] mb-4">
          Doctor Not Found
        </h1>

        <p className="text-lg text-[var(--color-neutral-medium)] mb-8">
          The doctor profile you're looking for doesn't exist or has been removed.
        </p>

        <Link href="/">
          <Button variant="primary" size="lg">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
