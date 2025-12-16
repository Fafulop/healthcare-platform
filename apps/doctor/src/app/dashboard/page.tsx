"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";

interface DoctorProfile {
  id: string;
  slug: string;
  doctorFullName: string;
  primarySpecialty: string;
  city: string;
  heroImage: string;
  shortBio: string;
  yearsExperience: number;
  clinicPhone: string;
  clinicWhatsapp: string;
}

export default function DoctorDashboardPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    } else {
      setLoading(false);
    }
  }, [session]);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      // Fetch doctor by ID
      const response = await fetch(`http://localhost:3003/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        } else {
          setError("Profile not found");
        }
      } else {
        setError("Failed to load profile");
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
      setError("Error loading profile");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-100">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
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
            Doctor Portal
          </h1>
          <p className="text-sm text-gray-600 mb-1">
            {session?.user?.name}
          </p>
          <p className="text-xs text-gray-500">
            {session?.user?.email}
          </p>
          <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
            {session?.user?.role}
          </span>
        </div>

        {/* Profile Section */}
        {doctorProfile ? (
          <div className="mb-6 border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Your Profile</h2>

            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <div className="flex items-start gap-4">
                {doctorProfile.heroImage && (
                  <img
                    src={doctorProfile.heroImage}
                    alt={doctorProfile.doctorFullName}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">
                    {doctorProfile.doctorFullName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {doctorProfile.primarySpecialty} • {doctorProfile.city}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {doctorProfile.shortBio}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>{doctorProfile.yearsExperience} años de experiencia</span>
                    {doctorProfile.clinicPhone && (
                      <span>📞 {doctorProfile.clinicPhone}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <a
              href={`http://localhost:3000/doctors/${doctorProfile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition"
            >
              Ver Perfil Público
            </a>
          </div>
        ) : session?.user?.doctorId ? (
          <div className="mb-6 border-t border-gray-200 pt-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-yellow-800">
                {error || "Loading profile..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6 border-t border-gray-200 pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-blue-800 font-medium mb-2">
                No profile linked
              </p>
              <p className="text-sm text-blue-600">
                Contact an administrator to link your account to a doctor profile.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="block w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition"
          >
            Cerrar Sesión
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            Puerto: 3001 | Ambiente: Development
          </p>
        </div>
      </div>
    </div>
  );
}
