"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, Users, Building2, FileText, ShoppingCart, Phone, Mail, MapPin } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Client {
  id: number;
  businessName: string;
  contactName: string | null;
  rfc: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  industry: string | null;
  notes: string | null;
  status: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ClientsPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchClients = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await authFetch(`${API_URL}/api/practice-management/clients?${params}`);

      if (!response.ok) {
        throw new Error('Error al cargar clientes');
      }

      const result = await response.json();
      setClients(result.data || []);
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${client.businessName}"?`)) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/clients/${client.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar cliente');
      }

      await fetchClients();
    } catch (err) {
      console.error('Error al eliminar cliente:', err);
      alert('Error al eliminar cliente');
    }
  };

  const filteredClients = clients.filter(client =>
    client.businessName.toLowerCase().includes(search.toLowerCase()) ||
    client.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    client.email?.toLowerCase().includes(search.toLowerCase()) ||
    client.city?.toLowerCase().includes(search.toLowerCase())
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Gestiona tus relaciones con clientes
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/practice/cotizaciones"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-semibold"
            >
              <FileText className="w-5 h-5" />
              <span className="hidden sm:inline">Cotizaciones</span>
            </Link>
            <Link
              href="/dashboard/practice/ventas"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition-colors font-semibold"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden sm:inline">Ventas</span>
            </Link>
            <Link
              href="/dashboard/practice/clients/new"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nuevo</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, contacto, correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los Estados</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Empty State */}
      {filteredClients.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {search || statusFilter !== 'all' ? 'No se encontraron clientes' : 'No hay clientes'}
          </h3>
          <p className="text-gray-600 mb-4">
            {!search && statusFilter === 'all' && 'Crea tu primer cliente para comenzar'}
          </p>
          {!search && statusFilter === 'all' && (
            <Link
              href="/dashboard/practice/clients/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Cliente
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {filteredClients.map(client => (
              <div key={client.id} className="bg-white rounded-lg shadow p-4">
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{client.businessName}</div>
                    {client.industry && (
                      <div className="text-xs text-gray-500">{client.industry}</div>
                    )}
                    {client.rfc && (
                      <div className="text-xs text-gray-400">RFC: {client.rfc}</div>
                    )}
                  </div>
                  <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                    client.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {client.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-3">
                  {client.contactName && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Users className="w-4 h-4 text-gray-400" />
                      {client.contactName}
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {client.phone}
                    </div>
                  )}
                  {(client.city || client.state) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {client.city && client.state
                        ? `${client.city}, ${client.state}`
                        : client.city || client.state}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 pt-3 border-t border-gray-100">
                  <Link
                    href={`/dashboard/practice/cotizaciones/new?clientId=${client.id}`}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Crear cotización"
                  >
                    <FileText className="w-5 h-5" />
                  </Link>
                  <Link
                    href={`/dashboard/practice/clients/${client.id}/edit`}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={() => handleDelete(client)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Empresa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Correo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teléfono
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ubicación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredClients.map(client => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{client.businessName}</div>
                        {client.industry && (
                          <div className="text-sm text-gray-500">{client.industry}</div>
                        )}
                        {client.rfc && (
                          <div className="text-xs text-gray-400">RFC: {client.rfc}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {client.contactName || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {client.email || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {client.phone || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {client.city && client.state
                          ? `${client.city}, ${client.state}`
                          : client.city || client.state || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          client.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {client.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/practice/cotizaciones/new?clientId=${client.id}`}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="Crear cotización"
                          >
                            <FileText className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/dashboard/practice/clients/${client.id}/edit`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(client)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Summary */}
      {filteredClients.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-600">
          Mostrando {filteredClients.length} de {clients.length} cliente{clients.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
