"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Plus, Edit, Trash2, Eye, Loader2, AlertCircle, BarChart } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  thumbnail: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export default function BlogManagementPage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');

  useEffect(() => {
    if (session && status === 'authenticated') {
      fetchArticles();
    }
    // Only run once when authenticated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const fetchArticles = async () => {
    try {
      setLoading(true);

      const response = await authFetch(`${API_URL}/api/articles`);

      const result = await response.json();

      if (result.success) {
        setArticles(result.data);
        setError(null);
      } else {
        setError(result.error || 'Error al cargar artículos');
      }
    } catch (err) {
      console.error('Error fetching articles:', err);
      setError('Error al cargar artículos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${title}"?`)) {
      return;
    }

    try {
      const response = await authFetch(`${API_URL}/api/articles/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // Remove from local state
        setArticles(articles.filter(a => a.id !== id));
      } else {
        alert(`Error al eliminar artículo: ${result.error}`);
      }
    } catch (err) {
      console.error('Error deleting article:', err);
      alert('Error al eliminar artículo');
    }
  };

  const filteredArticles = articles.filter(article => {
    if (filter === 'ALL') return true;
    return article.status === filter;
  });

  const stats = {
    total: articles.length,
    published: articles.filter(a => a.status === 'PUBLISHED').length,
    drafts: articles.filter(a => a.status === 'DRAFT').length,
    totalViews: articles.reduce((sum, a) => sum + a.views, 0),
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando artículos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Mi Blog</h1>
                <p className="text-gray-600 mt-1">Gestiona tus artículos y publicaciones</p>
              </div>
              <button
                onClick={() => router.push('/dashboard/blog/new')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Nuevo Artículo
              </button>
            </div>
          </div>

        {/* Tarjetas de Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total de Artículos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-10 h-10 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Publicados</p>
                <p className="text-2xl font-bold text-blue-600">{stats.published}</p>
              </div>
              <Eye className="w-10 h-10 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Borradores</p>
                <p className="text-2xl font-bold text-orange-600">{stats.drafts}</p>
              </div>
              <Edit className="w-10 h-10 text-orange-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total de Vistas</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalViews}</p>
              </div>
              <BarChart className="w-10 h-10 text-blue-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Pestañas de Filtro */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-6 py-3 font-medium transition-colors ${
                    filter === tab
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab === 'ALL' ? 'Todos' : tab === 'PUBLISHED' ? 'Publicados' : 'Borradores'}
                  <span className="ml-2 text-sm text-gray-500">
                    ({tab === 'ALL' ? stats.total : tab === 'PUBLISHED' ? stats.published : stats.drafts})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Tabla de Artículos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">Aún no hay artículos</p>
              <p className="text-gray-500 mb-4">
                {filter === 'ALL'
                  ? '¡Comienza a escribir tu primer artículo!'
                  : filter === 'PUBLISHED' ? 'No hay artículos publicados' : 'No hay borradores'}
              </p>
              <button
                onClick={() => router.push('/dashboard/blog/new')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear Artículo
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Título
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vistas
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredArticles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {article.thumbnail && (
                            <img
                              src={article.thumbnail}
                              alt=""
                              className="w-12 h-12 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{article.title}</p>
                            <p className="text-sm text-gray-500 line-clamp-1">{article.excerpt}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {article.status === 'PUBLISHED' ? (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Publicado
                          </span>
                        ) : (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                            Borrador
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {article.publishedAt
                          ? new Date(article.publishedAt).toLocaleDateString()
                          : new Date(article.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {article.views}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => router.push(`/dashboard/blog/${article.id}/edit`)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(article.id, article.title)}
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded transition-colors"
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
          )}
        </div>
    </div>
  );
}
