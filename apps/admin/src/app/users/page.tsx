"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Doctor {
  id: string;
  slug: string;
  doctorFullName: string;
  primarySpecialty: string;
  heroImage: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  doctorId: string | null;
  doctor: Doctor | null;
  createdAt: string;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchDoctors();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("${API_URL}/api/users");
      const result = await response.json();

      if (result.success) {
        setUsers(result.data);
      } else {
        setError("Error al cargar usuarios");
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await fetch("${API_URL}/api/doctors");
      const result = await response.json();

      if (result.success) {
        setDoctors(result.data);
      }
    } catch (err) {
      console.error("Error fetching doctors:", err);
    }
  };

  const handleLinkDoctor = (user: User) => {
    setSelectedUser(user);
    setSelectedDoctorId(user.doctorId || "");
    setShowLinkModal(true);
  };

  const handleUnlinkDoctor = async (userId: string) => {
    if (!confirm("¿Estás seguro de desvincular este usuario del perfil de doctor?")) {
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ doctorId: null }),
      });

      const result = await response.json();

      if (result.success) {
        alert("Usuario desvinculado exitosamente");
        fetchUsers(); // Refresh list
      } else {
        alert(`Error: ${result.message || result.error}`);
      }
    } catch (err) {
      console.error("Error unlinking user:", err);
      alert("Error al desvincular usuario");
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveLink = async () => {
    if (!selectedUser || !selectedDoctorId) {
      alert("Por favor selecciona un doctor");
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ doctorId: selectedDoctorId }),
      });

      const result = await response.json();

      if (result.success) {
        alert("Usuario vinculado exitosamente");
        setShowLinkModal(false);
        fetchUsers(); // Refresh list
      } else {
        alert(`Error: ${result.message || result.error}`);
      }
    } catch (err) {
      console.error("Error linking user:", err);
      alert("Error al vincular usuario");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Back to Dashboard */}
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Gestión de Usuarios
              </h1>
              <p className="text-gray-600">
                {loading ? "Cargando..." : `${users.length} usuarios registrados`}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Cargando usuarios...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No hay usuarios registrados.</p>
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Perfil de Doctor Vinculado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Registro
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {user.image && (
                            <img
                              src={user.image}
                              alt={user.name || user.email}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          )}
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.name || "Sin nombre"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-green-100 text-green-800"
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.doctor ? (
                          <div className="flex items-center">
                            <img
                              src={user.doctor.heroImage}
                              alt={user.doctor.doctorFullName}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {user.doctor.doctorFullName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {user.doctor.primarySpecialty}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Sin vincular</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(user.createdAt).toLocaleDateString('es-MX')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {user.role === "DOCTOR" && (
                          <>
                            <button
                              onClick={() => handleLinkDoctor(user)}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                              disabled={updating}
                            >
                              {user.doctor ? "Cambiar" : "Vincular"}
                            </button>
                            {user.doctor && (
                              <button
                                onClick={() => handleUnlinkDoctor(user.id)}
                                className="text-red-600 hover:text-red-900"
                                disabled={updating}
                              >
                                Desvincular
                              </button>
                            )}
                          </>
                        )}
                        {user.role === "ADMIN" && (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Link Doctor Modal */}
      {showLinkModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Vincular Usuario a Perfil de Doctor
            </h2>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Usuario:</p>
              <p className="font-medium">{selectedUser.email}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecciona un Doctor:
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Seleccionar --</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.doctorFullName} - {doctor.primarySpecialty}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveLink}
                disabled={!selectedDoctorId || updating}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {updating ? "Guardando..." : "Vincular"}
              </button>
              <button
                onClick={() => setShowLinkModal(false)}
                disabled={updating}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
