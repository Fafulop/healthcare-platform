"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, Package, Database } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Product {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  price: string | null;
  cost: string | null;
  stockQuantity: number | null;
  unit: string | null;
  status: string;
  components: any[];
}

export default function ProductsPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await authFetch(`${API_URL}/api/practice-management/products?${params}`);

      if (!response.ok) throw new Error('Error al cargar productos');

      const result = await response.json();
      setProducts(result.data || []);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/products/${product.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error al eliminar producto');
      await fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Error al eliminar producto');
    }
  };

  const calculateTotalCost = (product: Product): number => {
    if (!product.components || product.components.length === 0) {
      return parseFloat(product.cost || '0');
    }
    return product.components.reduce((sum, comp) => sum + parseFloat(comp.calculatedCost || 0), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.sku?.toLowerCase().includes(search.toLowerCase()) ||
    product.category?.toLowerCase().includes(search.toLowerCase())
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Productos</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Gestiona tu catálogo de productos
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/practice/master-data"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-semibold"
            >
              <Database className="w-5 h-5" />
              <span className="hidden sm:inline">Datos Maestros</span>
            </Link>
            <Link
              href="/dashboard/practice/products/new"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nuevo Producto</span>
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
              placeholder="Buscar por nombre, SKU o categoría..."
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
            <option value="all">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="discontinued">Descontinuado</option>
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
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {search || statusFilter !== 'all' ? 'No se encontraron productos' : 'No hay productos'}
          </h3>
          <p className="text-gray-600 mb-4">
            {!search && statusFilter === 'all' && 'Comienza creando tu primer producto'}
          </p>
          {!search && statusFilter === 'all' && (
            <Link
              href="/dashboard/practice/products/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {filteredProducts.map(product => {
              const totalCost = calculateTotalCost(product);
              const price = parseFloat(product.price || '0');
              const margin = price > 0 ? ((price - totalCost) / price * 100).toFixed(1) : '0';

              return (
                <div key={product.id} className="bg-white rounded-lg shadow p-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{product.name}</div>
                      {product.sku && (
                        <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                      )}
                    </div>
                    <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                      product.status === 'active'
                        ? 'bg-blue-100 text-blue-800'
                        : product.status === 'inactive'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {product.status === 'active' ? 'Activo' : product.status === 'inactive' ? 'Inactivo' : 'Descontinuado'}
                    </span>
                  </div>

                  {/* Category */}
                  {product.category && (
                    <div className="text-sm text-gray-600 mb-3">
                      {product.category}
                    </div>
                  )}

                  {/* Price and Cost Row */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <div className="text-xs text-gray-400">Precio</div>
                      <div className="font-semibold text-gray-900">{formatCurrency(price)}</div>
                      {product.unit && (
                        <div className="text-xs text-gray-500">por {product.unit}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Costo</div>
                      <div className="text-gray-900">{formatCurrency(totalCost)}</div>
                      <div className={`text-xs ${parseFloat(margin) > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {margin}% margen
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Stock</div>
                      <div className="text-gray-900">{product.stockQuantity || '0'}</div>
                    </div>
                  </div>

                  {/* Components Badge */}
                  {product.components?.length > 0 && (
                    <div className="text-xs text-blue-600 mb-3">
                      {product.components.length} componente{product.components.length !== 1 ? 's' : ''}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 pt-3 border-t border-gray-100">
                    <Link
                      href={`/dashboard/practice/products/${product.id}/edit`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => handleDelete(product)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoría
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Costo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
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
                  {filteredProducts.map(product => {
                    const totalCost = calculateTotalCost(product);
                    const price = parseFloat(product.price || '0');
                    const margin = price > 0 ? ((price - totalCost) / price * 100).toFixed(1) : '0';

                    return (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{product.name}</div>
                          {product.sku && (
                            <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                          )}
                          {product.components?.length > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              {product.components.length} componente{product.components.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {product.category || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(price)}
                          </div>
                          {product.unit && (
                            <div className="text-xs text-gray-500">por {product.unit}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-gray-900">{formatCurrency(totalCost)}</div>
                          <div className={`text-xs ${parseFloat(margin) > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {margin}% margen
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {product.stockQuantity || '0'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            product.status === 'active'
                              ? 'bg-blue-100 text-blue-800'
                              : product.status === 'inactive'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {product.status === 'active' ? 'Activo' : product.status === 'inactive' ? 'Inactivo' : 'Descontinuado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/dashboard/practice/products/${product.id}/edit`}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(product)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Summary */}
      {filteredProducts.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-600">
          Mostrando {filteredProducts.length} de {products.length} producto{products.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
