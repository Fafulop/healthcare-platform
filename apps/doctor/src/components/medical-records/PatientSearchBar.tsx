'use client';

import { Search } from 'lucide-react';

interface PatientSearchBarProps {
  search: string;
  statusFilter: string;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function PatientSearchBar({
  search,
  statusFilter,
  onSearchChange,
  onStatusChange,
  onSubmit
}: PatientSearchBarProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <form onSubmit={onSubmit} className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o ID..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="archived">Archivados</option>
        </select>

        <button
          type="submit"
          className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md transition-colors"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}
