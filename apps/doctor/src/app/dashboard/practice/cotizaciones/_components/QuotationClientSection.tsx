'use client';

import { Loader2 } from 'lucide-react';
import type { Client, Patient } from './quotation-types';

interface Props {
  patients: Patient[];
  clients: Client[];
  selectedPatient: Patient | null;
  selectedClient: Client | undefined;
  selectValue: string;
  resolvingPatient: boolean;
  issueDate: string;
  validUntil: string;
  error: string | null;
  showValidUntilHint?: boolean;
  onSelectionChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onIssueDateChange: (v: string) => void;
  onValidUntilChange: (v: string) => void;
}

export function QuotationClientSection({
  patients, clients,
  selectedPatient, selectedClient,
  selectValue, resolvingPatient,
  issueDate, validUntil,
  error, showValidUntilHint,
  onSelectionChange, onIssueDateChange, onValidUntilChange,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Información del Paciente</h2>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Paciente *</label>
        <select
          value={selectValue}
          onChange={onSelectionChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        >
          <option value="">Seleccionar paciente...</option>
          {patients.length > 0 && (
            <optgroup label="Pacientes">
              {patients.map(patient => (
                <option key={patient.id} value={`patient:${patient.id}`}>
                  {patient.firstName} {patient.lastName}
                </option>
              ))}
            </optgroup>
          )}
          {(() => {
            const patientNames = new Set(patients.map(p => `${p.firstName} ${p.lastName}`));
            const externalClients = clients.filter(c => !patientNames.has(c.businessName));
            return externalClients.length > 0 && (
              <optgroup label="Clientes Externos">
                {externalClients.map(client => (
                  <option key={client.id} value={`client:${client.id}`}>
                    {client.businessName} {client.contactName ? `- ${client.contactName}` : ''}
                  </option>
                ))}
              </optgroup>
            );
          })()}
        </select>
        {resolvingPatient && (
          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Preparando datos...
          </p>
        )}
      </div>

      {(selectedPatient || selectedClient) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-blue-600 text-xl">✓</span>
            <div className="flex-1">
              {selectedPatient ? (
                <>
                  <div className="font-semibold text-gray-900">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </div>
                  <div className="text-xs text-blue-600 font-medium mt-0.5">Paciente</div>
                  {selectedPatient.internalId && (
                    <div className="text-sm text-gray-600">ID interno: {selectedPatient.internalId}</div>
                  )}
                  {selectedPatient.email && (
                    <div className="text-sm text-gray-600">📧 {selectedPatient.email}</div>
                  )}
                  {selectedPatient.phone && (
                    <div className="text-sm text-gray-600">📞 {selectedPatient.phone}</div>
                  )}
                </>
              ) : selectedClient ? (
                <>
                  <div className="font-semibold text-gray-900">{selectedClient.businessName}</div>
                  {selectedClient.contactName && (
                    <div className="text-sm text-gray-600">Contacto: {selectedClient.contactName}</div>
                  )}
                  {selectedClient.email && (
                    <div className="text-sm text-gray-600">📧 {selectedClient.email}</div>
                  )}
                  {selectedClient.phone && (
                    <div className="text-sm text-gray-600">📞 {selectedClient.phone}</div>
                  )}
                  {selectedClient.rfc && (
                    <div className="text-sm text-gray-600">RFC: {selectedClient.rfc}</div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de emisión *</label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => onIssueDateChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Válida hasta *</label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => onValidUntilChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          {showValidUntilHint && (
            <p className="text-xs text-gray-500 mt-1">(30 días por defecto)</p>
          )}
        </div>
      </div>
    </div>
  );
}
