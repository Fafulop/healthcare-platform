'use client';

import Link from 'next/link';
import { FileText, Calendar, Pill } from 'lucide-react';

export interface Prescription {
  id: string;
  prescriptionDate: string;
  status: string;
  diagnosis?: string;
  medications: Array<{
    id: number;
    drugName: string;
  }>;
  createdAt: string;
}

interface PrescriptionCardProps {
  prescription: Prescription;
  patientId: string;
}

export function PrescriptionCard({ prescription, patientId }: PrescriptionCardProps) {
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      draft: 'Borrador',
      issued: 'Emitida',
      cancelled: 'Cancelada',
      expired: 'Expirada'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      issued: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Link
      href={`/dashboard/medical-records/patients/${patientId}/prescriptions/${prescription.id}`}
      className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <p className="font-medium text-gray-900">
              {prescription.diagnosis || 'Prescripción Médica'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(prescription.prescriptionDate)}
            </div>

            <div className="flex items-center gap-1">
              <Pill className="w-4 h-4" />
              {prescription.medications.length} medicamento{prescription.medications.length !== 1 ? 's' : ''}
            </div>
          </div>

          {prescription.medications.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                {prescription.medications.slice(0, 3).map(m => m.drugName).join(', ')}
                {prescription.medications.length > 3 && ` +${prescription.medications.length - 3} más`}
              </p>
            </div>
          )}
        </div>

        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(prescription.status)}`}>
          {getStatusLabel(prescription.status)}
        </span>
      </div>
    </Link>
  );
}
