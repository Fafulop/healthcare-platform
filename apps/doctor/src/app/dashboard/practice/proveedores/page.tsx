"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, Truck, ArrowLeft, Package } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Proveedor {
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

export default function ProveedoresPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProveedores();
  }, [session, statusFilter]);

  const fetchProveedores = async () => {
    if (!session?.user?.email) return;

    setLoading(true);
    setError(null);

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`${API_URL}/api/practice-management/proveedores?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar proveedores');
      }

      const result = await response.json();
      setProveedores(result.data || []);
    } catch (err: any) {
      console.error('Error fetching suppliers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (proveedor: Proveedor) => {
    if (!session?.user?.email) return;
    if (!confirm(`¿Estás seguro de eliminar "${proveedor.businessName}"?`)) return;

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/proveedores/${proveedor.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al eliminar proveedor');
      }

      await fetchProveedores();
    } catch (err) {
      console.error('Error al eliminar proveedor:', err);
      alert('Error al eliminar proveedor');
    }
  };

  const filteredProveedores = proveedores.filter(proveedor =>
    proveedor.businessName.toLowerCase().includes(search.toLowerCase()) ||
    proveedor.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    proveedor.email?.toLowerCase().includes(search.toLowerCase()) ||
    proveedor.city?.toLowerCase().includes(search.toLowerCase())
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Dashboard
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Truck className="w-8 h-8 text-green-600" />
                Proveedores
              </h1>
              <p className="text-gray-600 mt-2">
                Gestiona tus relaciones con proveedores
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard/practice/compras"
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
              >
                <Package className="w-5 h-5" />
                Compras
              </Link>
              <Link
                href="/dashboard/practice/proveedores/new"
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Nuevo Proveedor
              </Link>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar proveedores por nombre, contacto, correo o ciudad..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
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

        {/* Suppliers List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {filteredProveedores.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {search || statusFilter !== 'all' ? 'Ningún proveedor coincide con los filtros' : 'Aún no hay proveedores'}
              </p>
              <p className="text-gray-400 text-sm mt-2">
                {!search && statusFilter === 'all' && 'Crea tu primer proveedor para comenzar a gestionar vendedores'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-green-50 to-emerald-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Empresa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Correo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Teléfono
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Ubicación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProveedores.map(proveedor => (
                    <tr key={proveedor.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{proveedor.businessName}</div>
                        {proveedor.industry && (
                          <div className="text-sm text-gray-500">{proveedor.industry}</div>
                        )}
                        {proveedor.rfc && (
                          <div className="text-xs text-gray-400">RFC: {proveedor.rfc}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {proveedor.contactName || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {proveedor.email || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {proveedor.phone || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {proveedor.city && proveedor.state
                          ? `${proveedor.city}, ${proveedor.state}`
                          : proveedor.city || proveedor.state || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          proveedor.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {proveedor.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/practice/proveedores/${proveedor.id}/edit`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar proveedor"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(proveedor)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar proveedor"
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
          )}
        </div>

        {/* Summary */}
        {filteredProveedores.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Mostrando {filteredProveedores.length} de {proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
