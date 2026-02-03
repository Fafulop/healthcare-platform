"use client";

import { useEffect, useState } from "react";
import {
  CheckSquare,
  Edit,
  CheckCircle2,
  Trash2,
  ArrowRightLeft,
  Heart,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ActivityLog {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string | null;
  displayMessage: string;
  icon: string | null;
  color: string | null;
  metadata: Record<string, any> | null;
  timestamp: string;
}

interface ApiResponse {
  data: ActivityLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const iconMap: Record<string, React.ElementType> = {
  CheckSquare,
  Edit,
  CheckCircle2,
  Trash2,
  ArrowRightLeft,
  Heart,
};

const colorMap: Record<string, string> = {
  blue: "text-blue-600 bg-blue-100",
  green: "text-green-600 bg-green-100",
  red: "text-red-600 bg-red-100",
  yellow: "text-yellow-600 bg-yellow-100",
  purple: "text-purple-600 bg-purple-100",
  gray: "text-gray-600 bg-gray-100",
};

export default function RecentActivityTable({ limit = 10 }: { limit?: number }) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivities() {
      try {
        setLoading(true);
        const response = await fetch(`/api/activity-logs?limit=${limit}`);

        if (!response.ok) {
          throw new Error("Failed to fetch activities");
        }

        const data: ApiResponse = await response.json();
        setActivities(data.data);
      } catch (err) {
        console.error("Error fetching activities:", err);
        setError("No se pudo cargar la actividad reciente");
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, [limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Heart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>No hay actividad reciente</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acción
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
              Tipo
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {activities.map((activity) => {
            const IconComponent = activity.icon ? iconMap[activity.icon] : Heart;
            const colorClass = activity.color ? colorMap[activity.color] : colorMap.gray;
            const timeAgo = formatDistanceToNow(new Date(activity.timestamp), {
              addSuffix: true,
              locale: es,
            });

            return (
              <tr key={activity.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.displayMessage}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap hidden sm:table-cell">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {activity.entityType}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {timeAgo}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
