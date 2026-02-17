"use client";

import type { SearchQuery, PagePerformance } from "@healthcare/types";

interface SearchQueriesTableProps {
  queries: SearchQuery[];
  pages: PagePerformance[];
}

export default function SearchQueriesTable({ queries, pages }: SearchQueriesTableProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Queries */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Consultas de busqueda</h3>
        </div>
        {queries.length === 0 ? (
          <p className="p-4 text-gray-400 text-center">Sin datos disponibles</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Consulta</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-medium">Clics</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-medium">Impresiones</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-medium">CTR</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-medium">Posicion</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {queries.map((q, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">{q.query}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{q.clicks}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{q.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{q.ctr}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">{q.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Pages */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Paginas principales</h3>
        </div>
        {pages.length === 0 ? (
          <p className="p-4 text-gray-400 text-center">Sin datos disponibles</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Pagina</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-medium">Clics</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-medium">Impresiones</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-medium">CTR</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-medium">Posicion</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pages.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate" title={p.page}>
                      {p.page.replace(/^https?:\/\/[^/]+/, '')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.clicks}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.ctr}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.position}</td>
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
