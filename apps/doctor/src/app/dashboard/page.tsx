"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { User, Stethoscope, MapPin, Calendar, Phone, ExternalLink, LogOut, Loader2, FileText, Briefcase, Package, ShoppingCart, ShoppingBag, DollarSign } from "lucide-react";

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';
const PUBLIC_URL = process.env.NEXT_PUBLIC_PUBLIC_URL || 'http://localhost:3000';

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
      const response = await fetch(`${API_URL}/api/doctors`);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-green-600" />
          <p className="mt-4 text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          {/* Banner */}
          <div className="h-32 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600"></div>

          {/* Profile Header */}
          <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between -mt-16 mb-6">
              <div className="flex items-end space-x-4">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                    <User className="w-16 h-16 text-white" />
                  </div>
                )}
                <div className="pb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {session?.user?.name || "Doctor Portal"}
                  </h1>
                  <p className="text-gray-600 flex items-center gap-2 mt-1">
                    <User className="w-4 h-4" />
                    {session?.user?.email}
                  </p>
                </div>
              </div>

              <div className="mt-4 md:mt-0 md:pb-2">
                <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 text-sm font-semibold rounded-full border-2 border-green-200">
                  <Stethoscope className="w-4 h-4 mr-2" />
                  {session?.user?.role}
                </span>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg p-4 mb-6">
              <p className="text-green-900 font-medium">
                Welcome back, {session?.user?.name?.split(' ')[0]}! 👋
              </p>
              <p className="text-green-700 text-sm mt-1">
                Manage your profile and view your public page from here.
              </p>
            </div>
          </div>
        </div>

        {/* Profile Section */}
        {doctorProfile ? (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Stethoscope className="w-6 h-6 text-green-600" />
                Your Medical Profile
              </h2>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 mb-6 border border-green-100">
              <div className="flex flex-col md:flex-row gap-6">
                {doctorProfile.heroImage && (
                  <img
                    src={doctorProfile.heroImage}
                    alt={doctorProfile.doctorFullName}
                    className="w-32 h-32 rounded-xl object-cover shadow-md border-2 border-white"
                  />
                )}
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {doctorProfile.doctorFullName}
                    </h3>
                    <div className="flex items-center gap-2 text-green-700 font-medium mt-1">
                      <Stethoscope className="w-4 h-4" />
                      {doctorProfile.primarySpecialty}
                    </div>
                  </div>

                  <p className="text-gray-700 leading-relaxed">
                    {doctorProfile.shortBio}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{doctorProfile.city}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{doctorProfile.yearsExperience} years experience</span>
                    </div>
                    {doctorProfile.clinicPhone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4 text-green-600" />
                        <span className="text-sm">{doctorProfile.clinicPhone}</span>
                      </div>
                    )}
                    {doctorProfile.clinicWhatsapp && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4 text-green-600" />
                        <span className="text-sm">WhatsApp: {doctorProfile.clinicWhatsapp}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <a
              href={`http://localhost:3000/doctors/${doctorProfile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <ExternalLink className="w-5 h-5" />
              View Public Profile
            </a>
          </div>
        ) : session?.user?.doctorId ? (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-yellow-600 animate-spin" />
                </div>
              </div>
              <p className="text-yellow-900 font-semibold text-lg">
                {error || "Loading your profile..."}
              </p>
              <p className="text-yellow-700 text-sm mt-2">
                Please wait while we fetch your information
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-blue-900 font-semibold text-lg mb-2">
                No Profile Linked
              </p>
              <p className="text-blue-700 text-sm">
                Your account is not linked to a doctor profile yet. Please contact an administrator to link your account.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <a
              href="/dashboard/blog"
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FileText className="w-5 h-5" />
              My Blog
            </a>
            <a
              href="/appointments"
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Calendar className="w-5 h-5" />
              Manage Appointments
            </a>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Practice Management Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-purple-600" />
            Practice Management
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <a
              href="/dashboard/practice/products"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Package className="w-5 h-5" />
              Productos
            </a>
            <a
              href="/dashboard/practice/flujo-de-dinero"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <DollarSign className="w-5 h-5" />
              Flujo de Dinero
            </a>
            <a
              href="/dashboard/practice/ventas"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <ShoppingCart className="w-5 h-5" />
              Ventas
            </a>
            <a
              href="/dashboard/practice/compras"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <ShoppingBag className="w-5 h-5" />
              Compras
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Doctor Portal • Port 3001 • Development Environment
          </p>
        </div>
      </div>
    </div>
  );
}
