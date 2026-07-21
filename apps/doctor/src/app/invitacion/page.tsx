"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Users, Loader2 } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  doctor: { doctorFullName: string; lastName: string; primarySpecialty: string };
}

/**
 * G1 (00-REQUISITOS §2.1): the ONLY way a member's account gains access to a
 * portal is landing here and explicitly accepting — never silent auto-attach.
 * A typo'd invite email must not leak patient data.
 */
export default function InvitacionPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/team/my-invites");
      const json = await res.json();
      setInvites(res.ok ? json.data : []);
    } catch {
      setInvites([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = async (id: string, action: "accept" | "decline") => {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/team/my-invites/${id}/${action}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo procesar la invitación");
      if (action === "accept") {
        // Session must re-resolve doctorId via the membership just created.
        await update({});
        router.replace("/dashboard");
        return;
      }
      await load();
    } catch (e: any) {
      setError(e.message || "Ocurrió un error");
    } finally {
      setBusyId(null);
    }
  };

  if (invites === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-xl mb-4">
            <Users className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Invitaciones</h1>
          <p className="mt-1 text-sm text-gray-500">{session?.user?.email}</p>
        </div>

        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 sm:p-8 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {invites.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No tienes invitaciones pendientes.
            </p>
          ) : (
            invites.map((inv) => (
              <div key={inv.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  <strong>{inv.doctor.doctorFullName} {inv.doctor.lastName}</strong> ({inv.doctor.primarySpecialty}) te invitó a su portal.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(inv.id, "accept")}
                    disabled={busyId === inv.id}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busyId === inv.id ? "Procesando..." : "Aceptar"}
                  </button>
                  <button
                    onClick={() => respond(inv.id, "decline")}
                    disabled={busyId === inv.id}
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))
          )}

          <p className="text-center text-xs text-gray-400 pt-2">
            ¿No eres tú?{" "}
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-blue-600 underline hover:text-blue-800">
              Cerrar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
