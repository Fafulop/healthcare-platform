"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";

export default function DashboardPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* User Info Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="w-16 h-16 rounded-full mx-auto border-2 border-blue-500"
              />
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            Admin Panel
          </h1>
          <p className="text-sm text-gray-600 mb-1">
            {session?.user?.name}
          </p>
          <p className="text-xs text-gray-500">
            {session?.user?.email}
          </p>
          <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
            {session?.user?.role}
          </span>
        </div>

        <div className="space-y-4">
          <Link
            href="/doctors/new"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition"
          >
            Crear Nuevo Doctor
          </Link>

          <Link
            href="/doctors"
            className="block w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg text-center transition"
          >
            Ver Doctores
          </Link>

          <Link
            href="/users"
            className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition"
          >
            Gestionar Usuarios
          </Link>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="block w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition"
          >
            Cerrar Sesión
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            Puerto: 3002 | Ambiente: Development
          </p>
        </div>
      </div>
    </div>
  );
}
