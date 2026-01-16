"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

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

interface DoctorProfileContextType {
  doctorProfile: DoctorProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DoctorProfileContext = createContext<DoctorProfileContextType | undefined>(undefined);

export function DoctorProfileProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDoctorProfile = async () => {
    if (!session?.user?.doctorId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: DoctorProfile) => d.id === session.user.doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        }
      } else {
        setError("Failed to fetch doctor profile");
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
      setError("Error fetching doctor profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && session?.user?.doctorId) {
      fetchDoctorProfile();
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [status, session?.user?.doctorId]);

  return (
    <DoctorProfileContext.Provider
      value={{
        doctorProfile,
        loading,
        error,
        refetch: fetchDoctorProfile,
      }}
    >
      {children}
    </DoctorProfileContext.Provider>
  );
}

export function useDoctorProfile() {
  const context = useContext(DoctorProfileContext);
  if (context === undefined) {
    throw new Error("useDoctorProfile must be used within a DoctorProfileProvider");
  }
  return context;
}
