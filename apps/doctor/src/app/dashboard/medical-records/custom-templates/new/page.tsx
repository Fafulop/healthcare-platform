'use client';

import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { FormBuilder } from '@/components/form-builder/FormBuilder';
import type { FieldDefinition } from '@/types/custom-encounter';

export default function NewCustomTemplatePage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const handleSave = async (data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    customFields: FieldDefinition[];
  }) => {
    const res = await fetch('/api/custom-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!result.success) {
      throw new Error(result.error || 'Error creating template');
    }

    router.push('/dashboard/medical-records/custom-templates');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return <FormBuilder initialTemplate={null} onSave={handleSave} />;
}
